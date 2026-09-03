#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/orbit-p-folktsn}"
APP_NAME="${APP_NAME:-orbit-p}"
BRANCH="${BRANCH:-main}"

cd "$APP_DIR"

echo "==> Fetching latest code from origin/$BRANCH"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

LOCK_HASH_FILE=".deploy-package-lock.sha256"
LOCK_HASH="$(sha256sum package-lock.json | awk '{print $1}')"
PREVIOUS_LOCK_HASH=""
if [ -f "$LOCK_HASH_FILE" ]; then
  PREVIOUS_LOCK_HASH="$(cat "$LOCK_HASH_FILE")"
fi

if [ ! -d node_modules ] || [ "$LOCK_HASH" != "$PREVIOUS_LOCK_HASH" ]; then
  echo "==> Installing dependencies"
  npm ci --prefer-offline --no-audit --fund=false
  echo "$LOCK_HASH" > "$LOCK_HASH_FILE"
else
  echo "==> Dependencies unchanged"
fi

echo "==> Generating Prisma client"
./node_modules/.bin/prisma generate

echo "==> Applying additive Prisma schema changes"
./node_modules/.bin/prisma db push

echo "==> Building production bundle with Webpack"
./node_modules/.bin/next build --webpack

echo "==> Removing non-runtime build cache"
rm -rf .next/cache

echo "==> Restarting PM2 app: $APP_NAME"
pm2 restart "$APP_NAME" --update-env
pm2 save

echo "==> Health check"
for attempt in {1..30}; do
  if curl -fsS --max-time 5 http://127.0.0.1:3000/ >/dev/null; then
    break
  fi

  if [ "$attempt" -eq 30 ]; then
    echo "Health check failed: app did not respond on port 3000" >&2
    exit 1
  fi

  sleep 1
done

API_STATUS="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 30 http://127.0.0.1:3000/api/employees)"
if [ "$API_STATUS" != "401" ]; then
  echo "Health check failed: unauthenticated employees API returned $API_STATUS (expected 401)" >&2
  exit 1
fi

echo "==> Deployment complete"
pm2 list
df -h "$APP_DIR"
