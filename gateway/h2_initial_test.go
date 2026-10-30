package main

import (
	"encoding/binary"
	"reflect"
	"testing"
	"time"
)

func initialSettingsWire(settings []h2Setting) []byte {
	b := append([]byte(h2ClientPreface), make([]byte, 9)...)
	n := len(settings) * 6
	b[24], b[25], b[26], b[27] = byte(n>>16), byte(n>>8), byte(n), 4
	for _, s := range settings {
		pair := make([]byte, 6)
		binary.BigEndian.PutUint16(pair, s.ID)
		binary.BigEndian.PutUint32(pair[2:], s.Value)
		b = append(b, pair...)
	}
	return b
}

func TestH2InitialFragmentation(t *testing.T) {
	now := time.Unix(1, 0)
	want := []h2Setting{{1, 65536}, {2, 0}, {4, 6291456}, {6, 262144}}
	wire := initialSettingsWire(want)
	// Every two-chunk boundary includes splits in the preface, header and values.
	for split := 0; split <= len(wire); split++ {
		p := newH2InitialParser(now)
		p.feed(wire[:split], now)
		p.feed(wire[split:], now)
		if p.status != "settings_observed" || !reflect.DeepEqual(p.settings, want) {
			t.Fatalf("split %d: status=%s settings=%v", split, p.status, p.settings)
		}
	}
	p := newH2InitialParser(now)
	for _, b := range wire {
		p.feed([]byte{b}, now)
	}
	if !reflect.DeepEqual(p.settings, want) {
		t.Fatal("one-byte chunks lost settings")
	}
}

func TestH2InitialWireSemantics(t *testing.T) {
	now := time.Unix(1, 0)
	want := []h2Setting{{0xffff, 7}, {2, 0}, {1, 100}, {1, 200}}
	wire := initialSettingsWire(want)
	wire[29] = 0x80 // Reserved stream-ID bit must be ignored.
	p := newH2InitialParser(now)
	input := append(append([]byte{}, wire...), []byte("later frames not consumed")...)
	if n := p.feed(input, now); n != len(wire) {
		t.Fatalf("consumed %d", n)
	}
	if !reflect.DeepEqual(p.settings, want) {
		t.Fatalf("wire order/duplicates/unknown/zero lost: %v", p.settings)
	}
	p.end()
	if p.status != "settings_observed" || p.feed(input, now) != 0 {
		t.Fatal("terminal state changed")
	}
	p = newH2InitialParser(now)
	p.feed(initialSettingsWire(nil), now)
	if p.status != "settings_observed" || p.settings == nil || len(p.settings) != 0 {
		t.Fatal("empty settings must be observed, not missing")
	}
}

func TestH2InitialInvalid(t *testing.T) {
	for _, tc := range []struct {
		name   string
		mutate func([]byte)
		reason string
	}{
		{"preface", func(b []byte) { b[0] = 'X' }, "preface"},
		{"wrong_frame", func(b []byte) { b[27] = 1 }, "initial_settings_header"},
		{"ack", func(b []byte) { b[28] = 1 }, "initial_settings_header"},
		{"stream", func(b []byte) { b[32] = 1 }, "initial_settings_header"},
		{"length", func(b []byte) { b[26] = 5 }, "initial_settings_header"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			now := time.Unix(1, 0)
			p := newH2InitialParser(now)
			b := initialSettingsWire([]h2Setting{{1, 1}})
			tc.mutate(b)
			p.feed(b, now)
			if p.status != "invalid" || p.reason != tc.reason || p.settings != nil {
				t.Fatalf("%+v", p)
			}
		})
	}
	for _, s := range []h2Setting{{2, 2}, {4, 0x80000000}, {5, 16383}, {5, 16777216}} {
		p := newH2InitialParser(time.Time{})
		p.feed(initialSettingsWire([]h2Setting{{1, 1}, s}), time.Time{})
		if p.reason != "settings_value" || p.settings != nil {
			t.Fatalf("invalid %v exposed partial data", s)
		}
	}
}

func TestH2InitialMissingAndLimits(t *testing.T) {
	now := time.Unix(1, 0)
	wire := initialSettingsWire([]h2Setting{{1, 1}, {2, 0}})
	for cut := 0; cut < len(wire); cut++ {
		p := newH2InitialParser(now)
		p.feed(wire[:cut], now)
		p.end()
		if p.status != "incomplete" || p.reason != "read_ended" || p.settings != nil {
			t.Fatalf("cut %d exposed partial data", cut)
		}
	}
	p := newH2InitialParser(now)
	p.feed(wire[:10], now)
	p.feed(wire[10:], now.Add(h2InitialTimeout))
	if p.reason != "timeout" || p.settings != nil {
		t.Fatal("deadline not enforced")
	}
	p = newH2InitialParser(now)
	p.feed(nil, now.Add(h2InitialTimeout))
	if p.reason != "timeout" {
		t.Fatal("idle deadline check failed")
	}
	p = newH2InitialParser(now)
	p.feed(initialSettingsWire(make([]h2Setting, 65)), now)
	if p.reason != "settings_limit" || p.settings != nil {
		t.Fatal("settings cap not enforced")
	}
	p = newH2InitialParser(now)
	p.feed(initialSettingsWire(make([]h2Setting, 64)), now)
	if p.status != "settings_observed" || len(p.settings) != 64 {
		t.Fatal("exact settings cap rejected")
	}
	b := initialSettingsWire(nil)
	b[24], b[25], b[26] = 0, 0xff, 0xfc // 65532-byte payload, multiple of six.
	p = newH2InitialParser(now)
	p.feed(b, now)
	if p.reason != "byte_limit" || p.settings != nil {
		t.Fatal("large declared length not bounded")
	}
}
