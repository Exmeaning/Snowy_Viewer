package config

import (
	"os"
	"strconv"
)

type Config struct {
	RedisURL           string
	Port               string
	MasterDataPath     string
	FrontendProxyURL   string
	HTMLCacheDir       string
	HTMLCacheMaxGB     int
	HTMLCacheEntries   int
	HTMLCacheEntryMB   int
	StaticArchiveDir   string
	StaticCacheMaxDays int
}

func Load() *Config {
	cfg := &Config{
		RedisURL:           getEnv("REDIS_URL", "localhost:6379"),
		Port:               getEnv("PORT", "8080"),
		MasterDataPath:     getEnv("MASTER_DATA_PATH", "./data/master"),
		FrontendProxyURL:   getEnv("FRONTEND_PROXY_URL", "http://localhost:3000"),
		HTMLCacheDir:       getEnv("HTML_CACHE_DIR", ""),
		HTMLCacheMaxGB:     getEnvInt("HTML_CACHE_MAX_GB", 20),
		HTMLCacheEntries:   getEnvInt("HTML_CACHE_MAX_ENTRIES", 100_000),
		HTMLCacheEntryMB:   getEnvInt("HTML_CACHE_MAX_ENTRY_MB", 4),
		StaticArchiveDir:   getEnv("STATIC_ARCHIVE_DIR", "./data/static_archive"),
		StaticCacheMaxDays: getEnvInt("STATIC_CACHE_MAX_DAYS", 30),
	}
	return cfg
}

func getEnvInt(key string, defaultValue int) int {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return defaultValue
	}
	return parsed
}

func getEnv(key, defaultValue string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultValue
}
