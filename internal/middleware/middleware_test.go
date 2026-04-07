package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCORS_PublicMapEndpointsAllowAllOrigins(t *testing.T) {
	tests := []struct {
		name string
		path string
	}{
		{name: "card event map", path: "/api/card-event-map"},
		{name: "card gacha map", path: "/api/card-gacha-map"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler := CORS(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusNoContent)
			}))

			req := httptest.NewRequest(http.MethodGet, tt.path, nil)
			req.Header.Set("Origin", "https://evil.example")
			rr := httptest.NewRecorder()

			handler.ServeHTTP(rr, req)

			if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "*" {
				t.Fatalf("Access-Control-Allow-Origin = %q, want %q", got, "*")
			}
			if got := rr.Header().Get("Vary"); got != "" {
				t.Fatalf("Vary = %q, want empty", got)
			}
		})
	}
}

func TestCORS_PublicMapEndpointsHandleOptionsWithWildcard(t *testing.T) {
	called := false
	handler := CORS(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodOptions, "/api/card-gacha-map", nil)
	req.Header.Set("Origin", "https://evil.example")
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if called {
		t.Fatal("next handler should not be called for OPTIONS requests")
	}
	if rr.Code != http.StatusOK {
		t.Fatalf("status code = %d, want %d", rr.Code, http.StatusOK)
	}
	if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "*" {
		t.Fatalf("Access-Control-Allow-Origin = %q, want %q", got, "*")
	}
}

func TestCORS_NonMapEndpointsEchoAllowedOrigins(t *testing.T) {
	handler := CORS(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/gachas", nil)
	req.Header.Set("Origin", "https://pjsk.moe")
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "https://pjsk.moe" {
		t.Fatalf("Access-Control-Allow-Origin = %q, want %q", got, "https://pjsk.moe")
	}
	if got := rr.Header().Get("Vary"); got != "Origin" {
		t.Fatalf("Vary = %q, want %q", got, "Origin")
	}
}

func TestCORS_NonMapEndpointsRejectUnknownOrigins(t *testing.T) {
	handler := CORS(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/gachas", nil)
	req.Header.Set("Origin", "https://evil.example")
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("Access-Control-Allow-Origin = %q, want empty", got)
	}
}
