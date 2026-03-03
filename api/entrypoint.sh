#!/bin/sh
set -e

echo "Running database migrations..."
python scripts/migrate.py

echo "Starting API server..."
exec "$@"
