package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"snowy_viewer/internal/cache"
	"snowy_viewer/internal/config"
	"snowy_viewer/internal/handlers"
	"snowy_viewer/internal/htmlcache"
	"snowy_viewer/internal/masterdata"
	"snowy_viewer/internal/middleware"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Initialize cache (Redis with memory fallback)
	appCache := cache.New(cfg.RedisURL)
	defer appCache.Close()

	// Initialize and load master data
	store := masterdata.NewStore(cfg.MasterDataPath)
	if err := store.Fetch(); err != nil {
		fmt.Printf("Initial fetch error: %v\n", err)
	}

	// Create router and register handlers
	mux := http.NewServeMux()
	handler := handlers.New(store)
	handler.RegisterRoutes(mux)

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
			transport := http.DefaultTransport.(*http.Transport).Clone()
			transport.MaxIdleConns = 100
			transport.MaxIdleConnsPerHost = 32
			transport.IdleConnTimeout = 90 * time.Second
			transport.ResponseHeaderTimeout = 30 * time.Second
			nextjsProxy.Transport = transport
			nextjsProxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
				fmt.Printf("Next.js proxy error for %s: %v\n", r.URL.Path, err)
				http.Error(w, "frontend upstream unavailable", http.StatusBadGateway)
			}

			healthClient := &http.Client{Timeout: 2 * time.Second}
			healthURL := strings.TrimRight(cfg.FrontendProxyURL, "/") + "/internal-healthz/"
			mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
				if r.Method != http.MethodGet && r.Method != http.MethodHead {
					w.Header().Set("Allow", "GET, HEAD")
					http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
					return
				}

				req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, healthURL, nil)
				if err == nil {
					var resp *http.Response
					resp, err = healthClient.Do(req)
					if resp != nil {
						_ = resp.Body.Close()
						if resp.StatusCode != http.StatusNoContent {
							err = fmt.Errorf("unexpected frontend health status: %s", resp.Status)
						}
					}
				}

				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("Cache-Control", "no-store")
				if err != nil {
					w.WriteHeader(http.StatusServiceUnavailable)
					_ = json.NewEncoder(w).Encode(map[string]string{"status": "unhealthy", "frontend": "unavailable"})
					return
				}
				_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok", "frontend": "ok"})
			})

			// Intercept Next.js static files to serve from persistent archive directory if file exists
			if cfg.StaticArchiveDir != "" {
				staticPrefix := "/_next/static/"
				fileServer := http.StripPrefix(staticPrefix, http.FileServer(http.Dir(cfg.StaticArchiveDir)))

				mux.HandleFunc(staticPrefix, func(w http.ResponseWriter, r *http.Request) {
					relPath := r.URL.Path[len(staticPrefix):]
					filePath := filepath.Join(cfg.StaticArchiveDir, filepath.FromSlash(relPath))

					if info, err := os.Stat(filePath); err == nil && !info.IsDir() {
						w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
						fileServer.ServeHTTP(w, r)
						return
					}
					// Fallback to Next.js server if not present in archive
					nextjsProxy.ServeHTTP(w, r)
				})
				fmt.Printf("Serving persistent static assets from %s for %s\n", cfg.StaticArchiveDir, staticPrefix)
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
	if err := http.ListenAndServe(":"+cfg.Port, finalHandler); err != nil {
		fmt.Printf("Error starting server: %s\n", err)
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
