package main

import (
	"context"
	"crypto/tls"
	"net"
	"sync"
	"sync/atomic"
	"time"
)

const h2LiveObservationLimit = 128

// A detached, value-only snapshot. No encoded headers, values or TLS keys.
type h2ObservationResult struct {
	ConnectionID    uint64               `json:"connection_id"`
	Status          string               `json:"status"`
	Reason          string               `json:"reason,omitempty"`
	Settings        []h2Setting          `json:"settings"`
	WindowIncrement *uint32              `json:"window_increment"`
	Priorities      []h2Priority         `json:"priorities"`
	HeadersPriority *h2Priority          `json:"headers_priority"`
	PseudoHeaders   []string             `json:"pseudo_headers"`
	Frames          int                  `json:"frames"`
	Bytes           int                  `json:"bytes"`
	Akamai          *h2AkamaiFingerprint `json:"akamai"`
	AkamaiReason    string               `json:"akamai_reason,omitempty"`
}

type h2ObservationManager struct {
	slots  chan struct{}
	nextID atomic.Uint64
	report func(h2ObservationResult)
}

func newH2ObservationManager(report func(h2ObservationResult)) *h2ObservationManager {
	return &h2ObservationManager{slots: make(chan struct{}, h2LiveObservationLimit), report: report}
}

type observedTLSListener struct {
	net.Listener
	config  *tls.Config
	manager *h2ObservationManager
}

func (l *observedTLSListener) Accept() (net.Conn, error) {
	c, err := l.Listener.Accept()
	if err != nil {
		return nil, err
	}
	return &observedTLSConn{Conn: tls.Server(c, l.config), manager: l.manager, id: l.manager.nextID.Add(1)}, nil
}

// Embed TLS methods for Go 1.27's net/http detection. Parser ownership is
// serialized between Read, the timer callback, and Close by mu.
type observedTLSConn struct {
	*tls.Conn
	manager       *h2ObservationManager
	id            uint64
	mu            sync.Mutex
	started, done bool
	observer      *h2FrameObserver
	timer         *time.Timer
}

// Explicit delegation documents the TLS handshake contract used by net/http.
func (c *observedTLSConn) HandshakeContext(ctx context.Context) error {
	return c.Conn.HandshakeContext(ctx)
}

func (c *observedTLSConn) emit(result *h2ObservationResult) {
	if result != nil {
		result.Akamai, result.AkamaiReason = makeAkamai(*result)
	}
	if result != nil && c.manager.report != nil {
		c.manager.report(*result)
	}
}

func (c *observedTLSConn) begin() {
	if c.ConnectionState().NegotiatedProtocol != "h2" {
		return
	}
	c.beginH2()
}

func (c *observedTLSConn) beginH2() {
	c.mu.Lock()
	if c.started || c.done {
		c.mu.Unlock()
		return
	}
	c.started = true
	select {
	case c.manager.slots <- struct{}{}:
		c.observer = newH2FrameObserver(time.Now())
		c.timer = time.AfterFunc(h2InitialTimeout, func() {
			c.mu.Lock()
			result := c.finishLocked("incomplete", "timeout")
			c.mu.Unlock()
			c.emit(result)
		})
		c.mu.Unlock()
	default:
		c.done = true
		c.mu.Unlock()
		c.emit(&h2ObservationResult{ConnectionID: c.id, Status: "observation_unavailable", Reason: "capacity"})
	}
}

// Called with mu held. Release slot/parser before invoking any report callback.
func (c *observedTLSConn) finishLocked(status, reason string) *h2ObservationResult {
	if c.done || c.observer == nil {
		return nil
	}
	o := c.observer
	if o.status == "collecting" {
		o.stop(status, reason)
	}
	result := &h2ObservationResult{ConnectionID: c.id, Status: o.status, Reason: o.reason,
		Settings:      append([]h2Setting{}, o.initial.settings...),
		Priorities:    append([]h2Priority{}, o.priorities...),
		PseudoHeaders: append([]string(nil), o.pseudoHeaders...), Frames: o.frames, Bytes: o.bytesRead}
	// Preserve missing vs an observed empty list in failure snapshots.
	if o.initial.status != "settings_observed" {
		result.Settings = nil
	}
	if o.priorities == nil {
		result.Priorities = nil
	}
	if o.windowIncrement != nil {
		v := *o.windowIncrement
		result.WindowIncrement = &v
	}
	if o.headersPriority != nil {
		v := *o.headersPriority
		result.HeadersPriority = &v
	}
	c.done = true
	if c.timer != nil {
		c.timer.Stop()
		c.timer = nil
	}
	c.observer = nil
	<-c.manager.slots
	return result
}

func (c *observedTLSConn) Read(p []byte) (int, error) {
	c.begin()
	n, err := c.Conn.Read(p)
	c.mu.Lock()
	var result *h2ObservationResult
	if c.observer != nil {
		if n > 0 {
			c.observer.feed(p[:n], time.Now())
		}
		if c.observer.status != "collecting" {
			result = c.finishLocked("", "")
		} else if err != nil {
			result = c.finishLocked("incomplete", "read_ended")
		}
	}
	c.mu.Unlock()
	c.emit(result)
	return n, err // Including reads returning data and an error together.
}

func (c *observedTLSConn) Close() error {
	c.mu.Lock()
	result := c.finishLocked("incomplete", "connection_closed")
	c.done = true
	c.mu.Unlock()
	err := c.Conn.Close()
	c.emit(result)
	return err
}
