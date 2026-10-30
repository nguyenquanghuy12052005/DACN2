package main

import (
	"reflect"
	"testing"
	"time"
)

func frameWire(kind, flags byte, stream uint32, payload []byte) []byte {
	n := len(payload)
	return append([]byte{byte(n >> 16), byte(n >> 8), byte(n), kind, flags, byte(stream >> 24), byte(stream >> 16), byte(stream >> 8), byte(stream)}, payload...)
}

func chromeMetadataWire() []byte {
	b := initialSettingsWire([]h2Setting{{1, 65536}, {2, 0}, {4, 6291456}, {6, 262144}})
	b = append(b, frameWire(8, 0, 0, []byte{0, 0xef, 0, 1})...) // 15663105
	return append(b, frameWire(1, 0x24, 1, []byte{0x80, 0, 0, 0, 255, 0x82, 0x81, 0x87, 0x84})...)
}

func TestH2FramesFragmentation(t *testing.T) {
	now := time.Unix(1, 0)
	wire := chromeMetadataWire()
	check := func(o *h2FrameObserver) {
		t.Helper()
		if o.status != "headers_observed" || o.windowIncrement == nil || *o.windowIncrement != 15663105 || o.headersPriority == nil || *o.headersPriority != (h2Priority{1, true, 0, 256}) || len(o.priorities) != 0 || !o.firstHeadersEndHeaders {
			t.Fatalf("observation=%+v priority=%v", o, o.headersPriority)
		}
	}
	for split := 0; split <= len(wire); split++ {
		o := newH2FrameObserver(now)
		o.feed(wire[:split], now)
		o.feed(wire[split:], now)
		check(o)
	}
	o := newH2FrameObserver(now)
	for _, b := range wire {
		o.feed([]byte{b}, now)
	}
	check(o)
	for cut := 0; cut < len(wire); cut++ {
		o := newH2FrameObserver(now)
		o.feed(wire[:cut], now)
		o.end()
		if o.status != "incomplete" {
			t.Fatalf("cut %d: %s", cut, o.status)
		}
	}
}

func TestH2FramesScopeAndPriority(t *testing.T) {
	now := time.Unix(1, 0)
	b := initialSettingsWire(nil)
	b = append(b, frameWire(8, 0, 1, []byte{0, 0, 0, 99})...) // Stream update is not connection evidence.
	b = append(b, frameWire(99, 0, 0, []byte{1, 2})...)       // Skip extension frames without storing payload.
	b = append(b, frameWire(2, 0, 3, []byte{0, 0, 0, 0, 0})...)
	b = append(b, frameWire(2, 0, 5, []byte{0x80, 0, 0, 3, 255})...)
	b = append(b, frameWire(1, 0x28, 1, []byte{2, 0, 0, 0, 3, 10, 0x82, 0, 0})...) // PADDED, PRIORITY, needs CONTINUATION.
	o := newH2FrameObserver(now)
	trailing := frameWire(9, 4, 1, []byte{0x87, 0x84})
	input := append(append([]byte{}, b...), trailing...)
	if n := o.feed(input, now); n != len(input) {
		t.Fatalf("consumed continuation: %d", n)
	}
	if o.windowIncrement != nil || o.firstHeadersEndHeaders || !reflect.DeepEqual(o.priorities, []h2Priority{{3, false, 0, 1}, {5, true, 3, 256}}) || o.headersPriority == nil || o.headersPriority.Weight != 11 {
		t.Fatalf("scope/priority lost: %+v", o)
	}
	o.end()
	if o.status != "headers_observed" || o.feed(trailing, now) != 0 {
		t.Fatal("terminal status changed")
	}
	// A completely observed HEADERS with no priority differs from truncation.
	o = newH2FrameObserver(now)
	o.feed(append(initialSettingsWire(nil), frameWire(1, 4, 1, []byte{0x82, 0x87, 0x84})...), now)
	if o.status != "headers_observed" || o.headersPriority != nil || o.priorities == nil {
		t.Fatal("missing/absent metadata conflated")
	}
	// Keep the first connection update, ignore its reserved bit and later updates.
	b = initialSettingsWire(nil)
	b = append(b, frameWire(8, 0, 0, []byte{0x80, 0, 0, 7})...)
	b = append(b, frameWire(8, 0, 0, []byte{0, 0, 0, 8})...)
	b = append(b, frameWire(1, 4, 1, []byte{0x82, 0x87, 0x84})...)
	o = newH2FrameObserver(now)
	o.feed(b, now)
	if o.windowIncrement == nil || *o.windowIncrement != 7 {
		t.Fatal("first update not preserved")
	}
}

