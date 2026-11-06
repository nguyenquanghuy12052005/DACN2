package main

import (
	"crypto/tls"
	"strings"
)

// GREASE v1 covers the parsed numeric ClientHello fields used by this lab.
// ALPN GREASE byte strings are outside this numeric definition.
func clientHelloHasGREASE(hello *tls.ClientHelloInfo) bool {
	for _, values := range [][]uint16{hello.CipherSuites, hello.Extensions, hello.SupportedVersions} {
		for _, value := range values {
			if isGREASE(value) {
				return true
			}
		}
	}
	for _, signature := range hello.SignatureSchemes {
		if isGREASE(uint16(signature)) {
			return true
		}
	}
	for _, group := range hello.SupportedCurves {
		if isGREASE(uint16(group)) {
			return true
		}
	}
	return false
}

// Persist a bounded family enum, never the original User-Agent.
func userAgentFamily(value string) string {
	if len(value) > 1024 {
		return "unknown"
	}
	switch {
	case strings.Contains(value, "Firefox/"):
		return "firefox"
	case strings.Contains(value, "Chrome/"), strings.Contains(value, "Chromium/"):
		return "chromium"
	case strings.Contains(value, "Safari/") && strings.Contains(value, "Version/"):
		return "safari"
	default:
		return "unknown"
	}
}
