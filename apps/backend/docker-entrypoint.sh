#!/bin/sh
set -e

echo "=========================================="
echo "Open IllustBoard - Backend Startup"
echo "=========================================="

cd /app/apps/backend

# Check migration status before deployment
echo ""
echo "[Migration] Checking current status..."
npx prisma migrate status 2>&1 || true

# Run migrations
echo ""
echo "[Migration] Deploying pending migrations..."
if npx prisma migrate deploy; then
    echo "[Migration] Successfully deployed"
else
    echo "[Migration] ERROR: Migration failed!"
    echo "[Migration] Please check the logs above for details"
    exit 1
fi

# Verify migration status after deployment
echo ""
echo "[Migration] Verifying final status..."
npx prisma migrate status 2>&1 || true

echo ""
echo "=========================================="
echo "Starting backend server..."
echo "=========================================="
exec node /app/apps/backend/dist/main.js
