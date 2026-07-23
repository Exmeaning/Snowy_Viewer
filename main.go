package main

import (
	"errors"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"time"

	"snowy_viewer/internal/cache"
	"snowy_viewer/internal/config"
	"snowy_viewer/internal/handlers"
	"snowy_viewer/internal/htmlcache"
	"snowy_viewer/internal/masterdata"
	"snowy_viewer/internal/middleware"
)

const (
	serverReadHeaderTimeout   = 5 * time.Second
	serverReadTimeout         = 15 * time.Second
	serverWriteTimeout        = 30 * time.Second
	serverIdleTimeout         = 60 * time.Second
	serverMaxHeaderBytes      = 1 << 20
	masterDataRetryInterval   = 30 * time.Second
	masterDataRefreshInterval = 6 * time.Hour
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Initialize cache (Redis with memory fallback)
	appCache := cache.New(cfg.RedisURL)
	defer appCache.Close()

	// Initialize and load master data
	store := masterdata.NewStore(cfg.MasterDataPath)
	store.StartRetryUntilReady(masterDataRetryInterval)
	store.StartPeriodicUpdate(masterDataRefreshInterval)

	// Create router and register handlers
	mux := http.NewServeMux()
	handler := handlers.New(store)
	handler.RegisterRoutes(mux)
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})
	mux.HandleFunc("/readyz", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if !store.IsReady() {
			w.Header().Set("Cache-Control", "no-store")
			w.Header().Set("Retry-After", "30")
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = w.Write([]byte(`{"status":"unavailable"}`))
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ready"}`))
	})

	// Prevent unknown /api/* paths from bouncing between Go and Next.js.
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	})

	// Set up frontend proxy or default to API-only mode
	if cfg.FrontendProxyURL != "" && cfg.FrontendProxyURL != "none" {
		nextjsURL, err := url.Parse(cfg.FrontendProxyURL)
		if err != nil {
			fmt.Printf("Invalid FRONTEND_PROXY_URL %q: %v\n", cfg.FrontendProxyURL, err)
			setupAPIOnlyMode(mux)
		} else {
			nextjsProxy := httputil.NewSingleHostReverseProxy(nextjsURL)
			nextjsProxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
				fmt.Printf("Next.js proxy error for %s: %v\n", r.URL.Path, err)
				http.Error(w, "frontend upstream unavailable", http.StatusBadGateway)
			}
			fmt.Printf("Proxying frontend requests to Next.js server on %s\n", cfg.FrontendProxyURL)
			mux.Handle("/", htmlcache.New(nextjsProxy, htmlcache.Config{
				Dir:           cfg.HTMLCacheDir,
				MaxBytes:      int64(cfg.HTMLCacheMaxGB) << 30,
				MaxEntries:    cfg.HTMLCacheEntries,
				MaxEntryBytes: int64(cfg.HTMLCacheEntryMB) << 20,
			}))
		}
	} else {
		setupAPIOnlyMode(mux)
	}

	// Apply middlewares and start server
	finalHandler := middleware.Chain(mux, middleware.CORS, middleware.Gzip)

	fmt.Printf("Server starting on :%s...\n", cfg.Port)
	server := newHTTPServer(":"+cfg.Port, finalHandler)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		fmt.Printf("Error starting server: %s\n", err)
	}
}

func newHTTPServer(addr string, handler http.Handler) *http.Server {
	return &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadHeaderTimeout: serverReadHeaderTimeout,
		ReadTimeout:       serverReadTimeout,
		WriteTimeout:      serverWriteTimeout,
		IdleTimeout:       serverIdleTimeout,
		MaxHeaderBytes:    serverMaxHeaderBytes,
	}
}

func setupAPIOnlyMode(mux *http.ServeMux) {
	fmt.Println("Frontend proxy is disabled. API-only mode active.")
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"status":"ok","message":"PJSK Moe API Server"}`))
			return
		}
		http.NotFound(w, r)
	})
}
