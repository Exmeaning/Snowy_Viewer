#!/bin/sh
set -eu

nextjs_pid=""
go_pid=""

stop_children() {
    trap - EXIT INT TERM
    if [ -n "$nextjs_pid" ]; then kill "$nextjs_pid" 2>/dev/null || true; fi
    if [ -n "$go_pid" ]; then kill "$go_pid" 2>/dev/null || true; fi
    if [ -n "$nextjs_pid" ]; then wait "$nextjs_pid" 2>/dev/null || true; fi
    if [ -n "$go_pid" ]; then wait "$go_pid" 2>/dev/null || true; fi
}

trap stop_children EXIT INT TERM

(cd /app/nextjs/web && exec env PORT=3000 HOSTNAME=0.0.0.0 node server.js) &
nextjs_pid=$!

ready=0
for attempt in 1 2 3 4 5 6 7 8 9 10; do
    if wget -q --spider http://127.0.0.1:3000/ 2>/dev/null; then
        ready=1
        break
    fi
    echo "Attempt $attempt: Next.js not ready yet"
    sleep 2
done
if [ "$ready" -ne 1 ]; then
    echo "Next.js failed to become ready" >&2
    exit 1
fi

(cd /app && exec ./server) &
go_pid=$!

set +e
wait -n "$nextjs_pid" "$go_pid"
status=$?
set -e
exit "$status"
