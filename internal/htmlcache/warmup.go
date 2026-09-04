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

	totalRoutes := len(routes)
	startTime := time.Now()

	c.warmupMu.Lock()
	c.warmupStats = WarmupStats{
		Total:      totalRoutes,
		InProgress: true,
		StartTime:  startTime,
	}
	c.warmupMu.Unlock()

	fmt.Printf("[HTMLCache Warmup] Starting background warmup for %d routes (interval: %v)\n", totalRoutes, interval)

	go func() {
		warmedCount := 0
		skippedCount := 0

		defer func() {
			endTime := time.Now()
			c.warmupMu.Lock()
			c.warmupStats.Completed = totalRoutes
			c.warmupStats.Warmed = warmedCount
			c.warmupStats.Skipped = skippedCount
			c.warmupStats.InProgress = false
			c.warmupStats.EndTime = endTime
			c.warmupMu.Unlock()

			duration := endTime.Sub(startTime).Round(time.Second)
			fmt.Printf("[HTMLCache Warmup] Complete in %v: %d newly warmed, %d already cached (total %d routes)\n",
				duration, warmedCount, skippedCount, totalRoutes)
		}()

		for i, path := range routes {
			select {
			case <-ctx.Done():
				return
			default:
			}

			// Normalize path
			if !strings.HasPrefix(path, "/") {
				path = "/" + path
			}

			c.warmupMu.Lock()
			c.warmupStats.Completed = i
			c.warmupStats.Warmed = warmedCount
			c.warmupStats.Skipped = skippedCount
			c.warmupStats.CurrentPath = path
			c.warmupMu.Unlock()

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
					if (i+1)%50 == 0 || i < 3 {
						c.logWarmupProgress(i+1, totalRoutes, warmedCount, skippedCount, path)
					}
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

			if (i+1)%50 == 0 || i < 3 || i+1 == totalRoutes {
				c.logWarmupProgress(i+1, totalRoutes, warmedCount, skippedCount, path)
			}

			// Yield interval to avoid spiking CPU or memory
			select {
			case <-ctx.Done():
				return
			case <-time.After(interval):
			}
		}
	}()
}

func (c *Cache) logWarmupProgress(completed, total, warmed, skipped int, currentPath string) {
	c.mu.Lock()
	bytes := c.bytes
	entries := len(c.items)
	c.mu.Unlock()

	pct := float64(completed) / float64(total) * 100
	fmt.Printf("[HTMLCache Warmup] [%d/%d] (%.1f%%) | Warmed: %d | Hits: %d | Disk: %.1f MB (%d files) | %s\n",
		completed, total, pct, warmed, skipped, float64(bytes)/(1024*1024), entries, currentPath)
}
