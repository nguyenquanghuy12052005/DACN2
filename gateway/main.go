package main

import "crypto/tls"
import (
	"io"
	"log"
	"net/http"
	"net/http/httputil"
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

	proxy := httputil.NewSingleHostReverseProxy(target)

	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.ResponseHeaderTimeout = 5 * time.Second
	proxy.Transport = transport

	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		log.Printf("upstream error: method=%s error=%v", r.Method, err)
		http.Error(w, "Backend unavailable", http.StatusBadGateway)
	}

	server := &http.Server{
		Addr:              "127.0.0.1:8443",
		Handler:           proxy,
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       30 * time.Second,
		MaxHeaderBytes:    16 << 10,
		TLSConfig: &tls.Config{
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
				log.Printf("JA4: %s", ja4(hello))
				return nil, nil
			},
		},
	}

	log.Printf("Gateway listening on https://%s -> %s", server.Addr, target)
	log.Fatal(server.ListenAndServeTLS("cert.pem", "key.pem"))
}
