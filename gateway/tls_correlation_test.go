package main

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestTLSFingerprintSharesConnectionWithH2Request(t *testing.T) {
	seed := httptest.NewTLSServer(http.NotFoundHandler())
	cert := seed.TLS.Certificates[0]
	roots := x509.NewCertPool()
	roots.AddCert(seed.Certificate())
	seed.Close()
	tlsEvents := make(chan tlsFingerprintEvent, 2)
	h2Events := make(chan h2ObservationResult, 2)
	manager := newH2ObservationManager(func(e h2ObservationResult) { h2Events <- e })
	manager.reportTLS = func(e tlsFingerprintEvent) { tlsEvents <- e }
	cfg := &tls.Config{Certificates: []tls.Certificate{cert}, MinVersion: tls.VersionTLS12, NextProtos: []string{"h2", "http/1.1"}}
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	server := &http.Server{TLSConfig: cfg, ConnContext: gatewayConnContext, Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { fmt.Fprint(w, r.Context().Value(connectionIDKey)) })}
	defer server.Close()
	go func() { _ = server.Serve(&observedTLSListener{ln, cfg, manager}) }()
	transport := &http.Transport{TLSClientConfig: &tls.Config{RootCAs: roots}, ForceAttemptHTTP2: true}
	defer transport.CloseIdleConnections()
	client := &http.Client{Transport: transport, Timeout: 3 * time.Second}
	response, err := client.Get("https://" + ln.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	body, _ := io.ReadAll(response.Body)
	response.Body.Close()
	if response.Proto != "HTTP/2.0" || response.TLS.NegotiatedProtocol != "h2" {
		t.Fatal("HTTP2 not negotiated")
	}
	select {
	case e := <-tlsEvents:
		if e.JA4 == "" || fmt.Sprint(e.ConnectionID) != string(body) {
			t.Fatal("TLS fingerprint/request connection mismatch")
		}
	case <-time.After(time.Second):
		t.Fatal("missing TLS event")
	}
	select {
	case e := <-h2Events:
		if fmt.Sprint(e.ConnectionID) != string(body) || e.Status != "headers_observed" {
			t.Fatal("H2/request connection mismatch")
		}
	case <-time.After(time.Second):
		t.Fatal("missing H2 event")
	}
}
