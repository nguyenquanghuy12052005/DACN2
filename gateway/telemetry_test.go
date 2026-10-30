package main

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"testing"
	"testing/iotest"
	"time"
)

type testRoundTripper func(*http.Request) (*http.Response, error)

func (f testRoundTripper) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
func testProxyResponse(status int, body string) *http.Response {
	return &http.Response{StatusCode: status, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(body)), ContentLength: int64(len(body))}
}
func testTelemetry(t *testing.T, base http.RoundTripper) (*gatewayTelemetry, *[]gatewayRequestEvent) {
	t.Helper()
	target, _ := url.Parse("http://127.0.0.1:3000")
	events := []gatewayRequestEvent{}
	g, err := newGatewayTelemetry(target, base, func(e gatewayRequestEvent) { events = append(events, e) })
	if err != nil {
		t.Fatal(err)
	}
	return g, &events
}

func TestGatewayHealth(t *testing.T) {
	for _, method := range []string{"GET", "HEAD", "POST", "OPTIONS"} {
		t.Run(method, func(t *testing.T) {
			g, events := testTelemetry(t, testRoundTripper(func(*http.Request) (*http.Response, error) { t.Fatal("health called upstream"); return nil, nil }))
			r := httptest.NewRequest(method, "https://lab/gateway/health?secret=PRIVATE", nil)
			w := httptest.NewRecorder()
			g.ServeHTTP(w, r)
			status := 200
			if method != "GET" && method != "HEAD" {
				status = 405
				if w.Header().Get("Allow") != "GET, HEAD" {
					t.Fatal("Allow missing")
				}
			}
			if w.Code != status || len(*events) != 1 {
				t.Fatalf("status=%d events=%d", w.Code, len(*events))
			}
			e := (*events)[0]
			if e.UpstreamAttempted || e.UpstreamStatus != nil || e.Outcome != "gateway_local" || e.RouteKind != "gateway_local" || e.StatusCode == nil || *e.StatusCode != status || e.ResponseBytes != int64(w.Body.Len()) {
				t.Fatalf("%+v", e)
			}
			if method == "GET" && w.Body.String() != `{"status":"ok","service":"dacn2-gateway"}` {
				t.Fatal(w.Body.String())
			}
			if method == "HEAD" && (w.Body.Len() != 0 || w.Header().Get("Content-Length") == "") {
				t.Fatal("HEAD body/headers")
			}
		})
	}
	g, events := testTelemetry(t, testRoundTripper(func(*http.Request) (*http.Response, error) {
		return nil, &net.OpError{Op: "dial", Err: errors.New("PRIVATE")}
	}))
	for _, p := range []string{"/health", "/gateway/health/"} {
		w := httptest.NewRecorder()
		g.ServeHTTP(w, httptest.NewRequest("GET", "https://lab"+p, nil))
		e := (*events)[len(*events)-1]
		if w.Code != 502 || e.RouteKind != "upstream" || !e.UpstreamAttempted || e.UpstreamStatus != nil || e.ErrorCode == nil || *e.ErrorCode != "upstream_dial_error" {
			t.Fatalf("%+v", e)
		}
	}
}

