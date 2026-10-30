package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"io"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/netip"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

type gatewayContextKey int

const (
	requestStateKey gatewayContextKey = iota
	connectionIDKey
)

type gatewayRequestEvent struct {
	SchemaVersion     int       `json:"schema_version"`
	Event             string    `json:"event"`
	RequestID         string    `json:"request_id"`
	ConnectionID      *uint64   `json:"connection_id"`
	StartedAt         time.Time `json:"started_at"`
	CompletedAt       time.Time `json:"completed_at"`
	LatencyMS         float64   `json:"latency_ms"`
	ClientIP          *string   `json:"client_ip"`
	ClientIPSource    string    `json:"client_ip_source"`
	Method            string    `json:"method"`
	Route             string    `json:"route"`
	RouteKind         string    `json:"route_kind"`
	UpstreamAttempted bool      `json:"upstream_attempted"`
	UpstreamStatus    *int      `json:"upstream_status"`
	StatusCode        *int      `json:"status_code"`
	ResponseBytes     int64     `json:"response_bytes"`
	Outcome           string    `json:"outcome"`
	ErrorCode         *string   `json:"error_code"`
}

type gatewayRequestState struct {
	mu    sync.Mutex
	event gatewayRequestEvent
}
type gatewayTelemetry struct {
	prefix string
	next   atomic.Uint64
	proxy  *httputil.ReverseProxy
	report func(gatewayRequestEvent)
}

func gatewayConnContext(ctx context.Context, c net.Conn) context.Context {
	if c, ok := c.(*observedTLSConn); ok {
		return context.WithValue(ctx, connectionIDKey, c.id)
	}
	return ctx
}

func peerIP(remote string) *string {
	addr, err := netip.ParseAddrPort(remote)
	if err != nil {
		return nil
	}
	ip := addr.Addr().Unmap().WithZone("").String()
	return &ip
}

func requestRoute(path string) string {
	switch path {
	case "/gateway/health", "/health", "/courses":
		return path
	}
	parts := strings.Split(path, "/")
	if len(parts) >= 3 && parts[0] == "" && parts[1] == "courses" && parts[2] != "" {
		if len(parts) == 3 {
			return "/courses/:id"
		}
		if len(parts) == 4 && parts[3] == "registrations" {
			return "/courses/:id/registrations"
		}
	}
	return "unknown"
}

func requestMethod(method string) string {
	switch method {
	case "GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "CONNECT", "TRACE":
		return method
	}
	return "OTHER"
}

type telemetryTransport struct{ base http.RoundTripper }

func (t telemetryTransport) RoundTrip(r *http.Request) (*http.Response, error) {
	s, _ := r.Context().Value(requestStateKey).(*gatewayRequestState)
	if s != nil {
		s.mu.Lock()
		s.event.UpstreamAttempted = true
		s.mu.Unlock()
	}
	response, err := t.base.RoundTrip(r)
	if s != nil && err == nil && response != nil {
		s.mu.Lock()
		status := response.StatusCode
		s.event.UpstreamStatus = &status
		s.mu.Unlock()
	}
	return response, err
}

func newGatewayTelemetry(target *url.URL, base http.RoundTripper, report func(gatewayRequestEvent)) (*gatewayTelemetry, error) {
	return newGatewayTelemetryWithEntropy(target, base, report, rand.Reader)
}

func newGatewayTelemetryWithEntropy(target *url.URL, base http.RoundTripper, report func(gatewayRequestEvent), entropy io.Reader) (*gatewayTelemetry, error) {
	var nonce [16]byte
	if _, err := io.ReadFull(entropy, nonce[:]); err != nil {
		return nil, err
	}
	g := &gatewayTelemetry{prefix: hex.EncodeToString(nonce[:]), report: report}
	g.proxy = &httputil.ReverseProxy{
		Transport: telemetryTransport{base},
		// Proxy copy errors can contain attacker-controlled text; the completion
		// event provides classified errors instead of logging raw values.
		ErrorLog: log.New(io.Discard, "", 0),
		Rewrite: func(pr *httputil.ProxyRequest) {
			pr.SetURL(target)
			pr.Out.Host = pr.In.Host
			for _, h := range []string{"Forwarded", "X-Forwarded-For", "X-Real-IP", "X-Forwarded-Host", "X-Forwarded-Proto", "X-Request-ID"} {
				pr.Out.Header.Del(h)
			}
			if s, ok := pr.In.Context().Value(requestStateKey).(*gatewayRequestState); ok {
				pr.Out.Header.Set("X-Request-ID", s.event.RequestID)
				if s.event.ClientIP != nil {
					pr.Out.Header.Set("X-Forwarded-For", *s.event.ClientIP)
				}
			}
		},
		ErrorHandler: func(w http.ResponseWriter, r *http.Request, err error) {
			code := proxyErrorCode(r.Context(), err)
			if s, ok := r.Context().Value(requestStateKey).(*gatewayRequestState); ok {
				s.mu.Lock()
				s.event.ErrorCode = &code
				s.event.Outcome = "proxy_error"
				if code == "client_canceled" {
					s.event.Outcome = "client_canceled"
				}
				s.mu.Unlock()
			}
			if code != "client_canceled" {
				http.Error(w, "Backend unavailable", http.StatusBadGateway)
			}
		},
	}
	return g, nil
}

