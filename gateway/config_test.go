package main

import (
	"strings"
	"testing"
)

func TestGatewayConfig(t *testing.T) {
	cfg, err := readGatewayConfig(func(string) string { return "" })
	if err != nil || cfg.listen != "127.0.0.1:8443" || cfg.upstream.String() != "http://127.0.0.1:3000" {
		t.Fatalf("native defaults: %#v %v", cfg, err)
	}
	for _, origin := range []string{"http://127.0.0.1:13000", "http://[::1]:13000/"} {
		t.Run(origin, func(t *testing.T) {
			cfg, err := readGatewayConfig(func(key string) string {
				if key == "DACN2_UPSTREAM_URL" {
					return origin
				}
				return "127.0.0.1:18443"
			})
			if err != nil || cfg.listen != "127.0.0.1:18443" || cfg.upstream.String() != origin {
				t.Fatalf("lab config: %#v %v", cfg, err)
			}
		})
	}
	for _, origin := range []string{
		"http://192.168.1.2:3000", "http://example.com:3000", "http://localhost:3000",
		"https://127.0.0.1:3000", "http://secret:PRIVATE@127.0.0.1:3000",
		"http://127.0.0.1:3000/path", "http://127.0.0.1:3000/?PRIVATE", "http://127.0.0.1:3000?",
		"http://127.0.0.1:3000/#PRIVATE", "http://127.0.0.1", "http://127.0.0.1:0", "http://127.0.0.1:65536", "://PRIVATE",
	} {
		t.Run(origin, func(t *testing.T) {
			_, err := readGatewayConfig(func(key string) string {
				if key == "DACN2_UPSTREAM_URL" {
					return origin
				}
				return ""
			})
			if err == nil || strings.Contains(err.Error(), "PRIVATE") {
				t.Fatalf("invalid origin must be rejected without exposing its value: %v", err)
			}
		})
	}
	for _, listen := range []string{"0.0.0.0:8443", ":8443", "localhost:8443", "[::]:8443", "127.0.0.1:0", "127.0.0.1:65536"} {
		_, err := readGatewayConfig(func(key string) string {
			if key == "DACN2_LISTEN_ADDR" {
				return listen
			}
			return ""
		})
		if err == nil {
			t.Fatalf("unsafe listener accepted: %s", listen)
		}
	}
}