func TestH2FramesInvalid(t *testing.T) {
	for _, tc := range []struct {
		name   string
		frame  []byte
		reason string
	}{
		{"window_length", frameWire(8, 0, 0, []byte{1}), "window_length"},
		{"window_zero", frameWire(8, 0, 0, []byte{0x80, 0, 0, 0}), "window_zero"},
		{"priority_stream", frameWire(2, 0, 0, make([]byte, 5)), "priority_header"},
		{"priority_length", frameWire(2, 0, 1, make([]byte, 4)), "priority_header"},
		{"self", frameWire(2, 0, 1, []byte{0, 0, 0, 1, 0}), "priority_self_dependency"},
		{"headers_self", frameWire(1, 32, 1, []byte{0, 0, 0, 1, 0}), "priority_self_dependency"},
		{"headers_stream", frameWire(1, 0, 0, nil), "headers_metadata"},
		{"headers_short", frameWire(1, 40, 1, make([]byte, 5)), "headers_metadata"},
		{"padding", frameWire(1, 8, 1, []byte{1}), "headers_padding"},
		{"continuation", frameWire(9, 4, 1, nil), "unexpected_continuation"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			now := time.Unix(1, 0)
			o := newH2FrameObserver(now)
			o.feed(append(initialSettingsWire(nil), tc.frame...), now)
			if o.status != "invalid" || o.reason != tc.reason {
				t.Fatalf("%+v", o)
			}
		})
	}
}

func TestH2FramesLimits(t *testing.T) {
	now := time.Unix(1, 0)
	exact := newH2FrameObserver(now)
	exact.feed(initialSettingsWire(nil), now)
	for range 30 {
		exact.feed(frameWire(99, 0, 0, nil), now)
	}
	exact.feed(frameWire(1, 4, 1, []byte{0x82, 0x87, 0x84}), now)
	if exact.status != "headers_observed" || exact.frames != 32 {
		t.Fatal("exact frame cap rejected")
	}
	o := newH2FrameObserver(now)
	o.feed(initialSettingsWire(nil), now)
	for range 31 {
		o.feed(frameWire(99, 0, 0, nil), now)
	}
	if o.frames != 32 {
		t.Fatal("frame counting")
	}
	if n := o.feed(frameWire(1, 4, 1, []byte{0x82, 0x87, 0x84}), now); n != 0 || o.reason != "frame_limit" {
		t.Fatal("frame cap")
	}
	o = newH2FrameObserver(now)
	o.feed(initialSettingsWire(nil), now)
	o.feed(frameWire(1, 4, 1, []byte{0x82, 0x87, 0x84}), now.Add(2*time.Second))
	if o.reason != "timeout" {
		t.Fatal("timeout")
	}
	o = newH2FrameObserver(now)
	o.feed([]byte("X"), now)
	if o.status != "invalid" || o.reason != "preface" {
		t.Fatal("initial error propagation")
	}
	o = newH2FrameObserver(now)
	o.feed(initialSettingsWire(nil), now)
	o.feed(frameWire(99, 0, 0, make([]byte, 65536)), now)
	if o.reason != "byte_limit" {
		t.Fatal("announced length bound")
	}
	// Exactly exhaust the shared 64 KiB budget, including preface and SETTINGS.
	o = newH2FrameObserver(now)
	o.feed(initialSettingsWire(nil), now)
	o.feed(frameWire(99, 0, 0, make([]byte, 65536-33-9)), now)
	if o.bytesRead != 65536 {
		t.Fatal("shared budget")
	}
	o.feed([]byte{0}, now)
	if o.reason != "byte_limit" {
		t.Fatal("byte cap")
	}
}
