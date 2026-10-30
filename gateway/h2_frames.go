package main

import (
	"encoding/binary"
	"golang.org/x/net/http2/hpack"
	"time"
)

const h2ObservationFrameLimit = 32

type h2Priority struct {
	StreamID   uint32 `json:"stream_id"`
	Exclusive  bool   `json:"exclusive"`
	Dependency uint32 `json:"dependency"`
	Weight     uint16 `json:"weight"`
}

// Single owner. Observe through the first complete header block.
// This is not a complete HTTP/2 request validator.
type h2FrameObserver struct {
	initial                                *h2InitialParser
	status, reason                         string
	windowIncrement                        *uint32 // nil means not observed, never a fabricated zero.
	priorities                             []h2Priority
	headersPriority                        *h2Priority
	firstHeadersStream                     uint32
	firstHeadersEndHeaders                 bool
	bytesRead, frames                      int
	header                                 [9]byte
	headerRead, payloadLength, payloadRead int
	prefix                                 [6]byte // only padding length/priority/window metadata, never HPACK.
	block                                  []byte
	waitingHeaders                         bool
	pseudoHeaders                          []string
}

func newH2FrameObserver(now time.Time) *h2FrameObserver {
	return &h2FrameObserver{initial: newH2InitialParser(now), status: "collecting"}
}

func (o *h2FrameObserver) stop(status, reason string) {
	if o.status == "collecting" {
		o.status, o.reason = status, reason
		o.block = nil
		o.pseudoHeaders = nil
	}
}

func (o *h2FrameObserver) feed(data []byte, now time.Time) int {
	if o.status != "collecting" {
		return 0
	}
	if !now.Before(o.initial.deadline) {
		o.stop("incomplete", "timeout")
		return 0
	}
	used := 0
	if o.initial.status == "collecting" {
		used = o.initial.feed(data, now)
		o.bytesRead += used
		if o.initial.status == "collecting" {
			return used
		}
		if o.initial.status != "settings_observed" {
			o.stop(o.initial.status, o.initial.reason)
			return used
		}
		o.frames = 1
	}
	for used < len(data) && o.status == "collecting" {
		if o.headerRead == 0 && o.frames == h2ObservationFrameLimit {
			o.stop("incomplete", "frame_limit")
			break
		}
		if o.bytesRead == h2InitialByteLimit {
			o.stop("incomplete", "byte_limit")
			break
		}
		b := data[used]
		used++
		o.bytesRead++
		if o.headerRead < 9 {
			o.header[o.headerRead] = b
			o.headerRead++
			if o.headerRead != 9 {
				continue
			}
			o.payloadLength = int(o.header[0])<<16 | int(o.header[1])<<8 | int(o.header[2])
			stream := binary.BigEndian.Uint32(o.header[5:]) & 0x7fffffff
			if o.waitingHeaders && (o.header[3] != 9 || stream != o.firstHeadersStream) {
				o.stop("invalid", "continuation_sequence")
				break
			}
			switch o.header[3] {
			case 8:
				if o.payloadLength != 4 {
					o.stop("invalid", "window_length")
				}
			case 2:
				if o.payloadLength != 5 || stream == 0 {
					o.stop("invalid", "priority_header")
				}
			case 1:
				minimum := 0
				if o.header[4]&8 != 0 {
					minimum++
				}
				if o.header[4]&32 != 0 {
					minimum += 5
				}
				if stream == 0 || o.payloadLength < minimum {
					o.stop("invalid", "headers_metadata")
				}
			case 9:
				if !o.waitingHeaders {
					o.stop("invalid", "unexpected_continuation")
				}
			}
			if o.status != "collecting" {
				break
			}
			if o.payloadLength > h2InitialByteLimit-o.bytesRead {
				o.stop("incomplete", "byte_limit")
				break
			}
			if o.payloadLength == 0 {
				o.finishFrame()
			}
			continue
		}
		// Do not copy header block/body bytes. For HEADERS retain only the
		// metadata prefix indicated by flags; for all other frames keep <=5.
		keep := 0
		switch o.header[3] {
		case 8:
			keep = 4
		case 2:
			keep = 5
		case 1:
			if o.header[4]&8 != 0 {
				keep++
			}
			if o.header[4]&32 != 0 {
				keep += 5
			}
		}
		if o.payloadRead < keep {
			o.prefix[o.payloadRead] = b
		}
		if o.header[3] == 9 || o.header[3] == 1 {
			padding := 0
			if o.header[3] == 1 && o.header[4]&8 != 0 {
				padding = int(o.prefix[0])
			}
			if o.payloadRead >= keep && o.payloadRead < o.payloadLength-padding {
				if len(o.block) == h2HeaderBlockLimit {
					o.stop("incomplete", "header_block_limit")
					break
				}
				o.block = append(o.block, b)
			}
		}
		o.payloadRead++
		if o.payloadRead == o.payloadLength {
			o.finishFrame()
		}
	}
	return used
}

