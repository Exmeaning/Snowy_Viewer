package middleware

import (
	"compress/gzip"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// gzipResponseWriter wraps http.ResponseWriter for gzip compression
type gzipResponseWriter struct {
	io.Writer
	http.ResponseWriter
}

func (w gzipResponseWriter) Write(b []byte) (int, error) {
	return w.Writer.Write(b)
}

// Gzip middleware for response compression
func Gzip(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
			next.ServeHTTP(w, r)
			return
		}
		w.Header().Set("Content-Encoding", "gzip")
		gz := gzip.NewWriter(w)
		defer gz.Close()
		gzw := gzipResponseWriter{Writer: gz, ResponseWriter: w}
		next.ServeHTTP(gzw, r)
	})
}

// CORS middleware for cross-origin requests
func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// Chain applies multiple middlewares in order
func Chain(h http.Handler, middlewares ...func(http.Handler) http.Handler) http.Handler {
	for i := len(middlewares) - 1; i >= 0; i-- {
		h = middlewares[i](h)
	}
	return h
}

// Serve404 serves a custom 404 page if available
func Serve404(w http.ResponseWriter, root string) {
	notFoundPath := filepath.Join(root, "404.html")
	if content, err := os.ReadFile(notFoundPath); err == nil {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusNotFound)
		w.Write(content)
		return
	}
	http.NotFound(w, nil)
}

// FileServerWithExtensions serves static files with .html extension fallback
func FileServerWithExtensions(root string) http.Handler {
	fs := http.FileServer(http.Dir(root))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cleanPath := filepath.Clean(r.URL.Path)
		fullPath := filepath.Join(root, cleanPath)

		info, err := os.Stat(fullPath)
		if err == nil {
			if !info.IsDir() {
				fs.ServeHTTP(w, r)
				return
			}
			indexPath := filepath.Join(fullPath, "index.html")
			if _, err := os.Stat(indexPath); err == nil {
				fs.ServeHTTP(w, r)
				return
			}
		}

		htmlPath := fullPath + ".html"
		if _, err := os.Stat(htmlPath); err == nil {
			r.URL.Path += ".html"
			fs.ServeHTTP(w, r)
			return
		}

		if filepath.Ext(cleanPath) != "" {
			Serve404(w, root)
			return
		}
		Serve404(w, root)
	})
}
