package htmlcache

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// StartWarmup runs a gentle background worker that warms up uncached routes
// during server idle periods without impacting live external traffic.
func (c *Cache) StartWarmup(ctx context.Context, routes []string, interval time.Duration) {
	if len(routes) == 0 || !c.ready {
		return
	}
	if interval <= 0 {
		interval = 400 * time.Millisecond
	}

	go func() {
		warmedCount := 0
		skippedCount := 0

		for _, path := range routes {
			select {
			case <-ctx.Done():
				return
			default:
			}

			// Normalize path
			if !strings.HasPrefix(path, "/") {
				path = "/" + path
			}

			req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://127.0.0.1"+path, nil)
			if err != nil {
				continue
			}
			req.Header.Set("Accept", "text/html")
			key := cacheKey(req)

			// If already cached and fresh, skip
			if entry, state := c.acquire(key); entry != nil {
				c.release(entry)
				if state == "HIT" {
					skippedCount++
					continue
				}
			}

			// Priority yielding: Wait until zero external requests are in flight
			for c.activeRequests.Load() > 0 {
				select {
				case <-ctx.Done():
					return
				case <-time.After(150 * time.Millisecond):
				}
			}

			// Perform warmup fetch and store
			meta, recorded := c.fetch(req)
			if meta != nil && c.store(key, meta, recorded.body.Bytes()) {
				warmedCount++
			}

			// Yield interval to avoid spiking CPU or memory
			select {
			case <-ctx.Done():
				return
			case <-time.After(interval):
			}
		}

		if warmedCount > 0 {
			fmt.Printf("[HTMLCache] Background warmup complete: %d warmed, %d already cached\n", warmedCount, skippedCount)
		}
	}()
}
