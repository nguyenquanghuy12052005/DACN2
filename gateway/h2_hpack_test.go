package main

import (
	"bytes"
	"encoding/hex"
	"golang.org/x/net/http2/hpack"
	"reflect"
	"strings"
	"testing"
	"time"
)

func TestH2HPACKRFC7541(t *testing.T) {
	// Independent published first-request vectors, C.3.1 and C.4.1.
	for _, vector := range []string{"828684410f7777772e6578616d706c652e636f6d", "828684418cf1e3c2e5f23a6ba0ab90f4ff"} {
		block, err := hex.DecodeString(vector)
		if err != nil {
			t.Fatal(err)
		}
		now := time.Unix(1, 0)
		o := newH2FrameObserver(now)
		o.feed(append(initialSettingsWire(nil), frameWire(1, 4, 1, block)...), now)
		if o.status != "headers_observed" || !reflect.DeepEqual(o.pseudoHeaders, []string{":method", ":scheme", ":path", ":authority"}) || o.block != nil {
			t.Fatalf("RFC vector: status=%s reason=%s order=%v", o.status, o.reason, o.pseudoHeaders)
		}
	}
}

func encodeFields(t *testing.T, fields []hpack.HeaderField) []byte {
	t.Helper()
	var b bytes.Buffer
	e := hpack.NewEncoder(&b)
	for _, f := range fields {
		if err := e.WriteField(f); err != nil {
			t.Fatal(err)
		}
	}
	return b.Bytes()
}

func TestH2HPACKContinuation(t *testing.T) {
	now := time.Unix(1, 0)
	block := encodeFields(t, []hpack.HeaderField{{Name: ":method", Value: "GET"}, {Name: ":authority", Value: "localhost"}, {Name: ":scheme", Value: "https"}, {Name: ":path", Value: "/health"}, {Name: "x-test", Value: "repeated-value"}, {Name: "x-test", Value: "repeated-value"}})
	want := []string{":method", ":authority", ":scheme", ":path"}
	// Every HPACK split, including inside Huffman strings and indexed fields.
	for split := 0; split <= len(block); split++ {
		wire := initialSettingsWire(nil)
		wire = append(wire, frameWire(1, 0, 1, block[:split])...)
		wire = append(wire, frameWire(9, 0, 1, nil)...)
		wire = append(wire, frameWire(9, 4, 1, block[split:])...)
		o := newH2FrameObserver(now)
		for _, b := range wire {
			o.feed([]byte{b}, now)
		}
		if o.status != "headers_observed" || !reflect.DeepEqual(o.pseudoHeaders, want) || o.block != nil {
			t.Fatalf("split %d: status=%s reason=%s pseudo=%v", split, o.status, o.reason, o.pseudoHeaders)
		}
		for cut := len(initialSettingsWire(nil)); cut < len(wire); cut++ {
			p := newH2FrameObserver(now)
			p.feed(wire[:cut], now)
			p.end()
			if p.status != "incomplete" || p.pseudoHeaders != nil || p.block != nil {
				t.Fatalf("cut %d exposed unfinished headers", cut)
			}
		}
	}
}

func TestH2HPACKInvalidAndLimits(t *testing.T) {
	field := func(n, v string) hpack.HeaderField { return hpack.HeaderField{Name: n, Value: v} }
	for _, tc := range []struct {
		name           string
		block          []byte
		status, reason string
	}{
		{"bad_index", []byte{0xff, 0xff, 0xff, 0x7f}, "invalid", "hpack_decode"},
		{"truncated_literal", []byte{0x40}, "invalid", "hpack_truncated"},
		{"table_size", []byte{0x3f, 0xe2, 0x1f}, "invalid", "hpack_decode"}, // 4097 > allowed 4096.
		{"missing", nil, "incomplete", "missing_pseudo_headers"},
		{"duplicate", encodeFields(t, []hpack.HeaderField{field(":method", "GET"), field(":method", "GET")}), "invalid", "pseudo_header_order"},
		{"late_pseudo", encodeFields(t, []hpack.HeaderField{field("x-a", "v"), field(":method", "GET")}), "invalid", "pseudo_header_order"},
		{"unknown_pseudo", encodeFields(t, []hpack.HeaderField{field(":unknown", "v")}), "invalid", "pseudo_header_name"},
		{"long_string", encodeFields(t, []hpack.HeaderField{field(":method", "GET"), field("x-a", strings.Repeat("v", 8193))}), "incomplete", "header_string_limit"},
		{"count", bytes.Repeat([]byte{0x90}, 129), "incomplete", "header_list_limit"}, // static regular header repeated.
		{"decoded_size", encodeFields(t, []hpack.HeaderField{field(":method", "GET"), field("x-a", strings.Repeat("v", 8192)), field("x-b", strings.Repeat("v", 8192))}), "incomplete", "header_list_limit"},
		{"compressed_size", bytes.Repeat([]byte{0x90}, h2HeaderBlockLimit+1), "incomplete", "header_block_limit"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			now := time.Unix(1, 0)
			o := newH2FrameObserver(now)
			o.feed(append(initialSettingsWire(nil), frameWire(1, 4, 1, tc.block)...), now)
			if o.status != tc.status || o.reason != tc.reason || o.block != nil || o.pseudoHeaders != nil {
				t.Fatalf("status=%s reason=%s block=%d pseudo=%v", o.status, o.reason, len(o.block), o.pseudoHeaders)
			}
		})
	}
}

func TestH2ContinuationSequence(t *testing.T) {
	now := time.Unix(1, 0)
	for _, frame := range [][]byte{frameWire(9, 4, 3, []byte{0x84}), frameWire(8, 0, 0, []byte{0, 0, 0, 1}), frameWire(1, 4, 3, []byte{0x84})} {
		o := newH2FrameObserver(now)
		b := append(initialSettingsWire(nil), frameWire(1, 0, 1, []byte{0x82})...)
		b = append(b, frame...)
		o.feed(b, now)
		if o.status != "invalid" || o.reason != "continuation_sequence" || o.block != nil {
			t.Fatalf("%s %s", o.status, o.reason)
		}
	}
	o := newH2FrameObserver(now)
	o.feed(append(initialSettingsWire(nil), frameWire(1, 0, 1, []byte{0x82})...), now)
	o.feed(nil, now.Add(2*time.Second))
	if o.reason != "timeout" || o.block != nil {
		t.Fatal("timeout cleanup")
	}
}
