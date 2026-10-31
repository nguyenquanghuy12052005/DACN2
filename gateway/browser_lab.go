package main

import (
	"bytes"
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"
)

// Opt-in local browser lab boundary. Disabled for existing native/K3s workflows.
// CORS is not authentication: the Windows account and local processes are trusted.
type browserLabConfig struct {
	origin, token string
	ids           map[string]bool
}

var decimalID = regexp.MustCompile(`^[1-9][0-9]{0,15}$`)
var participantCode = regexp.MustCompile(`^[A-Za-z0-9_-]{1,30}$`)

func readBrowserLabConfig(getenv func(string) string) (*browserLabConfig, error) {
	origin, token, ids := getenv("DACN2_BROWSER_ORIGIN"), getenv("DACN2_BROWSER_TOKEN"), getenv("DACN2_BROWSER_COURSE_IDS")
	if origin == "" && token == "" && ids == "" {
		return nil, nil
	}
	if origin != "http://127.0.0.1:5173" || !regexp.MustCompile(`^[a-f0-9]{64}$`).MatchString(token) {
		return nil, fmt.Errorf("invalid browser lab origin/session configuration")
	}
	cfg := &browserLabConfig{origin: origin, token: token, ids: make(map[string]bool)}
	for _, id := range strings.Split(ids, ",") {
		if !decimalID.MatchString(id) {
			return nil, fmt.Errorf("invalid browser lab fixture configuration")
		}
		cfg.ids[id] = true
	}
	if len(cfg.ids) == 0 || len(cfg.ids) > 10 {
		return nil, fmt.Errorf("invalid browser lab fixture count")
	}
	return cfg, nil
}
func browserLabHandler(next http.Handler, cfg *browserLabConfig) http.Handler {
	if cfg == nil {
		return next
	}
	var mu sync.Mutex
	var start time.Time
	count := 0
	slots := make(chan struct{}, 8)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		deny := func(status int, code string) {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Cache-Control", "no-store")
			w.WriteHeader(status)
			_ = json.NewEncoder(w).Encode(map[string]any{"statusCode": status, "code": code, "message": "Local browser lab request refused"})
		}
		origin := r.Header.Get("Origin")
		w.Header().Add("Vary", "Origin")
		if origin != "" && origin != cfg.origin {
			deny(403, "LAB_ORIGIN_REFUSED")
			return
		}
		if origin == cfg.origin {
			w.Header().Set("Access-Control-Allow-Origin", cfg.origin)
			w.Header().Set("Access-Control-Expose-Headers", "X-Request-ID, X-DACN2-Connection-ID, X-DACN2-Protocol")
		}
		path := r.URL.Path
		if origin == "" && (path == "/health" || path == "/gateway/health") && r.Method == http.MethodGet {
			next.ServeHTTP(w, r)
			return
		}
		parts := strings.Split(path, "/")
		courseRead := path == "/courses"
		registration := len(parts) == 4 && parts[0] == "" && parts[1] == "courses" && cfg.ids[parts[2]] && parts[3] == "registrations"
		if !courseRead && !registration {
			deny(404, "LAB_ROUTE_REFUSED")
			return
		}
		if r.URL.RawQuery != "" || origin != cfg.origin {
			deny(403, "LAB_ORIGIN_REQUIRED")
			return
		}
		expected := http.MethodGet
		if registration {
			expected = http.MethodPost
		}
		if r.Method == http.MethodOptions {
			w.Header().Add("Vary", "Access-Control-Request-Method")
			w.Header().Add("Vary", "Access-Control-Request-Headers")
			if r.Header.Get("Access-Control-Request-Method") != expected {
				deny(403, "LAB_PREFLIGHT_REFUSED")
				return
			}
			for _, header := range strings.Split(r.Header.Get("Access-Control-Request-Headers"), ",") {
				header = strings.ToLower(strings.TrimSpace(header))
				if header != "content-type" && header != "x-dacn2-session" {
					deny(403, "LAB_PREFLIGHT_REFUSED")
					return
				}
			}
			w.Header().Set("Access-Control-Allow-Methods", expected)
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-DACN2-Session")
			w.Header().Set("Access-Control-Max-Age", "60")
			w.WriteHeader(http.StatusNoContent)
			return
		}
		if r.Method != expected {
			deny(405, "LAB_METHOD_REFUSED")
			return
		}
		if subtle.ConstantTimeCompare([]byte(r.Header.Get("X-DACN2-Session")), []byte(cfg.token)) != 1 {
			deny(403, "LAB_SESSION_REFUSED")
			return
		}
		mu.Lock()
		if time.Since(start) >= 10*time.Second {
			start = time.Now()
			count = 0
		}
		count++
		limited := count > 30
		mu.Unlock()
		if limited {
			deny(429, "LAB_ACTION_LIMIT")
			return
		}
		select {
		case slots <- struct{}{}:
			defer func() { <-slots }()
		default:
			deny(429, "LAB_CONCURRENCY_LIMIT")
			return
		}
		if registration {
			if strings.TrimSpace(strings.Split(r.Header.Get("Content-Type"), ";")[0]) != "application/json" {
				deny(415, "LAB_JSON_REQUIRED")
				return
			}
			_ = http.NewResponseController(w).SetReadDeadline(time.Now().Add(4 * time.Second))
			body, err := io.ReadAll(io.LimitReader(r.Body, 1025))
			_ = http.NewResponseController(w).SetReadDeadline(time.Time{})
			if err != nil || len(body) > 1024 {
				deny(413, "LAB_BODY_LIMIT")
				return
			}
			var payload map[string]json.RawMessage
			var code string
			if json.Unmarshal(body, &payload) != nil || len(payload) != 1 || json.Unmarshal(payload["studentCode"], &code) != nil || !participantCode.MatchString(code) {
				deny(400, "LAB_INVALID_CODE")
				return
			}
			r.Body = io.NopCloser(bytes.NewReader(body))
		}
		w.Header().Set("X-DACN2-Protocol", r.Proto)
		if id, ok := r.Context().Value(connectionIDKey).(uint64); ok {
			w.Header().Set("X-DACN2-Connection-ID", fmt.Sprint(id))
		}
		r.Header.Del("X-DACN2-Session")
		next.ServeHTTP(w, r)
	})
}
