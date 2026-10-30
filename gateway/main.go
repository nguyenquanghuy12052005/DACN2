package main

import "crypto/tls"
import (
	"encoding/json"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"time"
)

func main() {
	var tlsKeyLog io.Writer

	if path := os.Getenv("DACN2_TLS_KEYLOG"); path != "" {
		keyFile, err := os.OpenFile(
			path,
			os.O_CREATE|os.O_WRONLY|os.O_APPEND,
			0600,
		)
		if err != nil {
			log.Fatal(err)
		}

		defer keyFile.Close()
		tlsKeyLog = keyFile
		log.Print("TLS key logging enabled for local lab")
	}
	target, err := url.Parse("http://127.0.0.1:3000")
	if err != nil {
		log.Fatal(err)
	}

	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.ResponseHeaderTimeout = 5 * time.Second
	requestLog := log.New(os.Stdout, "", 0)
	telemetry, err := newGatewayTelemetry(target, transport, func(event gatewayRequestEvent) {
		encoded, err := json.Marshal(event)
		if err != nil {
			log.Print("request telemetry encoding failed")
			return
		}
		requestLog.Print(string(encoded))
	})
	if err != nil {
		log.Fatal("request ID initialization failed")
	}

	server := &http.Server{
		Addr:              "127.0.0.1:8443",
		Handler:           telemetry,
		ConnContext:       gatewayConnContext,
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       30 * time.Second,
		MaxHeaderBytes:    16 << 10,
		TLSConfig: &tls.Config{
			NextProtos:   []string{"h2", "http/1.1"},
			KeyLogWriter: tlsKeyLog,
			MinVersion:   tls.VersionTLS12,
			GetConfigForClient: func(hello *tls.ClientHelloInfo) (*tls.Config, error) {
				log.Printf(
					"TLS ClientHello: sni=%q versions=%v ciphers=%v extensions=%v curves=%v signatures=%v alpn=%q",
					hello.ServerName,
					hello.SupportedVersions,
					hello.CipherSuites,
					hello.Extensions,
					hello.SupportedCurves,
					hello.SignatureSchemes,
					hello.SupportedProtos,
				)
				fingerprints := ja4Variants(hello)
				log.Printf("JA4: %s", fingerprints.JA4)
				log.Printf("JA4_r: %s", fingerprints.Raw)
				log.Printf("JA4_o: %s", fingerprints.Original)
				log.Printf("JA4_ro: %s", fingerprints.RawOriginal)
				return nil, nil
			},
		},
	}

	certificate, err := tls.LoadX509KeyPair("cert.pem", "key.pem")
	if err != nil {
		log.Fatal(err)
	}
	server.TLSConfig.Certificates = []tls.Certificate{certificate}
	listener, err := net.Listen("tcp", server.Addr)
	if err != nil {
		log.Fatal(err)
	}
	manager := newH2ObservationManager(func(result h2ObservationResult) {
		encoded, err := json.Marshal(result)
		if err != nil {
			log.Printf("H2 observation encoding error: %v", err)
			return
		}
		log.Printf("H2 observation: %s", encoded)
	})
	log.Printf("Gateway listening on https://%s -> %s", server.Addr, target)
	log.Fatal(server.Serve(&observedTLSListener{listener, server.TLSConfig, manager}))
}
