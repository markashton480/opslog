#!/usr/bin/env bash
# deploy/auto-deploy.sh — Polls main branch and redeploys if new commits detected.
# Intended to run via systemd timer (opslog-deploy.timer).
set -euo pipefail

REPO_DIR="/opt/opslog"
LOCK_FILE="/tmp/opslog-deploy.lock"
LOG_TAG="opslog-deploy"

log() { logger -t "$LOG_TAG" "$@"; echo "[$(date -Iseconds)] $*"; }

# Prevent concurrent runs
if [ -f "$LOCK_FILE" ]; then
    pid=$(cat "$LOCK_FILE" 2>/dev/null || true)
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        log "Another deploy is running (PID $pid), skipping"
        exit 0
    fi
    rm -f "$LOCK_FILE"
fi
echo $$ > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

cd "$REPO_DIR"

# Fetch latest from origin
git fetch origin main --quiet

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
    exit 0
fi

log "New commits detected: $LOCAL -> $REMOTE"
log "Pulling latest..."
git pull origin main --ff-only --quiet

log "Building and deploying..."
docker compose build --quiet 2>&1 | tail -5
docker compose up -d --remove-orphans 2>&1

log "Waiting for health check..."
sleep 10
if curl -sf http://localhost:8601/api/v1/health > /dev/null 2>&1; then
    log "Deploy successful — now at $(git rev-parse --short HEAD)"
else
    log "WARNING: Health check failed after deploy"
    exit 1
fi
