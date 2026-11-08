package main

import (
	"testing"
	"time"
)

func TestH2StreamCounterFragmentsAndTrailers(t *testing.T) {
	// SETTINGS, HEADERS stream1, a trailer on1, then stream3.
	wire := append([]byte(h2ClientPreface), []byte{0, 0, 0, 4, 0, 0, 0, 0, 0}...)
	for _, id := range []byte{1, 1, 3} {
		wire = append(wire, 0, 0, 1, 1, 4, 0, 0, 0, id, 0x82)
	}
	for chunk := 1; chunk <= len(wire); chunk++ {
		p := &h2StreamCounter{}
		var events []h2StreamEvent
		for i := 0; i < len(wire); i += chunk {
			end := i + chunk
			if end > len(wire) {
				end = len(wire)
			}
			events = append(events, p.feed(wire[i:end], time.Now(), 7)...)
		}
		if len(events) != 2 || events[0].StreamID != 1 || events[1].StreamID != 3 {
			t.Fatalf("chunk%d: %+v", chunk, events)
		}
	}
}

func TestH2StreamCounterInvalidAndBounded(t *testing.T) {
	for _, id := range []byte{0, 2} {
		p := &h2StreamCounter{preface: len(h2ClientPreface)}
		events := p.feed([]byte{0, 0, 1, 1, 4, 0, 0, 0, id, 0x82}, time.Now(), 1)
		if len(events) != 1 || events[0].Status != "invalid_headers" {
			t.Fatal(events)
		}
	}
	p := &h2StreamCounter{preface: len(h2ClientPreface), count: 100000}
	events := p.feed([]byte{0, 0, 1, 1, 4, 0, 0, 0, 1, 0x82}, time.Now(), 1)
	if len(events) != 1 || events[0].Status != "capacity" {
		t.Fatal(events)
	}
}
