package main

import (
	"strings"
	"testing"
)

func chromeAkamaiObservation() h2ObservationResult {
	w := uint32(15663105)
	return h2ObservationResult{Status: "headers_observed", Settings: []h2Setting{{1, 65536}, {2, 0}, {4, 6291456}, {6, 262144}}, WindowIncrement: &w, Priorities: []h2Priority{}, HeadersPriority: &h2Priority{1, true, 0, 256}, PseudoHeaders: []string{":method", ":authority", ":scheme", ":path"}}
}

func TestAkamaiFixtures(t *testing.T) {
	r := chromeAkamaiObservation()
	f, reason := makeAkamai(r)
	if reason != "" || f == nil || f.Text != "1:65536;2:0;4:6291456;6:262144|15663105|0|m,a,s,p" || f.MD5 != "52d84b11737d980aef856699f885ca86" {
		t.Fatalf("Chrome fixture: %+v %s", f, reason)
	}
	t.Logf("Chrome baseline: %s md5=%s", f.Text, f.MD5)
	// Paper's Firefox example, including five standalone PRIORITY frames.
	w := uint32(12517377)
	r.WindowIncrement = &w
	r.Settings = []h2Setting{{1, 65536}, {4, 131072}, {5, 16384}}
	r.Priorities = []h2Priority{{3, false, 0, 201}, {5, false, 0, 101}, {7, false, 0, 1}, {9, false, 7, 1}, {11, false, 3, 1}}
	r.PseudoHeaders = []string{":method", ":path", ":authority", ":scheme"}
	f, reason = makeAkamai(r)
	if reason != "" || f == nil || f.Text != "1:65536;4:131072;5:16384|12517377|3:0:0:201,5:0:0:101,7:0:0:1,9:0:7:1,11:0:3:1|m,p,a,s" || f.MD5 != "b151efdd3ac38eb07621c822c1852a27" {
		t.Fatalf("Firefox fixture: %+v %s", f, reason)
	}
	// Hash expectations calculated independently with Node crypto; not recomputed
	// by the Go function under test. Capture/external same-session hash still pending.
}

func TestAkamaiWireOrderAndPriority(t *testing.T) {
	r := chromeAkamaiObservation()
	r.Settings = []h2Setting{{43690, 0}, {1, 1}, {1, 2}}
	r.Priorities = []h2Priority{{5, true, 0, 256}, {3, false, 5, 1}}
	f, _ := makeAkamai(r)
	if f == nil || f.Text != "43690:0;1:1;1:2|15663105|5:1:0:256,3:0:5:1|m,a,s,p" {
		t.Fatalf("order/duplicates/unknown/weight: %+v", f)
	}
	r.HeadersPriority = nil
	other, _ := makeAkamai(r)
	if other == nil || *f != *other {
		t.Fatal("HEADERS metadata must not become a PRIORITY tuple")
	}
	r.Settings = []h2Setting{}
	empty, _ := makeAkamai(r)
	if empty == nil || !strings.HasPrefix(empty.Text, "|15663105|") {
		t.Fatal("observed empty settings must be distinct from missing")
	}
	r = chromeAkamaiObservation()
	first, _ := makeAkamai(r)
	r.PseudoHeaders = []string{":authority", ":method", ":path", ":scheme"}
	second, _ := makeAkamai(r)
	if first.MD5 == second.MD5 || !strings.HasSuffix(second.Text, "|a,m,p,s") {
		t.Fatal("pseudo order lost")
	}
}

func TestAkamaiMissingAndInvalid(t *testing.T) {
	for _, tc := range []struct {
		name, reason string
		change       func(*h2ObservationResult)
	}{
		{"timeout", "observation_not_complete", func(r *h2ObservationResult) { r.Status = "incomplete" }},
		{"invalid", "observation_not_complete", func(r *h2ObservationResult) { r.Status = "invalid" }},
		{"unavailable", "observation_not_complete", func(r *h2ObservationResult) { r.Status = "observation_unavailable" }},
		{"settings", "missing_settings", func(r *h2ObservationResult) { r.Settings = nil }},
		{"window", "missing_window_update", func(r *h2ObservationResult) { r.WindowIncrement = nil }},
		{"window_zero", "invalid_window_update", func(r *h2ObservationResult) { w := uint32(0); r.WindowIncrement = &w }},
		{"window_reserved", "invalid_window_update", func(r *h2ObservationResult) { w := uint32(0x80000000); r.WindowIncrement = &w }},
		{"priorities", "missing_priority_observation", func(r *h2ObservationResult) { r.Priorities = nil }},
		{"extended", "unsupported_pseudo_headers", func(r *h2ObservationResult) { r.PseudoHeaders[0] = ":protocol" }},
		{"missing_pseudo", "unsupported_pseudo_headers", func(r *h2ObservationResult) { r.PseudoHeaders = nil }},
		{"duplicate_pseudo", "unsupported_pseudo_headers", func(r *h2ObservationResult) { r.PseudoHeaders[0] = ":path" }},
		{"partial_connect", "unsupported_pseudo_headers", func(r *h2ObservationResult) { r.PseudoHeaders = r.PseudoHeaders[:2] }},
		{"bad_priority", "invalid_priority", func(r *h2ObservationResult) { r.Priorities = []h2Priority{{1, false, 1, 1}} }},
		{"bad_weight", "invalid_priority", func(r *h2ObservationResult) { r.Priorities = []h2Priority{{1, false, 0, 0}} }},
		{"settings_cap", "observation_limit", func(r *h2ObservationResult) { r.Settings = make([]h2Setting, 65) }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := chromeAkamaiObservation()
			tc.change(&r)
			f, reason := makeAkamai(r)
			if f != nil || reason != tc.reason {
				t.Fatalf("fingerprint=%+v reason=%s", f, reason)
			}
		})
	}
}
