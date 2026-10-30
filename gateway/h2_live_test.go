package main

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/http/httputil"
	"net/url"
	"sync"
	"testing"
	"time"
)

func TestLiveH2Proxy(t *testing.T) {
	seed := httptest.NewTLSServer(http.NotFoundHandler())
	cert := seed.TLS.Certificates[0]
	roots := x509.NewCertPool()
	roots.AddCert(seed.Certificate())
	seed.Close()
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { _, _ = io.WriteString(w, "ok") }))
	defer upstream.Close()
	target, _ := url.Parse(upstream.URL)
	for _, tc := range []struct {
		name, proto string
		full        bool
	}{{"h1", "http/1.1", false}, {"h2", "h2", false}, {"h2_capacity", "h2", true}} {
		t.Run(tc.name, func(t *testing.T) {
			events := make(chan h2ObservationResult, 4)
			manager := newH2ObservationManager(func(r h2ObservationResult) { events <- r })
			if tc.full {
				for range h2LiveObservationLimit {
					manager.slots <- struct{}{}
				}
			}
			config := &tls.Config{Certificates: []tls.Certificate{cert}, NextProtos: []string{"h2", "http/1.1"}, MinVersion: tls.VersionTLS12}
			ln, err := net.Listen("tcp", "127.0.0.1:0")
			if err != nil {
				t.Fatal(err)
			}
			server := &http.Server{TLSConfig: config, Handler: httputil.NewSingleHostReverseProxy(target), ReadHeaderTimeout: 3 * time.Second}
			done := make(chan error, 1)
			go func() { done <- server.Serve(&observedTLSListener{ln, config, manager}) }()
			defer func() {
				_ = server.Close()
				if err := <-done; err != http.ErrServerClosed {
					t.Error(err)
				}
			}()
			protocols := new(http.Protocols)
			protocols.SetHTTP1(true)
			protocols.SetHTTP2(tc.proto == "h2")
			transport := &http.Transport{TLSClientConfig: &tls.Config{RootCAs: roots, NextProtos: []string{tc.proto}, MinVersion: tls.VersionTLS12}, Protocols: protocols}
			defer transport.CloseIdleConnections()
			client := &http.Client{Transport: transport, Timeout: 3 * time.Second}
			for range 2 {
				response, err := client.Get("https://" + ln.Addr().String() + "/health")
				if err != nil {
					t.Fatal(err)
				}
				body, err := io.ReadAll(response.Body)
				_ = response.Body.Close()
				if err != nil || string(body) != "ok" || response.StatusCode != 200 || response.TLS.NegotiatedProtocol != tc.proto {
					t.Fatalf("proxy failed: %s %q %v", response.Proto, body, err)
				}
			}
			if tc.proto == "h2" {
				select {
				case event := <-events:
					want := "headers_observed"
					if tc.full {
						want = "observation_unavailable"
					}
					if event.Status != want {
						t.Fatalf("event %+v", event)
					}
					if !tc.full && len(event.PseudoHeaders) != 4 {
						t.Fatalf("pseudo headers %v", event.PseudoHeaders)
					}
					if tc.full && event.Akamai != nil {
						t.Fatal("unavailable observation produced hash")
					}
					if !tc.full && event.WindowIncrement != nil && (event.Akamai == nil || len(event.Akamai.MD5) != 32) {
						t.Fatal("complete metadata missing fingerprint")
					}
					if !tc.full && event.WindowIncrement == nil && (event.Akamai != nil || event.AkamaiReason != "missing_window_update") {
						t.Fatal("missing window fabricated hash")
					}
					t.Logf("live observer: status=%s pseudo=%v", event.Status, event.PseudoHeaders)
				case <-time.After(3 * time.Second):
					t.Fatal("no observation")
				}
			}
			if len(events) != 0 {
				t.Fatal("duplicate report")
			}
			wantSlots := 0
			if tc.full {
				wantSlots = h2LiveObservationLimit
			}
			if len(manager.slots) != wantSlots {
				t.Fatal("slot leak")
			}
		})
	}
}

