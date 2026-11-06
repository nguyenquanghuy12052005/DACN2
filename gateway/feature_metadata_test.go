package main

import (
	"crypto/tls"
	"testing"
)

func TestFeatureMetadataNumericGREASEAndUA(t *testing.T) {
	for _, hello := range []*tls.ClientHelloInfo{
		{CipherSuites: []uint16{0x0a0a}},
		{Extensions: []uint16{0x1a1a}},
		{SupportedVersions: []uint16{0x2a2a}},
		{SupportedCurves: []tls.CurveID{tls.CurveID(0x3a3a)}},
		{SignatureSchemes: []tls.SignatureScheme{tls.SignatureScheme(0x4a4a)}},
	} {
		if !clientHelloHasGREASE(hello) {
			t.Fatal("numeric GREASE observation missed")
		}
	}
	if clientHelloHasGREASE(&tls.ClientHelloInfo{CipherSuites: []uint16{0x1301}}) {
		t.Fatal("ordinary cipher marked GREASE")
	}
	for input, want := range map[string]string{
		"Mozilla Chrome/156 Safari/537": "chromium",
		"Mozilla Firefox/145":           "firefox",
		"Version/18 Safari/605":         "safari",
		"PRIVATE unknown":               "unknown",
	} {
		if userAgentFamily(input) != want {
			t.Fatal("incorrect bounded UA family")
		}
	}
}
