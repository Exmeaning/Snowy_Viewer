package main

import (
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"

	"snowy_viewer/internal/bilibili"
	"snowy_viewer/internal/cache"
	"snowy_viewer/internal/config"
	"snowy_viewer/internal/handlers"
	"snowy_viewer/internal/masterdata"
	"snowy_viewer/internal/middleware"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Initialize cache (Redis with memory fallback)
	appCache := cache.New(cfg.RedisURL)
	defer appCache.Close()

	// Initialize Bilibili client
	biliClient := bilibili.NewClient(appCache, cfg.BilibiliSessData, cfg.BilibiliCookie)

	// Initialize and load master data
	store := masterdata.NewStore(cfg.MasterDataPath)
	if err := store.Fetch(); err != nil {
		fmt.Printf("Initial fetch error: %v\n", err)
	}

	// Create router and register handlers
	mux := http.NewServeMux()
	handler := handlers.New(store, biliClient)
	handler.RegisterRoutes(mux)

	// Reverse proxy to Next.js standalone server for frontend
	nextjsURL, _ := url.Parse("http://localhost:3000")
	nextjsProxy := httputil.NewSingleHostReverseProxy(nextjsURL)
	nextjsProxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		fmt.Printf("Next.js proxy error for %s: %v\n", r.URL.Path, err)
		http.Error(w, "frontend upstream unavailable", http.StatusBadGateway)
	}

	// Prevent unknown /api/* paths from bouncing between Go and Next.js.
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	})

	fmt.Println("Proxying frontend requests to Next.js standalone server on :3000")
	mux.Handle("/", nextjsProxy)

	// Apply middlewares and start server
	finalHandler := middleware.Chain(mux, middleware.CORS, middleware.Gzip)

	fmt.Printf("Server starting on :%s...\n", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, finalHandler); err != nil {
		fmt.Printf("Error starting server: %s\n", err)
	}
}