func decodeH2Priority(stream uint32, b []byte) h2Priority {
	dependency := binary.BigEndian.Uint32(b[:4])
	return h2Priority{stream, dependency&0x80000000 != 0, dependency & 0x7fffffff, uint16(b[4]) + 1}
}

func (o *h2FrameObserver) finishFrame() {
	stream := binary.BigEndian.Uint32(o.header[5:]) & 0x7fffffff
	switch o.header[3] {
	case 8:
		increment := binary.BigEndian.Uint32(o.prefix[:4]) & 0x7fffffff
		if increment == 0 {
			o.stop("invalid", "window_zero")
			return
		}
		if stream == 0 && o.windowIncrement == nil {
			o.windowIncrement = &increment
		}
	case 2:
		priority := decodeH2Priority(stream, o.prefix[:5])
		if priority.Dependency == stream {
			o.stop("invalid", "priority_self_dependency")
			return
		}
		o.priorities = append(o.priorities, priority)
	case 1:
		offset := 0
		if o.header[4]&8 != 0 {
			offset = 1
			minimum := offset
			if o.header[4]&32 != 0 {
				minimum += 5
			}
			if int(o.prefix[0]) > o.payloadLength-minimum {
				o.stop("invalid", "headers_padding")
				return
			}
		}
		if o.header[4]&32 != 0 {
			priority := decodeH2Priority(stream, o.prefix[offset:offset+5])
			if priority.Dependency == stream {
				o.stop("invalid", "priority_self_dependency")
				return
			}
			o.headersPriority = &priority
		}
		o.firstHeadersStream = stream
		o.firstHeadersEndHeaders = o.header[4]&4 != 0
		if o.priorities == nil {
			o.priorities = []h2Priority{}
		}
		o.waitingHeaders = !o.firstHeadersEndHeaders
		if !o.waitingHeaders {
			o.finishHeaders()
		}
	case 9:
		if o.header[4]&4 != 0 {
			o.waitingHeaders = false
			o.finishHeaders()
		}
	}
	o.frames++
	o.headerRead, o.payloadRead, o.payloadLength = 0, 0, 0
	o.prefix = [6]byte{}
}

const h2HeaderBlockLimit = 16 << 10

// Only names escape this function. HPACK necessarily holds values transiently
// (including its bounded dynamic table); drop decoder/block on all exits.
func (o *h2FrameObserver) finishHeaders() {
	defer func() { o.block = nil }()
	names := []string{}
	seen := map[string]bool{}
	regular := false
	count, size := 0, 0
	failureStatus, failureReason := "", ""
	var decoder *hpack.Decoder
	fail := func(status, reason string) {
		if failureReason == "" {
			failureStatus, failureReason = status, reason
			decoder.SetEmitEnabled(false)
		}
	}
	decoder = hpack.NewDecoder(4096, func(f hpack.HeaderField) {
		count++
		size += len(f.Name) + len(f.Value) + 32
		if count > 128 || size > h2HeaderBlockLimit {
			fail("incomplete", "header_list_limit")
			return
		}
		if len(f.Name) == 0 {
			fail("invalid", "header_name")
			return
		}
		if f.Name[0] != ':' {
			regular = true
			return
		}
		if regular || seen[f.Name] {
			fail("invalid", "pseudo_header_order")
			return
		}
		switch f.Name {
		case ":method", ":authority", ":scheme", ":path", ":protocol":
		default:
			fail("invalid", "pseudo_header_name")
			return
		}
		seen[f.Name] = true
		names = append(names, f.Name)
	})
	decoder.SetAllowedMaxDynamicTableSize(4096)
	decoder.SetMaxStringLength(8192)
	_, err := decoder.Write(o.block)
	if failureReason != "" {
		o.stop(failureStatus, failureReason)
		return
	}
	if err == hpack.ErrStringLength {
		o.stop("incomplete", "header_string_limit")
		return
	}
	if err != nil {
		o.stop("invalid", "hpack_decode")
		return
	}
	if err = decoder.Close(); err != nil {
		o.stop("invalid", "hpack_truncated")
		return
	}
	// Missing request fields are left to net/http's semantic validation. A
	// missing :method is sufficient to withhold this fingerprint observation.
	if !seen[":method"] {
		o.stop("incomplete", "missing_pseudo_headers")
		return
	}
	o.pseudoHeaders = names
	o.status = "headers_observed" // WU may still be missing; no Akamai hash here.
}

func (o *h2FrameObserver) end() {
	if o.initial.status == "collecting" {
		o.initial.end()
	}
	o.stop("incomplete", "read_ended")
}