func proxyErrorCode(ctx context.Context, err error) string {
	if errors.Is(ctx.Err(), context.Canceled) {
		return "client_canceled"
	}
	var timeout net.Error
	if errors.Is(ctx.Err(), context.DeadlineExceeded) || errors.Is(err, context.DeadlineExceeded) || (errors.As(err, &timeout) && timeout.Timeout()) {
		return "upstream_timeout"
	}
	var op *net.OpError
	if errors.As(err, &op) && op.Op == "dial" {
		return "upstream_dial_error"
	}
	return "upstream_error"
}

func (g *gatewayTelemetry) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	g.observe(http.HandlerFunc(g.route)).ServeHTTP(w, r)
}
func (g *gatewayTelemetry) route(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/gateway/health" {
		g.proxy.ServeHTTP(w, r)
		return
	}
	if r.Method != "GET" && r.Method != "HEAD" {
		w.Header().Set("Allow", "GET, HEAD")
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	const body = `{"status":"ok","service":"dacn2-gateway"}`
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Length", strconv.Itoa(len(body)))
	w.WriteHeader(http.StatusOK)
	if r.Method == "GET" {
		_, _ = io.WriteString(w, body)
	}
}

func (g *gatewayTelemetry) observe(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		id := g.prefix + "-" + strconv.FormatUint(g.next.Add(1), 10)
		e := gatewayRequestEvent{SchemaVersion: 1, Event: "gateway_request", RequestID: id, StartedAt: start.UTC(), ClientIP: peerIP(r.RemoteAddr), ClientIPSource: "unavailable", Method: requestMethod(r.Method), Route: requestRoute(r.URL.Path), RouteKind: "upstream", Outcome: "upstream_response"}
		if e.ClientIP != nil {
			e.ClientIPSource = "tcp_peer"
		}
		if value, ok := r.Context().Value(connectionIDKey).(uint64); ok && value > 0 {
			e.ConnectionID = &value
		}
		if r.URL.Path == "/gateway/health" {
			e.RouteKind = "gateway_local"
			e.Outcome = "gateway_local"
		}
		s := &gatewayRequestState{event: e}
		writer := &telemetryResponseWriter{ResponseWriter: w, requestID: id, head: r.Method == "HEAD"}
		w.Header().Set("X-Request-ID", id)
		defer func() {
			failure := recover()
			end := time.Now()
			s.mu.Lock()
			event := s.event
			s.mu.Unlock()
			writer.mu.Lock()
			event.StatusCode = writer.status
			event.ResponseBytes = writer.bytes
			writeFailed := writer.writeFailed
			writer.mu.Unlock()
			event.CompletedAt = end.UTC()
			event.LatencyMS = end.Sub(start).Seconds() * 1000
			if failure != nil {
				code := "handler_panic"
				if failure == http.ErrAbortHandler {
					code = "response_aborted"
				}
				event.Outcome = code
				event.ErrorCode = &code
			} else if writeFailed {
				code := "response_aborted"
				event.Outcome = code
				event.ErrorCode = &code
			}
			if errors.Is(r.Context().Err(), context.Canceled) {
				code := "client_canceled"
				event.Outcome = code
				event.ErrorCode = &code
			}
			if g.report != nil {
				g.report(event)
			}
			// Retain net/http's abort/recovery behavior without leaking arbitrary
			// panic values/stacks through its default error logger.
			if failure != nil {
				panic(http.ErrAbortHandler)
			}
		}()
		next.ServeHTTP(writer, r.WithContext(context.WithValue(r.Context(), requestStateKey, s)))
	})
}

// Unwrap preserves ResponseController operations (Flush/Hijack/deadlines).
// All body writes go through Write; no ReaderFrom fast path bypasses accounting.
type telemetryResponseWriter struct {
	http.ResponseWriter
	mu          sync.Mutex
	requestID   string
	head        bool
	status      *int
	bytes       int64
	writeFailed bool
}

func (w *telemetryResponseWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }
func (w *telemetryResponseWriter) WriteHeader(code int) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.status != nil {
		return
	}
	w.Header().Set("X-Request-ID", w.requestID)
	w.ResponseWriter.WriteHeader(code)
	if code >= 200 || code == 101 {
		w.status = &code
	}
}
func (w *telemetryResponseWriter) Write(p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.Header().Set("X-Request-ID", w.requestID)
	n, err := w.ResponseWriter.Write(p)
	if w.status == nil {
		status := 200
		w.status = &status
	}
	if !w.head {
		w.bytes += int64(n)
	}
	if err != nil {
		w.writeFailed = true
	}
	return n, err
}
func (w *telemetryResponseWriter) FlushError() error {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.Header().Set("X-Request-ID", w.requestID)
	err := http.NewResponseController(w.ResponseWriter).Flush()
	if err == nil && w.status == nil {
		status := 200
		w.status = &status
	}
	if err != nil {
		w.writeFailed = true
	}
	return err
}