func TestTelemetryIdentityAndPrivacy(t *testing.T) {
	var upstreamID string
	g, events := testTelemetry(t, testRoundTripper(func(r *http.Request) (*http.Response, error) {
		upstreamID = r.Header.Get("X-Request-ID")
		if strings.Contains(upstreamID, "PRIVATE") || r.Header.Get("X-Forwarded-For") != "192.0.2.9" || r.Header.Get("Forwarded") != "" || r.Header.Get("X-Real-IP") != "" || r.Header.Get("X-Forwarded-Host") != "" {
			t.Fatal("spoofed forwarding headers reached upstream")
		}
		response := testProxyResponse(201, "ok")
		response.Header.Set("X-Request-ID", "PRIVATE_backend")
		return response, nil
	}))
	r := httptest.NewRequest("POST", "https://lab/courses/PRIVATE_ID/registrations?studentCode=PRIVATE", strings.NewReader("PRIVATE_body"))
	r.RemoteAddr = "192.0.2.9:1234"
	for _, h := range []string{"X-Request-ID", "X-Forwarded-For", "Forwarded", "X-Real-IP", "X-Forwarded-Host", "User-Agent"} {
		r.Header.Set(h, "PRIVATE")
	}
	r.Header.Set("Connection", "X-Request-ID, X-Forwarded-For")
	r = r.WithContext(context.WithValue(r.Context(), connectionIDKey, uint64(7)))
	w := httptest.NewRecorder()
	g.ServeHTTP(w, r)
	e := (*events)[0]
	encoded, err := json.Marshal(e)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(encoded), "PRIVATE") || e.Route != "/courses/:id/registrations" || e.RequestID != upstreamID || e.RequestID != w.Header().Get("X-Request-ID") || len(e.RequestID) > 64 || e.ConnectionID == nil || *e.ConnectionID != 7 {
		t.Fatalf("unsafe/mismatched event: %s", encoded)
	}
	if e.LatencyMS < 0 || e.CompletedAt.Before(e.StartedAt) || e.CompletedAt.Location() != time.UTC || e.SchemaVersion != 1 || e.ResponseBytes != 2 {
		t.Fatalf("bad timing/schema/bytes: %+v", e)
	}
	var fields map[string]any
	_ = json.Unmarshal(encoded, &fields)
	if len(fields) != 18 {
		t.Fatalf("schema has %d fields", len(fields))
	}
}

func TestTelemetryRoutesAndPeers(t *testing.T) {
	for input, want := range map[string]string{"127.0.0.1:42": "127.0.0.1", "[2001:db8::1]:42": "2001:db8::1", "[::ffff:192.0.2.1]:42": "192.0.2.1", "[fe80::1%zone]:42": "fe80::1", "bad": "", "192.0.2.1": ""} {
		got := peerIP(input)
		if want == "" {
			if got != nil {
				t.Fatal(input)
			}
		} else if got == nil || *got != want {
			t.Fatal(input, got)
		}
	}
	for input, want := range map[string]string{"/health": "/health", "/courses": "/courses", "/courses/abc": "/courses/:id", "/courses/1/registrations": "/courses/:id/registrations", "/courses/1/other": "unknown", "/courses/": "unknown", "/PRIVATE": "unknown"} {
		if got := requestRoute(input); got != want {
			t.Fatal(input, got)
		}
	}
	g, events := testTelemetry(t, testRoundTripper(func(*http.Request) (*http.Response, error) { return testProxyResponse(200, ""), nil }))
	r := httptest.NewRequest("PRIVATE_METHOD", "https://lab/PRIVATE?PRIVATE", nil)
	r.RemoteAddr = "bad"
	g.ServeHTTP(httptest.NewRecorder(), r)
	e := (*events)[0]
	if e.Method != "OTHER" || e.ClientIP != nil || e.ClientIPSource != "unavailable" || e.ConnectionID != nil {
		t.Fatalf("%+v", e)
	}
}

func TestTelemetryUpstreamStatusAndErrors(t *testing.T) {
	for _, status := range []int{200, 400, 404, 409, 500} {
		g, events := testTelemetry(t, testRoundTripper(func(*http.Request) (*http.Response, error) { return testProxyResponse(status, "body"), nil }))
		g.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "https://lab/courses", nil))
		e := (*events)[0]
		if *e.StatusCode != status || *e.UpstreamStatus != status || e.ErrorCode != nil || e.Outcome != "upstream_response" || e.ResponseBytes != 4 {
			t.Fatalf("%+v", e)
		}
	}
	for _, tc := range []struct {
		name   string
		err    error
		cancel bool
		code   string
		status int
	}{
		{"timeout", context.DeadlineExceeded, false, "upstream_timeout", 502},
		{"dial", &net.OpError{Op: "dial", Err: errors.New("PRIVATE")}, false, "upstream_dial_error", 502},
		{"other", errors.New("PRIVATE"), false, "upstream_error", 502},
		{"canceled", context.Canceled, true, "client_canceled", 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			g, events := testTelemetry(t, testRoundTripper(func(*http.Request) (*http.Response, error) { return nil, tc.err }))
			r := httptest.NewRequest("GET", "https://lab/health", nil)
			if tc.cancel {
				ctx, cancel := context.WithCancel(r.Context())
				cancel()
				r = r.WithContext(ctx)
			}
			g.ServeHTTP(httptest.NewRecorder(), r)
			e := (*events)[0]
			if e.ErrorCode == nil || *e.ErrorCode != tc.code || e.UpstreamStatus != nil || !e.UpstreamAttempted {
				t.Fatalf("%+v", e)
			}
			if tc.status == 0 {
				if e.StatusCode != nil {
					t.Fatal("fabricated response")
				}
			} else if e.StatusCode == nil || *e.StatusCode != tc.status {
				t.Fatal("wrong status")
			}
		})
	}
}

