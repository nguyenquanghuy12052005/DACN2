package main

import (
	"encoding/binary"
	"time"
)

type h2StreamEvent struct {
	SchemaVersion int       `json:"schema_version"`
	Event         string    `json:"event"`
	ConnectionID  uint64    `json:"connection_id"`
	StreamID      uint32    `json:"stream_id"`
	StartedAt     time.Time `json:"started_at"`
	Status        string    `json:"status"`
}

// Constant-memory frame-header observer. Go still validates/owns the protocol.
// A client starts a new stream with HEADERS and increasing odd identifiers.
// Later HEADERS on the same stream are trailers, not new streams.
type h2StreamCounter struct {
	preface   int
	header    [9]byte
	have      int
	remaining uint32
	last      uint32
	count     uint32
	failed    bool
}

func (p *h2StreamCounter) feed(data []byte, now time.Time, connection uint64) []h2StreamEvent {
	var out []h2StreamEvent
	for _, b := range data {
		if p.failed {
			break
		}
		if p.preface < len(h2ClientPreface) {
			if b != h2ClientPreface[p.preface] {
				p.failed = true
				out = append(out, h2StreamEvent{2, "gateway_h2_stream", connection, 0, now.UTC(), "invalid_preface"})
				break
			}
			p.preface++
			continue
		}
		if p.remaining > 0 {
			p.remaining--
			continue
		}
		p.header[p.have] = b
		p.have++
		if p.have != 9 {
			continue
		}
		p.have = 0
		p.remaining = uint32(p.header[0])<<16 | uint32(p.header[1])<<8 | uint32(p.header[2])
		stream := binary.BigEndian.Uint32(p.header[5:]) & 0x7fffffff
		if p.header[3] != 1 {
			continue
		}
		if stream == 0 {
			p.failed = true
			out = append(out, h2StreamEvent{2, "gateway_h2_stream", connection, stream, now.UTC(), "invalid_headers"})
			break
		}
		if stream <= p.last {
			continue
		}
		if stream%2 == 0 || p.remaining == 0 {
			p.failed = true
			out = append(out, h2StreamEvent{2, "gateway_h2_stream", connection, stream, now.UTC(), "invalid_headers"})
			break
		}
		p.last = stream
		p.count++
		if p.count > 100000 {
			p.failed = true
			out = append(out, h2StreamEvent{2, "gateway_h2_stream", connection, stream, now.UTC(), "capacity"})
			break
		}
		out = append(out, h2StreamEvent{2, "gateway_h2_stream", connection, stream, now.UTC(), "opened"})
	}
	return out
}
