package config

import (
	"os"
)

type Config struct {
	RedisURL         string
	BilibiliSessData string
	BilibiliCookie   string
	Port             string
	MasterDataPath   string
}

func Load() *Config {
	cfg := &Config{
		RedisURL:         getEnv("REDIS_URL", "localhost:6379"),
		BilibiliSessData: os.Getenv("BILIBILI_SESSDATA"),
		BilibiliCookie:   os.Getenv("BILIBILI_COOKIE"),
		Port:             getEnv("PORT", "8080"),
		MasterDataPath:   getEnv("MASTER_DATA_PATH", "./data/master"),
	}
	return cfg
}

func getEnv(key, defaultValue string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultValue
}