func TestTelemetryAbortAndPanic(t *testing.T) {
	for _, value := range []any{http.ErrAbortHandler, "PRIVATE panic", map[string]string{"PRIVATE": "value"}} {
		g, events := testTelemetry(t, nil)
		func() {
			defer func() {
				if recover() != http.ErrAbortHandler {
					t.Error("panic recovery behavior changed")
				}
			}()
			g.observe(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(202)
				_, _ = w.Write([]byte("abc"))
				panic(value)
			})).ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "https://lab/health", nil))
		}()
		if len(*events) != 1 {
			t.Fatal("duplicate/missing event")
		}
		e := (*events)[0]
		want := "handler_panic"
		if value == http.ErrAbortHandler {
			want = "response_aborted"
		}
		if e.Outcome != want || *e.StatusCode != 202 || e.ResponseBytes != 3 {
			t.Fatalf("%+v", e)
		}
	}
	// Exercise ReverseProxy's real body-copy abort path after a committed200.
	g, events := testTelemetry(t, testRoundTripper(func(*http.Request) (*http.Response, error) {
		r := testProxyResponse(200, "")
		r.ContentLength = -1
		r.Body = io.NopCloser(io.MultiReader(strings.NewReader("abc"), iotest.ErrReader(errors.New("PRIVATE"))))
		return r, nil
	}))
	r := httptest.NewRequest("GET", "https://lab/health", nil)
	r = r.WithContext(context.WithValue(r.Context(), http.ServerContextKey, &http.Server{}))
	func() {
		defer func() {
			if recover() != http.ErrAbortHandler {
				t.Error("missing copy abort")
			}
		}()
		g.ServeHTTP(httptest.NewRecorder(), r)
	}()
	e := (*events)[0]
	if e.Outcome != "response_aborted" || *e.StatusCode != 200 || e.ResponseBytes != 3 {
		t.Fatalf("%+v", e)
	}
}

type shortResponseWriter struct{ header http.Header }

func (w *shortResponseWriter) Header() http.Header       { return w.header }
func (w *shortResponseWriter) WriteHeader(int)           {}
func (w *shortResponseWriter) Write([]byte) (int, error) { return 2, io.ErrShortWrite }
func TestTelemetryPartialWritesAndInformational(t *testing.T) {
	g, events := testTelemetry(t, nil)
	g.observe(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(103); _, _ = w.Write([]byte("abcdef")) })).ServeHTTP(&shortResponseWriter{make(http.Header)}, httptest.NewRequest("GET", "https://lab/health", nil))
	e := (*events)[0]
	if *e.StatusCode != 200 || e.ResponseBytes != 2 || e.Outcome != "response_aborted" {
		t.Fatalf("%+v", e)
	}
	g.observe(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { _, _ = w.Write([]byte("abcdef")) })).ServeHTTP(&shortResponseWriter{make(http.Header)}, httptest.NewRequest("HEAD", "https://lab/health", nil))
	if (*events)[1].ResponseBytes != 0 {
		t.Fatal("HEAD counted suppressed body")
	}
	target, _ := url.Parse("http://127.0.0.1:3000")
	if _, err := newGatewayTelemetryWithEntropy(target, nil, nil, iotest.ErrReader(errors.New("PRIVATE"))); err == nil {
		t.Fatal("randomness failure ignored")
	}
}

