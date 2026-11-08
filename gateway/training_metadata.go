package main

import (
	"io"
	"time"
)

type observedUpstreamBody struct {
	io.ReadCloser
	state *gatewayRequestState
	start time.Time
	done  bool
}

func (b *observedUpstreamBody) Read(p []byte) (int, error) {
	n, err := b.ReadCloser.Read(p)
	if err == io.EOF && !b.done {
		b.done = true
		elapsed := time.Since(b.start).Seconds() * 1000
		b.state.mu.Lock()
		b.state.event.UpstreamResponseMS = &elapsed
		b.state.mu.Unlock()
	}
	return n, err
}

// Fixed, non-sensitive resources for the opt-in test traffic lab only.
var labAssets = map[string]struct{ kind, body string }{
	"/lab/page":            {"text/html; charset=utf-8", "<!doctype html><title>Course registration lab</title><h1>Course registration</h1>"},
	"/lab/assets/app.css":  {"text/css", "body{font-family:sans-serif}"},
	"/lab/assets/app.js":   {"text/javascript", "/* DACN2 controlled lab resource */"},
	"/lab/assets/icon.svg": {"image/svg+xml", "<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><rect width='16' height='16'/></svg>"},
}
