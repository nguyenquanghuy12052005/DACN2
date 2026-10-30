package main

import (
	"fmt"
	"net"
	"net/netip"
	"net/url"
	"strconv"
)

type gatewayConfig struct {
	listen   string
	upstream *url.URL
}

func readGatewayConfig(getenv func(string) string) (gatewayConfig, error) {
	listen := getenv("DACN2_LISTEN_ADDR")
	if listen == "" {
		listen = "127.0.0.1:8443"
	}
	if !loopbackEndpoint(listen) {
		return gatewayConfig{}, fmt.Errorf("DACN2_LISTEN_ADDR must be a loopback IP and explicit port")
	}
	target := getenv("DACN2_UPSTREAM_URL")
	if target == "" {
		target = "http://127.0.0.1:3000"
	}
	u, err := url.Parse(target)
	if err != nil || u.Scheme != "http" || u.User != nil || u.Opaque != "" ||
		(u.Path != "" && u.Path != "/") || u.RawPath != "" || u.RawQuery != "" || u.ForceQuery ||
		u.Fragment != "" || u.RawFragment != "" || !loopbackEndpoint(u.Host) {
		return gatewayConfig{}, fmt.Errorf("DACN2_UPSTREAM_URL must be an HTTP loopback origin with explicit port, without credentials, query or fragment")
	}
	return gatewayConfig{listen: listen, upstream: u}, nil
}

func loopbackEndpoint(value string) bool {
	host, port, err := net.SplitHostPort(value)
	if err != nil {
		return false
	}
	address, err := netip.ParseAddr(host)
	if err != nil || address.Zone() != "" || !address.IsLoopback() {
		return false
	}
	n, err := strconv.Atoi(port)
	return err == nil && n > 0 && n <= 65535
}
