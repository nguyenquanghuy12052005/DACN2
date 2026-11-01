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
				if key == "DACN2_LISTEN_ADDR" {
					return "127.0.0.1:18443"
				}
				return ""
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

func TestGatewayComposeTeamConfig(t *testing.T) {
	read := func(mode, listen, upstream string) (gatewayConfig, error) {
		values := map[string]string{
			"DACN2_NETWORK_MODE": mode,
			"DACN2_LISTEN_ADDR":  listen,
			"DACN2_UPSTREAM_URL": upstream,
		}
		return readGatewayConfig(func(key string) string { return values[key] })
	}
	for _, origin := range []string{"http://backend:3000", "http://backend:3000/"} {
		cfg, err := read("compose-team", "0.0.0.0:8443", origin)
		if err != nil || cfg.listen != "0.0.0.0:8443" || cfg.upstream.String() != origin {
			t.Fatalf("compose config: %#v %v", cfg, err)
		}
	}
	cfg, err := read("compose-team", "", "")
	if err != nil || cfg.listen != "127.0.0.1:8443" || cfg.upstream.String() != "http://127.0.0.1:3000" {
		t.Fatalf("opt-in must not silently change defaults: %#v %v", cfg, err)
	}
	for _, mode := range []string{"", "PRIVATE", "COMPOSE-TEAM", "compose-team "} {
		_, err := read(mode, "0.0.0.0:8443", "http://backend:3000")
		if err == nil || strings.Contains(err.Error(), "PRIVATE") {
			t.Fatalf("mode must refuse compose endpoints without leaking values: %v", err)
		}
	}
	// Each compose exception requires opt-in, independently of the other one.
	for _, pair := range [][2]string{{"0.0.0.0:8443", ""}, {"", "http://backend:3000"}} {
		if _, err := read("", pair[0], pair[1]); err == nil {
			t.Fatalf("native mode accepted compose endpoint: %v", pair)
		}
	}
	for _, listen := range []string{"0.0.0.0:8444", ":8443", "[::]:8443", "192.168.1.2:8443", "localhost:8443"} {
		if _, err := read("compose-team", listen, "http://backend:3000"); err == nil {
			t.Fatalf("compose accepted unapproved listener: %s", listen)
		}
	}
	for _, origin := range []string{
		"http://example.com:3000", "http://192.168.1.2:3000", "http://backend:3001",
		"http://backend", "http://backend.evil:3000", "https://backend:3000",
		"http://secret:PRIVATE@backend:3000", "http://backend:3000/path",
		"http://backend:3000/?PRIVATE", "http://backend:3000?", "http://backend:3000/#PRIVATE",
	} {
		_, err := read("compose-team", "0.0.0.0:8443", origin)
		if err == nil || strings.Contains(err.Error(), "PRIVATE") {
			t.Fatalf("compose must refuse unapproved origins without exposing values: %v", err)
		}
	}
}
