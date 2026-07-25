# Build Stage for Frontend
FROM oven/bun:latest AS builder-web
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates nodejs && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY refer/re_sekai-calculator/ refer/re_sekai-calculator/

WORKDIR /app
COPY web/ web/
WORKDIR /app/web
# Set API URL empty to allow relative fetching
ENV NEXT_PUBLIC_API_URL=
# OAuth2 client ID (baked into client JS at build time)
ENV NEXT_PUBLIC_OAUTH2_CLIENT_ID=snowy-viewer-public
# Build-time data sources. Multiple URLs allow Docker builds to survive flaky DNS/proxy/CDN paths.
ARG MASTER_DATA_URLS=https://metadata.exmeaning.com/{region}/master,https://metadata.pjsk.moe/{region}/master
ARG MANGA_DATA_URLS=https://moe.exmeaning.com/mangas/mangas.json
ARG REQUIRE_FRESH_BUILD_DATA=0
ENV MASTER_DATA_URLS=$MASTER_DATA_URLS
ENV MANGA_DATA_URLS=$MANGA_DATA_URLS
ENV REQUIRE_FRESH_BUILD_DATA=$REQUIRE_FRESH_BUILD_DATA
RUN find /app -name "package-lock.json" -exec sed -i 's/registry.npmmirror.com/registry.npmjs.org/g' {} +
RUN bun install --frozen-lockfile
RUN ls -la /app/refer/re_sekai-calculator/src/index.ts
RUN bun run build

# Build Stage for Backend
FROM golang:1.23-alpine AS builder-go
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY internal ./internal
COPY main.go .
RUN go build -o server main.go

# Runtime Stage
FROM node:20-alpine
WORKDIR /app

# Copy Backend
COPY --from=builder-go /app/server ./server

# Copy Next.js Standalone Server
COPY --from=builder-web /app/web/.next/standalone ./nextjs/
COPY --from=builder-web /app/web/.next/static ./nextjs/web/.next/static
COPY --from=builder-web /app/web/public ./nextjs/web/public

# Install certs for external API calls from backend
RUN apk add --no-cache ca-certificates wget

COPY scripts/start-container.sh /app/start.sh
RUN chmod +x /app/start.sh

# Translation files are served from Next.js public directory.
ENV TRANSLATION_PATH=/app/nextjs/web/public/data/translations
ENV TRANSLATION_AUTO_PUSH_ENABLED=false

# Go server is the single entry point, proxying frontend to Next.js internally
EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s --start-period=45s --retries=3 \
    CMD wget -q --spider "http://127.0.0.1:${PORT:-8080}/healthz" || exit 1

CMD ["/app/start.sh"]
