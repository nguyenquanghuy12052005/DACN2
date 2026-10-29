package main

import (
	"crypto/sha256"
	"sort"
	"strings"
)
import (
	"crypto/tls"
	"fmt"
)

func isGREASE(value uint16) bool {
	return value&0x0f0f == 0x0a0a && byte(value>>8) == byte(value)
}

func ja4Prefix(hello *tls.ClientHelloInfo) string {
	var highestVersion uint16
	for _, version := range hello.SupportedVersions {
		if !isGREASE(version) && version > highestVersion {
			highestVersion = version
		}
	}

	version := "00"
	switch highestVersion {
	case tls.VersionTLS13:
		version = "13"
	case tls.VersionTLS12:
		version = "12"
	case tls.VersionTLS11:
		version = "11"
	case tls.VersionTLS10:
		version = "10"
	}

	cipherCount := 0
	for _, cipher := range hello.CipherSuites {
		if !isGREASE(cipher) {
			cipherCount++
		}
	}

	extensionCount := 0
	sni := "i"
	for _, extension := range hello.Extensions {
		if !isGREASE(extension) {
			extensionCount++
		}
		if extension == 0 {
			sni = "d"
		}
	}

	alpn := "00"
	if len(hello.SupportedProtos) > 0 {
		protocol := hello.SupportedProtos[0]
		if len(protocol) > 0 {
			first, last := protocol[0], protocol[len(protocol)-1]
			if asciiAlphanumeric(first) && asciiAlphanumeric(last) {
				alpn = string([]byte{first, last})
			} else {
				encoded := fmt.Sprintf("%x", protocol)
				alpn = string([]byte{encoded[0], encoded[len(encoded)-1]})
			}
		}
	}

	return fmt.Sprintf(
		"t%s%s%02d%02d%s",
		version, sni, min(cipherCount, 99), min(extensionCount, 99), alpn,
	)
}

func asciiAlphanumeric(value byte) bool {
	return value >= '0' && value <= '9' ||
		value >= 'A' && value <= 'Z' ||
		value >= 'a' && value <= 'z'
}

func ja4CipherHash(ciphers []uint16) string {
	values := make([]string, 0, len(ciphers))

	for _, cipher := range ciphers {
		if !isGREASE(cipher) {
			values = append(values, fmt.Sprintf("%04x", cipher))
		}
	}

	if len(values) == 0 {
		return "000000000000"
	}

	sort.Strings(values)
	raw := strings.Join(values, ",")
	sum := sha256.Sum256([]byte(raw))

	return fmt.Sprintf("%x", sum)[:12]
}

func ja4ExtensionHash(
	extensions []uint16,
	signatures []tls.SignatureScheme,
) string {
	values := make([]string, 0, len(extensions))

	for _, extension := range extensions {
		if !isGREASE(extension) && extension != 0 && extension != 16 {
			values = append(values, fmt.Sprintf("%04x", extension))
		}
	}

	if len(values) == 0 {
		return "000000000000"
	}

	sort.Strings(values)
	raw := strings.Join(values, ",")

	signatureValues := make([]string, 0, len(signatures))
	for _, signature := range signatures {
		value := uint16(signature)
		if !isGREASE(value) {
			signatureValues = append(
				signatureValues,
				fmt.Sprintf("%04x", value),
			)
		}
	}

	if len(signatureValues) > 0 {
		raw += "_" + strings.Join(signatureValues, ",")
	}

	sum := sha256.Sum256([]byte(raw))
	return fmt.Sprintf("%x", sum)[:12]
}

func ja4(hello *tls.ClientHelloInfo) string {
	return fmt.Sprintf(
		"%s_%s_%s",
		ja4Prefix(hello),
		ja4CipherHash(hello.CipherSuites),
		ja4ExtensionHash(hello.Extensions, hello.SignatureSchemes),
	)
}
