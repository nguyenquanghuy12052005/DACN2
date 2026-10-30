package main

import (
	"crypto/tls"
	"reflect"
	"strings"
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

func foxIOClientHello() *tls.ClientHelloInfo {
	return &tls.ClientHelloInfo{
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
}

func TestJA4Reference(t *testing.T) {
	hello := foxIOClientHello()

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

func TestJA4VariantsFoxIO(t *testing.T) {
	// FoxIO technical_details/JA4.md at c6469a7b0dbf8fe963810162429fbfd9d1acc4d5.
	got := ja4Variants(foxIOClientHello())
	want := ja4Fingerprints{
		JA4:         "t13d1516h2_8daaf6152771_e5627efa2ab1",
		Raw:         "t13d1516h2_002f,0035,009c,009d,1301,1302,1303,c013,c014,c02b,c02c,c02f,c030,cca8,cca9_0005,000a,000b,000d,0012,0015,0017,001b,0023,002b,002d,0033,4469,ff01_0403,0804,0401,0503,0805,0501,0806,0601",
		Original:    "t13d1516h2_acb858a92679_18f69afefd3d",
		RawOriginal: "t13d1516h2_1301,1302,1303,c02b,c02f,c02c,c030,cca9,cca8,c013,c014,009c,009d,002f,0035_001b,0000,0033,0010,4469,0017,002d,000d,0005,0023,0012,002b,ff01,000b,000a,0015_0403,0804,0401,0503,0805,0501,0806,0601",
	}
	if got != want {
		t.Fatalf("FoxIO variants mismatch\ngot: %+v\nwant: %+v", got, want)
	}
}

func TestJA4VariantsOrderAndInput(t *testing.T) {
	hello := foxIOClientHello()
	ciphers := append([]uint16(nil), hello.CipherSuites...)
	extensions := append([]uint16(nil), hello.Extensions...)
	signatures := append([]tls.SignatureScheme(nil), hello.SignatureSchemes...)
	first := ja4Variants(hello)
	if !reflect.DeepEqual(hello.CipherSuites, ciphers) || !reflect.DeepEqual(hello.Extensions, extensions) || !reflect.DeepEqual(hello.SignatureSchemes, signatures) {
		t.Fatal("mutated ClientHello")
	}
	hello.CipherSuites[1], hello.CipherSuites[2] = hello.CipherSuites[2], hello.CipherSuites[1]
	hello.Extensions[1], hello.Extensions[2] = hello.Extensions[2], hello.Extensions[1]
	second := ja4Variants(hello)
	if first.JA4 != second.JA4 || first.Raw != second.Raw || first.Original == second.Original || first.RawOriginal == second.RawOriginal {
		t.Fatal("sorted/original ordering not preserved")
	}
	hello = foxIOClientHello()
	hello.SignatureSchemes[0], hello.SignatureSchemes[1] = hello.SignatureSchemes[1], hello.SignatureSchemes[0]
	third := ja4Variants(hello)
	if first.JA4 == third.JA4 || first.Raw == third.Raw || first.Original == third.Original || first.RawOriginal == third.RawOriginal {
		t.Fatal("signature order must not be sorted")
	}
	hello = foxIOClientHello()
	hello.SignatureSchemes = append([]tls.SignatureScheme{0x2a2a}, hello.SignatureSchemes...)
	if got := ja4Variants(hello); got != first {
		t.Fatal("GREASE signature was not removed")
	}
}

func TestJA4VariantsEmptyAndSpecialExtensions(t *testing.T) {
	got := ja4Variants(&tls.ClientHelloInfo{})
	if got.Raw != "t00i000000__" || got.RawOriginal != got.Raw || got.JA4 != "t00i000000_000000000000_000000000000" || got.Original != got.JA4 {
		t.Fatalf("empty: %+v", got)
	}
	grease := ja4Variants(&tls.ClientHelloInfo{CipherSuites: []uint16{0x0a0a}, Extensions: []uint16{0x1a1a}, SignatureSchemes: []tls.SignatureScheme{0x2a2a}})
	if grease != got {
		t.Fatal("GREASE-only fields differ from empty")
	}
	got = ja4Variants(&tls.ClientHelloInfo{Extensions: []uint16{16, 0}})
	if !strings.HasSuffix(got.Raw, "__") || !strings.HasSuffix(got.RawOriginal, "__0010,0000") || strings.HasSuffix(got.Original, "_000000000000") {
		t.Fatalf("original must retain SNI/ALPN: %+v", got)
	}
	hello := foxIOClientHello()
	hello.SignatureSchemes = nil
	got = ja4Variants(hello)
	if strings.Count(got.Raw, "_") != 2 || strings.Count(got.RawOriginal, "_") != 2 {
		t.Fatal("absent signatures must not add trailing underscore")
	}
}