func TestTelemetryTLSProxy(t *testing.T) {
	seed := httptest.NewTLSServer(http.NotFoundHandler())
	cert := seed.TLS.Certificates[0]
	roots := x509.NewCertPool()
	roots.AddCert(seed.Certificate())
	seed.Close()
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Request-ID") == "" || r.Header.Get("X-Forwarded-For") != "127.0.0.1" {
			t.Error("missing trusted headers")
		}
		if r.URL.Path == "/hints" {
			w.WriteHeader(103)
			w.WriteHeader(201)
		}
		if r.URL.Path == "/stream" {
			_, _ = io.WriteString(w, "first")
			if err := http.NewResponseController(w).Flush(); err != nil {
				t.Error(err)
			}
		}
		_, _ = io.WriteString(w, "ok")
	}))
	defer upstream.Close()
	target, _ := url.Parse(upstream.URL)
	for _, protocol := range []string{"http/1.1", "h2"} {
		t.Run(protocol, func(t *testing.T) {
			events := make(chan gatewayRequestEvent, 32)
			h2Events := make(chan h2ObservationResult, 4)
			transport := http.DefaultTransport.(*http.Transport).Clone()
			defer transport.CloseIdleConnections()
			transport.ResponseHeaderTimeout = time.Second
			g, err := newGatewayTelemetry(target, transport, func(e gatewayRequestEvent) { events <- e })
			if err != nil {
				t.Fatal(err)
			}
			config := &tls.Config{Certificates: []tls.Certificate{cert}, NextProtos: []string{"h2", "http/1.1"}, MinVersion: tls.VersionTLS12}
			listener, err := net.Listen("tcp", "127.0.0.1:0")
			if err != nil {
				t.Fatal(err)
			}
			manager := newH2ObservationManager(func(e h2ObservationResult) { h2Events <- e })
			server := &http.Server{TLSConfig: config, Handler: g, ConnContext: gatewayConnContext, ReadHeaderTimeout: 2 * time.Second}
			done := make(chan error, 1)
			go func() { done <- server.Serve(&observedTLSListener{listener, config, manager}) }()
			defer func() {
				_ = server.Close()
				if err := <-done; err != http.ErrServerClosed {
					t.Error(err)
				}
			}()
			protocols := new(http.Protocols)
			protocols.SetHTTP1(true)
			protocols.SetHTTP2(protocol == "h2")
			clientTransport := &http.Transport{Protocols: protocols, MaxConnsPerHost: 1, TLSClientConfig: &tls.Config{RootCAs: roots, NextProtos: []string{protocol}, MinVersion: tls.VersionTLS12}}
			defer clientTransport.CloseIdleConnections()
			client := &http.Client{Transport: clientTransport, Timeout: 3 * time.Second}
			get := func(path string) (string, string) {
				t.Helper()
				resp, err := client.Get("https://" + listener.Addr().String() + path)
				if err != nil {
					t.Error(err)
					return "", ""
				}
				b, err := io.ReadAll(resp.Body)
				_ = resp.Body.Close()
				if err != nil || resp.TLS.NegotiatedProtocol != protocol {
					t.Error("proxy response", err)
				}
				want := 200
				if path == "/hints" {
					want = 201
				}
				if resp.StatusCode != want {
					t.Error("status", resp.StatusCode)
				}
				return resp.Header.Get("X-Request-ID"), string(b)
			}
			id, _ := get("/gateway/health")
			first := <-events
			if first.RequestID != id || first.ConnectionID == nil || first.UpstreamAttempted {
				t.Fatal("health correlation")
			}
			if protocol == "h2" {
				select {
				case e := <-h2Events:
					if e.ConnectionID != *first.ConnectionID {
						t.Fatal("H2 connection ID mismatch")
					}
				case <-time.After(time.Second):
					t.Fatal("missing H2 correlation")
				}
			}
			var wg sync.WaitGroup
			var idsMu sync.Mutex
			ids := map[string]bool{id: true}
			for range 6 {
				wg.Add(1)
				go func() {
					defer wg.Done()
					id, body := get("/courses")
					if body != "ok" {
						t.Error("body", body)
					}
					idsMu.Lock()
					defer idsMu.Unlock()
					if ids[id] || id == "" {
						t.Error("request ID reused")
					}
					ids[id] = true
				}()
			}
			wg.Wait()
			for range 6 {
				e := <-events
				if e.ConnectionID == nil || *e.ConnectionID != *first.ConnectionID || e.ResponseBytes != 2 || e.StatusCode == nil || *e.StatusCode != 200 || !ids[e.RequestID] || e.LatencyMS < 0 {
					t.Fatalf("%+v", e)
				}
			}
			_, body := get("/stream")
			if body != "firstok" {
				t.Fatal("flush/stream body", body)
			}
			if e := <-events; e.ResponseBytes != 7 || *e.StatusCode != 200 {
				t.Fatalf("stream %+v", e)
			}
			_, _ = get("/hints")
			if e := <-events; *e.StatusCode != 201 || *e.UpstreamStatus != 201 {
				t.Fatalf("informational %+v", e)
			}
			if len(events) != 0 {
				t.Fatal("duplicate events")
			}
		})
	}
}

