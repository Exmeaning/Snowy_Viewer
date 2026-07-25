#!/bin/sh
set -eu

NEXTJS_PID=""
GO_PID=""
GO_PORT="${PORT:-8080}"

cleanup() {
    trap - EXIT INT TERM
    if [ -n "$NEXTJS_PID" ]; then
        kill -TERM "$NEXTJS_PID" 2>/dev/null || true
    fi
    if [ -n "$GO_PID" ]; then
        kill -TERM "$GO_PID" 2>/dev/null || true
    fi
    for i in 1 2 3 4 5; do
        NEXTJS_ALIVE=0
        GO_ALIVE=0
        [ -z "$NEXTJS_PID" ] || ! kill -0 "$NEXTJS_PID" 2>/dev/null || NEXTJS_ALIVE=1
        [ -z "$GO_PID" ] || ! kill -0 "$GO_PID" 2>/dev/null || GO_ALIVE=1
        [ "$NEXTJS_ALIVE" -eq 1 ] || [ "$GO_ALIVE" -eq 1 ] || break
        sleep 1
    done
    [ -z "$NEXTJS_PID" ] || kill -KILL "$NEXTJS_PID" 2>/dev/null || true
    [ -z "$GO_PID" ] || kill -KILL "$GO_PID" 2>/dev/null || true
    [ -z "$NEXTJS_PID" ] || wait "$NEXTJS_PID" 2>/dev/null || true
    [ -z "$GO_PID" ] || wait "$GO_PID" 2>/dev/null || true
}

trap cleanup EXIT
trap 'exit 143' INT TERM

ARCHIVE_DIR="${STATIC_ARCHIVE_DIR:-/app/data/static_archive}"
MAX_DAYS="${STATIC_CACHE_MAX_DAYS:-30}"
mkdir -p "$ARCHIVE_DIR"
if [ -d /app/nextjs/web/.next/static ]; then
    echo "Syncing Next.js static assets to $ARCHIVE_DIR..."
    cp -r /app/nextjs/web/.next/static/. "$ARCHIVE_DIR/" 2>/dev/null || true
fi
if [ -n "$MAX_DAYS" ] && [ "$MAX_DAYS" -gt 0 ]; then
    echo "Cleaning up static assets older than $MAX_DAYS days in $ARCHIVE_DIR..."
    find "$ARCHIVE_DIR" -type f -mtime +"$MAX_DAYS" -delete 2>/dev/null || true
    find "$ARCHIVE_DIR" -type d -empty -delete 2>/dev/null || true
fi

(
    cd /app/nextjs/web
    exec env \
        PORT=3000 \
        HOSTNAME=127.0.0.1 \
        NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=512}" \
        node server.js
) &
NEXTJS_PID=$!

echo "Waiting for Next.js to start..."
NEXTJS_READY=0
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
    if wget -q --spider http://127.0.0.1:3000/internal-healthz/ 2>/dev/null; then
        NEXTJS_READY=1
        echo "Next.js is ready"
        break
    fi
    if ! kill -0 "$NEXTJS_PID" 2>/dev/null; then
        echo "Next.js exited during startup"
        exit 1
    fi
    echo "Attempt $i: Next.js not ready yet, waiting..."
    sleep 2
done

if [ "$NEXTJS_READY" -ne 1 ]; then
    echo "Next.js did not become ready in time"
    exit 1
fi

(
    cd /app
    exec ./server
) &
GO_PID=$!

echo "Waiting for the combined service health check..."
SERVICE_READY=0
for i in 1 2 3 4 5 6 7 8 9 10; do
    if wget -q --spider "http://127.0.0.1:$GO_PORT/healthz" 2>/dev/null; then
        SERVICE_READY=1
        echo "Combined service is ready"
        break
    fi
    if ! kill -0 "$GO_PID" 2>/dev/null; then
        echo "Go server exited during startup"
        exit 1
    fi
    sleep 1
done

if [ "$SERVICE_READY" -ne 1 ]; then
    echo "Combined service did not become ready in time"
    exit 1
fi

FAILURES=0
while true; do
    if ! kill -0 "$NEXTJS_PID" 2>/dev/null; then
        echo "Next.js exited unexpectedly"
        exit 1
    fi
    if ! kill -0 "$GO_PID" 2>/dev/null; then
        echo "Go server exited unexpectedly"
        exit 1
    fi

    if wget -q --spider "http://127.0.0.1:$GO_PORT/healthz" 2>/dev/null; then
        FAILURES=0
    else
        FAILURES=$((FAILURES + 1))
        echo "Combined health check failed ($FAILURES/3)"
        if [ "$FAILURES" -ge 3 ]; then
            echo "Service remained unhealthy; exiting so the container can restart"
            exit 1
        fi
    fi
    sleep 5
done
