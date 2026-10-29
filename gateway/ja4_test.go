package main

import (
	"crypto/tls"
	"testing"
)

func TestJA4CipherHash(t *testing.T) {
	tests := []struct {
		name    string
		ciphers []uint16
		want    string
	}{
		{
			name: "FoxIO reference with GREASE",
			ciphers: []uint16{
				0x0a0a,
				0x1301, 0x1302, 0x1303,
				0xc02b, 0xc02f, 0xc02c, 0xc030,
				0xcca9, 0xcca8, 0xc013, 0xc014,
				0x009c, 0x009d, 0x002f, 0x0035,
			},
			want: "8daaf6152771",
		},
		{
			name: "empty list",
			want: "000000000000",
		},
		{
			name:    "only GREASE",
			ciphers: []uint16{0x0a0a, 0x1a1a},
			want:    "000000000000",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got := ja4CipherHash(test.ciphers)
			if got != test.want {
				t.Fatalf("got %q, want %q", got, test.want)
			}
		})
	}
}

func TestJA4Reference(t *testing.T) {
	hello := &tls.ClientHelloInfo{
		SupportedVersions: []uint16{tls.VersionTLS13, tls.VersionTLS12},
		SupportedProtos:   []string{"h2"},
		CipherSuites: []uint16{
			0x0a0a, // GREASE: must be ignored.
			0x1301, 0x1302, 0x1303,
			0xc02b, 0xc02f, 0xc02c, 0xc030,
			0xcca9, 0xcca8, 0xc013, 0xc014,
			0x009c, 0x009d, 0x002f, 0x0035,
		},
		Extensions: []uint16{
			0x1a1a, // GREASE: must be ignored.
			0x001b, 0x0000, 0x0033, 0x0010,
			0x4469, 0x0017, 0x002d, 0x000d,
			0x0005, 0x0023, 0x0012, 0x002b,
			0xff01, 0x000b, 0x000a, 0x0015,
		},
		SignatureSchemes: []tls.SignatureScheme{
			0x0403, 0x0804, 0x0401, 0x0503,
			0x0805, 0x0501, 0x0806, 0x0601,
		},
	}

	t.Run("complete FoxIO fingerprint", func(t *testing.T) {
		want := "t13d1516h2_8daaf6152771_e5627efa2ab1"
		if got := ja4(hello); got != want {
			t.Fatalf("got %q, want %q", got, want)
		}
	})

	t.Run("without signature algorithms", func(t *testing.T) {
		want := "6d807ffa2a79"
		if got := ja4ExtensionHash(hello.Extensions, nil); got != want {
			t.Fatalf("got %q, want %q", got, want)
		}
	})

	t.Run("no extensions remaining after filtering", func(t *testing.T) {
		got := ja4ExtensionHash(
			[]uint16{0x0a0a, 0x0000, 0x0010},
			hello.SignatureSchemes,
		)
		if got != "000000000000" {
			t.Fatalf("got %q, want zero hash", got)
		}
	})
}
