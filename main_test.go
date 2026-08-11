package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"testing"

	"snowy_viewer/internal/masterdata"
)

func TestHTTPServerHasExplicitResourceBounds(t *testing.T) {
	server := newHTTPServer(":0", http.NewServeMux())

	if server.ReadHeaderTimeout != serverReadHeaderTimeout {
		t.Fatalf("ReadHeaderTimeout = %v, want %v", server.ReadHeaderTimeout, serverReadHeaderTimeout)
	}
	if server.ReadTimeout != serverReadTimeout {
		t.Fatalf("ReadTimeout = %v, want %v", server.ReadTimeout, serverReadTimeout)
	}
	if server.WriteTimeout != serverWriteTimeout {
		t.Fatalf("WriteTimeout = %v, want %v", server.WriteTimeout, serverWriteTimeout)
	}
	if server.IdleTimeout != serverIdleTimeout {
		t.Fatalf("IdleTimeout = %v, want %v", server.IdleTimeout, serverIdleTimeout)
	}
	if server.MaxHeaderBytes != serverMaxHeaderBytes {
		t.Fatalf("MaxHeaderBytes = %d, want %d", server.MaxHeaderBytes, serverMaxHeaderBytes)
	}
}

func TestFrontendHealthRouteReflectsInternalFrontend(t *testing.T) {
	frontend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/internal-healthz/" {
			http.NotFound(w, r)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer frontend.Close()

	mux := http.NewServeMux()
	registerFrontendHealthRoute(mux, newFrontendHealthCheck(frontend.URL))
	request := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	response := httptest.NewRecorder()
	mux.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusOK)
	}
	var body map[string]string
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode health response: %v", err)
	}
	if body["frontend"] != "ok" {
		t.Fatalf("frontend = %q, want ok", body["frontend"])
	}
}

func TestFrontendHealthRouteReturnsUnavailableWhenFrontendFails(t *testing.T) {
	frontend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "failed", http.StatusInternalServerError)
	}))
	frontendURL := frontend.URL
	frontend.Close()

	mux := http.NewServeMux()
	registerFrontendHealthRoute(mux, newFrontendHealthCheck(frontendURL))
	request := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	response := httptest.NewRecorder()
	mux.ServeHTTP(response, request)

	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusServiceUnavailable)
	}
}

