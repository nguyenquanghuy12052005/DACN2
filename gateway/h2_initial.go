package main

import (
	"encoding/binary"
	"time"
)

const (
	h2ClientPreface        = "PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n"
	h2InitialByteLimit     = 64 << 10
	h2InitialSettingsLimit = 64
	h2InitialTimeout       = 2 * time.Second
)

type h2Setting struct {
	ID    uint16 `json:"id"`
	Value uint32 `json:"value"`
}

// Single-owner parser for ONLY the client's first SETTINGS frame.
// settings_observed is not a complete H2 fingerprint. No network I/O here.
type h2InitialParser struct {
	status        string
	reason        string
	deadline      time.Time
	settings      []h2Setting
	prefaceRead   int
	header        [9]byte
	headerRead    int
	payloadLength int
	payloadRead   int
	pair          [6]byte
	bytesRead     int
}

// Call when observing the first plaintext H2 bytes, not when TCP is accepted.
func newH2InitialParser(now time.Time) *h2InitialParser {
	return &h2InitialParser{status: "collecting", deadline: now.Add(h2InitialTimeout)}
}

func (p *h2InitialParser) stop(status, reason string) {
	if p.status != "collecting" {
		return
	}
	p.status, p.reason = status, reason
	p.settings = nil // Never expose a partial SETTINGS list as a complete one.
}

// feed returns the number of bytes consumed, leaving later frames untouched.
// now is supplied by the owner, allowing deterministic deadline tests.
// The future connection owner must also check deadlines while reads are idle.
func (p *h2InitialParser) feed(data []byte, now time.Time) int {
	if p.status != "collecting" {
		return 0
	}
	if !now.Before(p.deadline) {
		p.stop("incomplete", "timeout")
		return 0
	}
	for i, b := range data {
		if p.bytesRead == h2InitialByteLimit {
			p.stop("incomplete", "byte_limit")
			return i
		}
		p.bytesRead++
		if p.prefaceRead < len(h2ClientPreface) {
			if b != h2ClientPreface[p.prefaceRead] {
				p.stop("invalid", "preface")
				return i + 1
			}
			p.prefaceRead++
			continue
		}
		if p.headerRead < len(p.header) {
			p.header[p.headerRead] = b
			p.headerRead++
			if p.headerRead != len(p.header) {
				continue
			}
			p.payloadLength = int(p.header[0])<<16 | int(p.header[1])<<8 | int(p.header[2])
			stream := binary.BigEndian.Uint32(p.header[5:]) & 0x7fffffff
			// RFC 9113: client preface is followed by non-ACK SETTINGS on stream 0.
			if p.header[3] != 4 || p.header[4]&1 != 0 || stream != 0 || p.payloadLength%6 != 0 {
				p.stop("invalid", "initial_settings_header")
				return i + 1
			}
			if p.payloadLength > h2InitialByteLimit-p.bytesRead {
				p.stop("incomplete", "byte_limit")
				return i + 1
			}
			if p.payloadLength/6 > h2InitialSettingsLimit {
				p.stop("incomplete", "settings_limit")
				return i + 1
			}
			if p.payloadLength == 0 {
				p.settings = []h2Setting{} // Observed empty list, not missing data.
				p.status = "settings_observed"
				return i + 1
			}
			continue
		}
		p.pair[p.payloadRead%6] = b
		p.payloadRead++
		if p.payloadRead%6 == 0 {
			s := h2Setting{binary.BigEndian.Uint16(p.pair[:2]), binary.BigEndian.Uint32(p.pair[2:])}
			if (s.ID == 2 && s.Value > 1) || (s.ID == 4 && s.Value > 0x7fffffff) ||
				(s.ID == 5 && (s.Value < 16384 || s.Value > 16777215)) {
				p.stop("invalid", "settings_value")
				return i + 1
			}
			// Keep wire order and duplicates; unknown IDs are valid extension points.
			p.settings = append(p.settings, s)
		}
		if p.payloadRead == p.payloadLength {
			p.status = "settings_observed"
			return i + 1
		}
	}
	return len(data)
}

// Called by the owner on EOF/read error; does not change the network error.
func (p *h2InitialParser) end() { p.stop("incomplete", "read_ended") }
