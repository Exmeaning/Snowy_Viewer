package main

import (
	"fmt"
	"net/http"
	"os"

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

	// Static file serving
	if _, err := os.Stat("./dist"); !os.IsNotExist(err) {
		fmt.Println("Serving static files from ./dist")
		mux.Handle("/", middleware.FileServerWithExtensions("./dist"))
	} else {
		fmt.Println("Warning: ./dist directory not found. Only API will be served.")
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/" {
				fmt.Fprint(w, "Snowy Viewer Backend API Service Running (Static files not found)")
			} else {
				http.NotFound(w, r)
			}
		})
	}

	// Apply middlewares and start server
	finalHandler := middleware.Chain(mux, middleware.CORS, middleware.Gzip)

	fmt.Printf("Server starting on :%s...\n", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, finalHandler); err != nil {
		fmt.Printf("Error starting server: %s\n", err)
	}
}
