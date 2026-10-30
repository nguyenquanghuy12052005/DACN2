package main

import (
	"crypto/md5" // Interoperable fingerprint label only, never authentication.
	"fmt"
	"strconv"
	"strings"
)

type h2AkamaiFingerprint struct {
	Format string `json:"format"`
	Text   string `json:"text"`
	MD5    string `json:"md5"`
}

// Four-field serialization, compatible with TrackMe's numeric SETTINGS and
// standalone PRIORITY representation. HEADERS priority is deliberately separate.
// Missing observations are withheld, not replaced by protocol-default values.
func makeAkamai(r h2ObservationResult) (*h2AkamaiFingerprint, string) {
	if r.Status != "headers_observed" {
		return nil, "observation_not_complete"
	}
	if r.Settings == nil {
		return nil, "missing_settings"
	}
	if r.WindowIncrement == nil {
		return nil, "missing_window_update"
	}
	if *r.WindowIncrement == 0 || *r.WindowIncrement > 0x7fffffff {
		return nil, "invalid_window_update"
	}
	if r.Priorities == nil {
		return nil, "missing_priority_observation"
	}
	if len(r.Settings) > h2InitialSettingsLimit || len(r.Priorities) >= h2ObservationFrameLimit {
		return nil, "observation_limit"
	}
	// This version supports the four ordinary request pseudo-headers only.
	// Extended CONNECT/:protocol or partial sets keep metadata but get no hash.
	if len(r.PseudoHeaders) != 4 {
		return nil, "unsupported_pseudo_headers"
	}
	codes := make([]string, 0, 4)
	seen := map[string]bool{}
	for _, name := range r.PseudoHeaders {
		if seen[name] {
			return nil, "unsupported_pseudo_headers"
		}
		seen[name] = true
		switch name {
		case ":method":
			codes = append(codes, "m")
		case ":authority":
			codes = append(codes, "a")
		case ":scheme":
			codes = append(codes, "s")
		case ":path":
			codes = append(codes, "p")
		default:
			return nil, "unsupported_pseudo_headers"
		}
	}
	settings := make([]string, 0, len(r.Settings))
	for _, s := range r.Settings {
		settings = append(settings, strconv.FormatUint(uint64(s.ID), 10)+":"+strconv.FormatUint(uint64(s.Value), 10))
	}
	priorities := make([]string, 0, len(r.Priorities))
	for _, p := range r.Priorities {
		if p.StreamID == 0 || p.StreamID > 0x7fffffff || p.Dependency > 0x7fffffff || p.Dependency == p.StreamID || p.Weight < 1 || p.Weight > 256 {
			return nil, "invalid_priority"
		}
		exclusive := 0
		if p.Exclusive {
			exclusive = 1
		}
		priorities = append(priorities, fmt.Sprintf("%d:%d:%d:%d", p.StreamID, exclusive, p.Dependency, p.Weight))
	}
	priorityText := "0"
	if len(priorities) > 0 {
		priorityText = strings.Join(priorities, ",")
	}
	text := strings.Join(settings, ";") + "|" + strconv.FormatUint(uint64(*r.WindowIncrement), 10) + "|" + priorityText + "|" + strings.Join(codes, ",")
	return &h2AkamaiFingerprint{Format: "akamai-h2-four-field-v1", Text: text, MD5: fmt.Sprintf("%x", md5.Sum([]byte(text)))}, ""
}
