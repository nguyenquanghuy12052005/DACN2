package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestBrowserLabConfig(t *testing.T) {
	cfg, err := readBrowserLabConfig(func(string) string { return "" })
	if err != nil || cfg != nil {
		t.Fatal("must be disabled by default")
	}
	_, err = readBrowserLabConfig(func(k string) string {
		if k == "DACN2_BROWSER_ORIGIN" {
			return "http://evil.test"
		}
		return "PRIVATE"
	})
	if err == nil || strings.Contains(err.Error(), "PRIVATE") {
		t.Fatal("unsafe config exposed or accepted")
	}
}
func TestBrowserLabBoundary(t *testing.T) {
	token := strings.Repeat("a", 64)
	cfg := &browserLabConfig{origin: "http://127.0.0.1:5173", token: token, ids: map[string]bool{"61": true}}
	calls := 0
	handler := browserLabHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-DACN2-Session") != "" {
			t.Error("lab session token forwarded upstream")
		}
		calls++
		if r.Method == "POST" {
			b, _ := io.ReadAll(r.Body)
			if string(b) != `{"studentCode":"DEMO001"}` {
				t.Error("body changed")
			}
		}
		w.Header().Set("X-Request-ID", "test-id")
		w.WriteHeader(201)
	}), cfg)
	for _, tc := range []struct {
		name, method, path, origin, session, preflight, headers, body string
		want                                                          int
	}{
		{"valid", "POST", "/courses/61/registrations", cfg.origin, token, "", "", `{"studentCode":"DEMO001"}`, 201},
		{"foreign", "POST", "/courses/61/registrations", "http://evil.test", token, "", "", "{}", 403},
		{"missingOrigin", "POST", "/courses/61/registrations", "", token, "", "", "{}", 403},
		{"missingSession", "POST", "/courses/61/registrations", cfg.origin, "", "", "", "{}", 403},
		{"unowned", "POST", "/courses/99/registrations", cfg.origin, token, "", "", "{}", 404},
		{"invalid", "POST", "/courses/61/registrations", cfg.origin, token, "", "", "{\"studentCode\":123}", 400},
		{"big", "POST", "/courses/61/registrations", cfg.origin, token, "", "", strings.Repeat("x", 1025), 413},
		{"preflight", "OPTIONS", "/courses/61/registrations", cfg.origin, "", "POST", "content-type,x-dacn2-session", "", 204},
		{"badHeader", "OPTIONS", "/courses/61/registrations", cfg.origin, "", "POST", "authorization", "", 403},
		{"badMethod", "OPTIONS", "/courses", cfg.origin, "", "DELETE", "x-dacn2-session", "", 403},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body))
			r.Header.Set("Origin", tc.origin)
			r.Header.Set("X-DACN2-Session", tc.session)
			r.Header.Set("Content-Type", "application/json")
			r.Header.Set("Access-Control-Request-Method", tc.preflight)
			r.Header.Set("Access-Control-Request-Headers", tc.headers)
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, r)
			if w.Code != tc.want {
				t.Fatalf("got%d want%d %s", w.Code, tc.want, w.Body.String())
			}
			if w.Header().Get("Access-Control-Allow-Credentials") != "" {
				t.Fatal("credentials not allowed")
			}
			if tc.origin == cfg.origin && w.Header().Get("Access-Control-Allow-Origin") != cfg.origin {
				t.Fatal("missing exact origin")
			}
			if tc.name == "valid" && !strings.Contains(w.Header().Get("Access-Control-Expose-Headers"), "X-Request-ID") {
				t.Fatal("request id not exposed")
			}
		})
	}
	if calls != 1 {
		t.Fatalf("refused requests reached backend: %d", calls)
	}
}