// A silent TLS peer completes the handshake but sends no HTTP/2 bytes.
// Timeout must release observation state without interrupting the blocked Read.
func TestLiveH2SilentTimeout(t *testing.T) {
	seed := httptest.NewTLSServer(http.NotFoundHandler())
	cert := seed.TLS.Certificates[0]
	roots := x509.NewCertPool()
	roots.AddCert(seed.Certificate())
	seed.Close()
	a, b := net.Pipe()
	defer b.Close()
	events := make(chan h2ObservationResult, 4)
	manager := newH2ObservationManager(func(r h2ObservationResult) { events <- r })
	c := &observedTLSConn{Conn: tls.Server(a, &tls.Config{Certificates: []tls.Certificate{cert}, NextProtos: []string{"h2"}, MinVersion: tls.VersionTLS12}), manager: manager, id: 1}
	defer c.Close()
	client := tls.Client(b, &tls.Config{RootCAs: roots, ServerName: "example.com", NextProtos: []string{"h2"}, MinVersion: tls.VersionTLS12})
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	handshake := make(chan error, 1)
	go func() { handshake <- c.HandshakeContext(ctx) }()
	if err := client.HandshakeContext(ctx); err != nil {
		t.Fatal(err)
	}
	if err := <-handshake; err != nil {
		t.Fatal(err)
	}
	readDone := make(chan struct{})
	go func() { defer close(readDone); _, _ = c.Read(make([]byte, 32)) }()
	select {
	case event := <-events:
		if event.Status != "incomplete" || event.Reason != "timeout" {
			t.Fatalf("%+v", event)
		}
	case <-time.After(4 * time.Second):
		t.Fatal("idle timeout did not fire")
	}
	if len(manager.slots) != 0 {
		t.Fatal("slot leak")
	}
	select {
	case <-readDone:
		t.Fatal("observer timeout interrupted network Read")
	default:
	}
	_ = b.Close()
	select {
	case <-readDone:
	case <-time.After(time.Second):
		t.Fatal("Read not cleaned up")
	}
	if len(events) != 0 {
		t.Fatal("duplicate event")
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.observer != nil || c.timer != nil {
		t.Fatal("parser/timer retained")
	}
}

func TestLiveH2CloseRaceAndCleanup(t *testing.T) {
	events := make(chan h2ObservationResult, 10)
	manager := newH2ObservationManager(func(r h2ObservationResult) { events <- r })
	a, b := net.Pipe()
	defer b.Close()
	c := &observedTLSConn{Conn: tls.Server(a, &tls.Config{}), manager: manager, id: 1}
	c.beginH2()
	// Simulate an in-progress compressed block, which must be released.
	c.mu.Lock()
	c.observer.block = []byte{0x82}
	c.mu.Unlock()
	var wg sync.WaitGroup
	for range 8 {
		wg.Add(1)
		go func() { defer wg.Done(); _ = c.Close() }()
	}
	wg.Wait()
	if len(events) != 1 || len(manager.slots) != 0 {
		t.Fatal("Close must report/release exactly once")
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.observer != nil || c.timer != nil {
		t.Fatal("resources retained")
	}
}

func TestLiveH2Admission128(t *testing.T) {
	events := make(chan h2ObservationResult, 256)
	manager := newH2ObservationManager(func(r h2ObservationResult) { events <- r })
	var connections []*observedTLSConn
	defer func() {
		for _, c := range connections {
			_ = c.Close()
		}
	}()
	create := func() *observedTLSConn {
		a, b := net.Pipe()
		t.Cleanup(func() { _ = b.Close() })
		c := &observedTLSConn{Conn: tls.Server(a, &tls.Config{}), manager: manager, id: manager.nextID.Add(1)}
		connections = append(connections, c)
		c.beginH2()
		return c
	}
	for range 128 {
		create()
	}
	if len(manager.slots) != 128 {
		t.Fatal("128 observers not admitted")
	}
	rejected := create()
	if !rejected.done || rejected.observer != nil || len(manager.slots) != 128 {
		t.Fatal("129th observation must bypass")
	}
	if result := <-events; result.Status != "observation_unavailable" {
		t.Fatalf("%+v", result)
	}
	_ = connections[0].Close()
	if len(manager.slots) != 127 {
		t.Fatal("slot not released")
	}
	replacement := create()
	if replacement.observer == nil || len(manager.slots) != 128 {
		t.Fatal("released slot not reusable")
	}
	for _, c := range connections {
		_ = c.Close()
	}
	if len(manager.slots) != 0 {
		t.Fatal("slots retained after cleanup")
	}
}
