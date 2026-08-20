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

echo "==> Building production bundle with Webpack"
./node_modules/.bin/next build --webpack

echo "==> Removing non-runtime build cache"
rm -rf .next/cache

echo "==> Restarting PM2 app: $APP_NAME"
pm2 restart "$APP_NAME" --update-env
pm2 save

echo "==> Health check"
curl -fsS --max-time 15 http://127.0.0.1:3000/ >/dev/null
curl -fsS --max-time 30 http://127.0.0.1:3000/api/employees >/dev/null

echo "==> Deployment complete"
pm2 list
df -h "$APP_DIR"