func TestTelemetryRealUpstreamTimeout(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { <-r.Context().Done() }))
	defer upstream.Close()
	target, _ := url.Parse(upstream.URL)
	transport := http.DefaultTransport.(*http.Transport).Clone()
	defer transport.CloseIdleConnections()
	transport.ResponseHeaderTimeout = 40 * time.Millisecond
	events := make(chan gatewayRequestEvent, 1)
	g, err := newGatewayTelemetry(target, transport, func(e gatewayRequestEvent) { events <- e })
	if err != nil {
		t.Fatal(err)
	}
	g.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "https://lab/health", nil))
	e := <-events
	if e.ErrorCode == nil || *e.ErrorCode != "upstream_timeout" || *e.StatusCode != 502 {
		t.Fatalf("%+v", e)
	}
}

func TestTelemetryStreamingDelivery(t *testing.T) {
	release := make(chan struct{})
	var releaseOnce sync.Once
	unblock := func() { releaseOnce.Do(func() { close(release) }) }
	defer unblock()
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, "first\n")
		_ = http.NewResponseController(w).Flush()
		select {
		case <-release:
			_, _ = io.WriteString(w, "ok")
		case <-r.Context().Done():
		}
	}))
	defer upstream.Close()
	target, _ := url.Parse(upstream.URL)
	transport := http.DefaultTransport.(*http.Transport).Clone()
	defer transport.CloseIdleConnections()
	events := make(chan gatewayRequestEvent, 1)
	g, err := newGatewayTelemetry(target, transport, func(e gatewayRequestEvent) { events <- e })
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(g)
	defer server.Close()
	client := &http.Client{Timeout: 2 * time.Second}
	response, err := client.Get(server.URL + "/stream")
	if err != nil {
		unblock()
		t.Fatal(err)
	}
	defer response.Body.Close()
	first := make([]byte, 6)
	if _, err := io.ReadFull(response.Body, first); err != nil || string(first) != "first\n" {
		unblock()
		t.Fatal("initial chunk not flushed", err)
	}
	select {
	case <-events:
		t.Fatal("event before response completed")
	default:
	}
	unblock()
	rest, err := io.ReadAll(response.Body)
	if err != nil || string(rest) != "ok" {
		t.Fatal("remaining stream", err)
	}
	select {
	case e := <-events:
		if e.ResponseBytes != 8 || *e.StatusCode != 200 {
			t.Fatalf("%+v", e)
		}
	case <-time.After(time.Second):
		t.Fatal("missing completion event")
	}
}

func TestTelemetryClientCancellation(t *testing.T) {
	entered := make(chan struct{})
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { close(entered); <-r.Context().Done() }))
	defer upstream.Close()
	target, _ := url.Parse(upstream.URL)
	transport := http.DefaultTransport.(*http.Transport).Clone()
	defer transport.CloseIdleConnections()
	events := make(chan gatewayRequestEvent, 1)
	g, err := newGatewayTelemetry(target, transport, func(e gatewayRequestEvent) { events <- e })
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(g)
	defer server.Close()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	request, _ := http.NewRequestWithContext(ctx, "GET", server.URL+"/health", nil)
	client := &http.Client{Timeout: 2 * time.Second}
	done := make(chan struct{})
	go func() {
		defer close(done)
		response, _ := client.Do(request)
		if response != nil {
			_ = response.Body.Close()
		}
	}()
	select {
	case <-entered:
	case <-time.After(time.Second):
		t.Fatal("upstream not reached")
	}
	cancel()
	select {
	case e := <-events:
		if e.Outcome != "client_canceled" || e.ErrorCode == nil || *e.ErrorCode != "client_canceled" || e.UpstreamStatus != nil || e.StatusCode != nil {
			t.Fatalf("%+v", e)
		}
	case <-time.After(time.Second):
		t.Fatal("missing cancel event")
	}
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("client not cleaned up")
	}
}
