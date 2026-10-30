package main

import (
	"bytes"
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

// Test-only TLS integration; the Gateway has no live observer yet.
const testH2Preface = "PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n"

type prefaceObservation struct {
	mu      sync.Mutex
	prefix  [24]byte
	length  int
	bytes   int
	initial *h2InitialParser
	frames  *h2FrameObserver
}

func (o *prefaceObservation) observe(p []byte) {
	o.mu.Lock()
	defer o.mu.Unlock()
	o.bytes += len(p)
	o.length += copy(o.prefix[o.length:], p)
	if o.frames == nil {
		o.frames = newH2FrameObserver(time.Now())
		o.initial = o.frames.initial
	}
	o.frames.feed(p, time.Now())
}

// Embedding preserves HandshakeContext, ConnectionState, deadlines and Close.
// Read sees plaintext because it calls tls.Conn.Read, not the raw TCP Read.
type prefaceTestConn struct {
	*tls.Conn
	observation *prefaceObservation
}

func (c *prefaceTestConn) Read(p []byte) (int, error) {
	n, err := c.Conn.Read(p)
	if n > 0 && c.ConnectionState().NegotiatedProtocol == "h2" {
		c.observation.observe(p[:n])
	}
	// Preserve both n and err, including a read that returns bytes with an error.
	return n, err
}

type prefaceTestListener struct {
	net.Listener
	config      *tls.Config
	observation *prefaceObservation
}

func (l *prefaceTestListener) Accept() (net.Conn, error) {
	c, err := l.Listener.Accept()
	if err != nil {
		return nil, err
	}
	return &prefaceTestConn{tls.Server(c, l.config), l.observation}, nil
}

func TestTLSReadWrapperProxy(t *testing.T) {
	// httptest supplies a temporary certificate; no lab key file is read.
	certificateServer := httptest.NewTLSServer(http.NotFoundHandler())
	certificate := certificateServer.TLS.Certificates[0]
	roots := x509.NewCertPool()
	roots.AddCert(certificateServer.Certificate())
	certificateServer.Close()

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/health" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"status":"ok"}`)
	}))
	defer upstream.Close()
	target, err := url.Parse(upstream.URL)
	if err != nil {
		t.Fatal(err)
	}

	for _, protocol := range []string{"http/1.1", "h2"} {
		t.Run(protocol, func(t *testing.T) {
			observation := &prefaceObservation{}
			config := &tls.Config{
				Certificates: []tls.Certificate{certificate},
				MinVersion:   tls.VersionTLS12,
				NextProtos:   []string{"h2", "http/1.1"},
			}
			listener, err := net.Listen("tcp", "127.0.0.1:0")
			if err != nil {
				t.Fatal(err)
			}
			server := &http.Server{
				Handler:           httputil.NewSingleHostReverseProxy(target),
				TLSConfig:         config,
				ReadHeaderTimeout: 2 * time.Second,
				IdleTimeout:       2 * time.Second,
				MaxHeaderBytes:    16 << 10,
			}
			done := make(chan error, 1)
			go func() {
				done <- server.Serve(&prefaceTestListener{listener, config, observation})
			}()
			defer func() {
				_ = server.Close()
				if err := <-done; err != http.ErrServerClosed {
					t.Errorf("Serve: %v", err)
				}
			}()

			protocols := new(http.Protocols)
			protocols.SetHTTP1(true)
			protocols.SetHTTP2(protocol == "h2")
			transport := &http.Transport{
				TLSClientConfig: &tls.Config{
					RootCAs: roots, MinVersion: tls.VersionTLS12,
					NextProtos: []string{protocol},
				},
				Protocols: protocols,
			}
			defer transport.CloseIdleConnections()
			client := &http.Client{Transport: transport, Timeout: 3 * time.Second}
			// Two sequential requests also exercise an established connection.
			for range 2 {
				response, err := client.Get("https://" + listener.Addr().String() + "/health")
				if err != nil {
					t.Fatal(err)
				}
				body, readErr := io.ReadAll(io.LimitReader(response.Body, 1024))
				_ = response.Body.Close()
				if readErr != nil || response.StatusCode != 200 || string(body) != `{"status":"ok"}` {
					t.Fatalf("proxy response: status=%d body=%q error=%v", response.StatusCode, body, readErr)
				}
				wantMajor := 1
				if protocol == "h2" {
					wantMajor = 2
				}
				if response.ProtoMajor != wantMajor || response.TLS.NegotiatedProtocol != protocol {
					t.Fatalf("unexpected protocol: HTTP=%s ALPN=%q", response.Proto, response.TLS.NegotiatedProtocol)
				}
			}
			observation.mu.Lock()
			defer observation.mu.Unlock()
			if protocol == "h2" {
				if !bytes.Equal(observation.prefix[:observation.length], []byte(testH2Preface)) {
					t.Fatal("observer did not see the plaintext H2 preface")
				}
				if observation.initial == nil || observation.initial.status != "settings_observed" {
					t.Fatal("parser did not finish the real Go client's initial SETTINGS")
				}
				t.Logf("real Go client initial SETTINGS: %v", observation.initial.settings)
				if observation.frames.status != "headers_observed" {
					t.Fatalf("first HEADERS metadata: status=%s reason=%s", observation.frames.status, observation.frames.reason)
				}
				if len(observation.frames.pseudoHeaders) != 4 {
					t.Fatalf("expected four request pseudo-headers: %v", observation.frames.pseudoHeaders)
				}
				t.Logf("H2 pseudo-header wire order: %v", observation.frames.pseudoHeaders)
				t.Logf("H2 metadata: frames=%d stream=%d END_HEADERS=%t standalone_priorities=%d", observation.frames.frames, observation.frames.firstHeadersStream, observation.frames.firstHeadersEndHeaders, len(observation.frames.priorities))
			} else if observation.bytes != 0 {
				t.Fatal("H2 observer captured HTTP/1.1 data")
			}
			t.Logf("proxy 200; ALPN=%s; observed plaintext prefix bytes=%d", protocol, observation.length)
		})
	}
}