func TestReadinessRouteTracksMasterDataState(t *testing.T) {
	pendingMux := http.NewServeMux()
	registerReadinessRoute(pendingMux, masterdata.NewStore(t.TempDir()), nil)

	before := httptest.NewRecorder()
	pendingMux.ServeHTTP(before, httptest.NewRequest(http.MethodGet, "/readyz", nil))
	if before.Code != http.StatusServiceUnavailable {
		t.Fatalf("initial status = %d, want %d", before.Code, http.StatusServiceUnavailable)
	}
	if before.Header().Get("Retry-After") != "30" {
		t.Fatalf("Retry-After = %q, want 30", before.Header().Get("Retry-After"))
	}

	readyDir := t.TempDir()
	for _, filename := range []string{"events.json", "eventCards.json", "eventMusics.json", "virtualLives.json", "gachas.json"} {
		if err := os.WriteFile(filepath.Join(readyDir, filename), []byte("[]"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	readyStore := masterdata.NewStore(readyDir)
	if err := readyStore.Fetch(); err != nil {
		t.Fatal(err)
	}
	readyMux := http.NewServeMux()
	registerReadinessRoute(readyMux, readyStore, nil)

	after := httptest.NewRecorder()
	readyMux.ServeHTTP(after, httptest.NewRequest(http.MethodGet, "/readyz", nil))
	if after.Code != http.StatusOK {
		t.Fatalf("ready status = %d, want %d", after.Code, http.StatusOK)
	}

	frontendDownMux := http.NewServeMux()
	registerReadinessRoute(frontendDownMux, readyStore, func(context.Context) error {
		return errors.New("frontend unavailable")
	})
	frontendDown := httptest.NewRecorder()
	frontendDownMux.ServeHTTP(frontendDown, httptest.NewRequest(http.MethodGet, "/readyz", nil))
	if frontendDown.Code != http.StatusServiceUnavailable {
		t.Fatalf("frontend-down status = %d, want %d", frontendDown.Code, http.StatusServiceUnavailable)
	}
}

func TestStaticArchiveRouteUsesArchiveAndFallsBack(t *testing.T) {
	archiveDir := t.TempDir()
	assetPath := filepath.Join(archiveDir, "chunks", "archived.js")
	if err := os.MkdirAll(filepath.Dir(assetPath), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(assetPath, []byte("archived"), 0o600); err != nil {
		t.Fatal(err)
	}

	fallback := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("fallback:" + r.URL.Path))
	})
	mux := http.NewServeMux()
	registerStaticArchiveRoute(mux, archiveDir, fallback)

	archived := httptest.NewRecorder()
	mux.ServeHTTP(archived, httptest.NewRequest(http.MethodGet, "/_next/static/chunks/archived.js", nil))
	if archived.Body.String() != "archived" {
		t.Fatalf("archived body = %q", archived.Body.String())
	}
	if archived.Header().Get("Cache-Control") != "public, max-age=31536000, immutable" {
		t.Fatalf("Cache-Control = %q", archived.Header().Get("Cache-Control"))
	}

	missing := httptest.NewRecorder()
	mux.ServeHTTP(missing, httptest.NewRequest(http.MethodGet, "/_next/static/chunks/missing.js", nil))
	if missing.Body.String() != "fallback:/_next/static/chunks/missing.js" {
		t.Fatalf("fallback body = %q", missing.Body.String())
	}

	for _, escapedPath := range []string{
		"/_next/static/../secret.txt",
		"/_next/static/%2e%2e/secret.txt",
		"/_next/static/chunks/%2e%2e/%2e%2e/secret.txt",
	} {
		response := httptest.NewRecorder()
		mux.ServeHTTP(response, httptest.NewRequest(http.MethodGet, escapedPath, nil))
		if response.Body.String() == "secret" {
			t.Fatalf("archive traversal path %q escaped the archive root", escapedPath)
		}
	}
}

func TestParseFrontendProxyURLRejectsUnsafeValues(t *testing.T) {
	for _, raw := range []string{"", "127.0.0.1:3000", "ftp://127.0.0.1:3000", "http://user:pass@127.0.0.1:3000"} {
		t.Run(raw, func(t *testing.T) {
			if _, err := parseFrontendProxyURL(raw); err == nil {
				t.Fatalf("parseFrontendProxyURL(%q) unexpectedly succeeded", raw)
			}
		})
	}

	parsed, err := parseFrontendProxyURL("http://127.0.0.1:3000")
	if err != nil {
		t.Fatalf("valid proxy URL failed: %v", err)
	}
	if parsed.Host != "127.0.0.1:3000" {
		t.Fatalf("host = %q", parsed.Host)
	}
}

func TestFrontendProxyPreservesHTTPSForwardedProto(t *testing.T) {
	target, err := url.Parse("http://127.0.0.1:3000")
	if err != nil {
		t.Fatal(err)
	}
	proxy := newFrontendProxy(target)
	request := httptest.NewRequest(http.MethodGet, "http://pjsk.moe/lyrics/1/", nil)
	request.Header.Set("X-Forwarded-Proto", "https")
	request.Header.Set("X-Forwarded-Host", "pjsk.moe")

	proxy.Director(request)

	if request.Header.Get("X-Forwarded-Proto") != "https" {
		t.Fatalf("X-Forwarded-Proto = %q, want https", request.Header.Get("X-Forwarded-Proto"))
	}
	if request.Header.Get("X-Forwarded-Host") != "pjsk.moe" {
		t.Fatalf("X-Forwarded-Host = %q, want pjsk.moe", request.Header.Get("X-Forwarded-Host"))
	}
}
