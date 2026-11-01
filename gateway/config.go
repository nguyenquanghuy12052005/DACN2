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
	networkMode := getenv("DACN2_NETWORK_MODE")
	if networkMode != "" && networkMode != "compose-team" {
		return gatewayConfig{}, fmt.Errorf("unsupported DACN2_NETWORK_MODE")
	}
	teamMode := networkMode == "compose-team"

	listen := getenv("DACN2_LISTEN_ADDR")
	if listen == "" {
		listen = "127.0.0.1:8443"
	}
	if !loopbackEndpoint(listen) && !(teamMode && listen == "0.0.0.0:8443") {
		return gatewayConfig{}, fmt.Errorf("listen address is not allowed in the selected network mode")
	}
	target := getenv("DACN2_UPSTREAM_URL")
	if target == "" {
		target = "http://127.0.0.1:3000"
	}
	u, err := url.Parse(target)
	if err != nil || u.Scheme != "http" || u.User != nil || u.Opaque != "" ||
		(u.Path != "" && u.Path != "/") || u.RawPath != "" || u.RawQuery != "" || u.ForceQuery ||
		u.Fragment != "" || u.RawFragment != "" ||
		(!loopbackEndpoint(u.Host) && !(teamMode && u.Host == "backend:3000")) {
		return gatewayConfig{}, fmt.Errorf("upstream must be an allowed HTTP origin without credentials, non-root path, query or fragment")
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
