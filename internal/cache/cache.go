package cache

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

type Cache struct {
	redis       *redis.Client
	memoryCache sync.Map
	useRedis    bool
}

type MemoryCacheItem struct {
	Data      []byte
	ExpiresAt time.Time
}

var ctx = context.Background()

// New creates a new cache instance with Redis support
// Falls back to memory cache if Redis is unavailable
func New(redisURL string) *Cache {
	c := &Cache{
		useRedis: false,
	}

	if redisURL != "" {
		client := redis.NewClient(&redis.Options{
			Addr:     redisURL,
			Password: "",
			DB:       0,
		})

		// Test connection
		_, err := client.Ping(ctx).Result()
		if err != nil {
			fmt.Printf("Redis connection failed (%s), using memory cache: %v\n", redisURL, err)
			return c
		}

		c.redis = client
		c.useRedis = true
		fmt.Printf("Redis connected successfully: %s\n", redisURL)
	}

	return c
}

// Get retrieves a value from cache
func (c *Cache) Get(key string) ([]byte, bool) {
	if c.useRedis {
		val, err := c.redis.Get(ctx, key).Bytes()
		if err == nil {
			return val, true
		}
		return nil, false
	}

	// Memory cache fallback
	if item, ok := c.memoryCache.Load(key); ok {
		cached := item.(MemoryCacheItem)
		if time.Now().Before(cached.ExpiresAt) {
			return cached.Data, true
		}
		c.memoryCache.Delete(key)
	}
	return nil, false
}

// Set stores a value in cache with TTL
func (c *Cache) Set(key string, value []byte, ttl time.Duration) error {
	if c.useRedis {
		return c.redis.Set(ctx, key, value, ttl).Err()
	}

	// Memory cache fallback
	c.memoryCache.Store(key, MemoryCacheItem{
		Data:      value,
		ExpiresAt: time.Now().Add(ttl),
	})
	return nil
}

// Delete removes a key from cache
func (c *Cache) Delete(key string) error {
	if c.useRedis {
		return c.redis.Del(ctx, key).Err()
	}
	c.memoryCache.Delete(key)
	return nil
}

// Bilibili Dynamic Cache helpers
const (
	DynamicCacheTTL = 10 * time.Minute
	ImageCacheTTL   = 1 * time.Hour
)

func (c *Cache) GetDynamic(uid string) ([]byte, bool) {
	return c.Get("dynamic:" + uid)
}

func (c *Cache) SetDynamic(uid string, data []byte) error {
	return c.Set("dynamic:"+uid, data, DynamicCacheTTL)
}

func (c *Cache) GetImage(url string) ([]byte, string, bool) {
	data, ok := c.Get("img:" + url)
	if !ok {
		return nil, "", false
	}
	contentType, ok := c.Get("img_ct:" + url)
	if !ok {
		return nil, "", false
	}
	return data, string(contentType), true
}

func (c *Cache) SetImage(url string, data []byte, contentType string) error {
	if err := c.Set("img:"+url, data, ImageCacheTTL); err != nil {
		return err
	}
	return c.Set("img_ct:"+url, []byte(contentType), ImageCacheTTL)
}

// IsRedisEnabled returns whether Redis is being used
func (c *Cache) IsRedisEnabled() bool {
	return c.useRedis
}

// Close closes Redis connection if enabled
func (c *Cache) Close() error {
	if c.useRedis && c.redis != nil {
		return c.redis.Close()
	}
	return nil
}
