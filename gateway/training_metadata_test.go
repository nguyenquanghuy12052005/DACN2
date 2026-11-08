package main

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"
)

func TestTrainingQueryPrivacyAndUpstreamEOF(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		w.(http.Flusher).Flush()
		time.Sleep(35 * time.Millisecond)
		_, _ = w.Write([]byte("done"))
	}))
	defer upstream.Close()
	u, _ := url.Parse(upstream.URL)
	var events []gatewayRequestEvent
	g, err := newGatewayTelemetry(u, http.DefaultTransport, func(e gatewayRequestEvent) { events = append(events, e) })
	if err != nil {
		t.Fatal(err)
	}
	for _, query := range []string{"?secret=a", "?secret=b", "?secret=a"} {
		g.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/courses"+query, nil))
	}
	if *events[0].QueryHash != *events[2].QueryHash || *events[0].QueryHash == *events[1].QueryHash {
		t.Fatal("query equality lost")
	}
	if strings.Contains(*events[0].QueryHash, "secret") {
		t.Fatal("raw query leaked")
	}
	if events[0].UpstreamResponseMS == nil || *events[0].UpstreamResponseMS < 30 || *events[0].UpstreamHeadersMS >= *events[0].UpstreamResponseMS {
		t.Fatal("body latency missing")
	}
	other, _ := newGatewayTelemetry(u, http.DefaultTransport, func(e gatewayRequestEvent) {
		if *e.QueryHash == *events[0].QueryHash {
			t.Fatal("query key reused between instances")
		}
	})
	other.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/courses?secret=a", nil))
}

func TestTrainingAssetsAreOptInAndAuthenticated(t *testing.T) {
	u, _ := url.Parse("http://127.0.0.1:1")
	for _, enabled := range []bool{false, true} {
		var event gatewayRequestEvent
		g, _ := newGatewayTelemetry(u, http.DefaultTransport, func(e gatewayRequestEvent) { event = e })
		g.labContent = enabled
		cfg := &browserLabConfig{origin: "http://127.0.0.1:5173", token: strings.Repeat("a", 64), ids: map[string]bool{"1": true}, trafficLab: enabled}
		handler := browserLabHandler(g, cfg)
		r := httptest.NewRequest("GET", "/lab/assets/app.css", nil)
		r.Header.Set("Origin", cfg.origin)
		r.Header.Set("X-DACN2-Session", cfg.token)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		if enabled {
			if w.Code != 200 || !event.IsStatic || event.UpstreamAttempted || event.RouteKind != "gateway_local" {
				t.Fatal(w.Code, event)
			}
		} else if w.Code != 404 {
			t.Fatal("lab asset exposed outside traffic mode")
		}
		r.Header.Del("X-DACN2-Session")
		w = httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		if enabled && w.Code != 403 {
			t.Fatal("lab asset without token accepted")
		}
	}
}
