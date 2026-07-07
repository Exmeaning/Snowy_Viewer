package config

import (
	"os"
)

type Config struct {
	RedisURL         string
	Port             string
	MasterDataPath   string
	FrontendProxyURL string
}

func Load() *Config {
	cfg := &Config{
		RedisURL:         getEnv("REDIS_URL", "localhost:6379"),
		Port:             getEnv("PORT", "8080"),
		MasterDataPath:   getEnv("MASTER_DATA_PATH", "./data/master"),
		FrontendProxyURL: getEnv("FRONTEND_PROXY_URL", "http://localhost:3000"),
	}
	return cfg
}

func getEnv(key, defaultValue string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultValue
}
