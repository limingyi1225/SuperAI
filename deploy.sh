#!/bin/bash
set -euo pipefail

SERVER="nyuclass"
REMOTE_DIR="/var/www/isabby"
PM2_NAME="isabby"

echo "========================================="
echo "  IsabbY - Deploy to Server"
echo "========================================="

# 0. Local gate: lint, typecheck, tests. Skip with SKIP_GATE=1 for emergency deploys.
if [ "${SKIP_GATE:-0}" != "1" ]; then
    echo "[0/4] Running lint, typecheck & tests locally..."
    npm run lint
    npm run typecheck
    npm test
else
    echo "[0/4] Skipping local gate (SKIP_GATE=1)"
fi

# 1. Sync code to server
echo "[1/4] Syncing code to server..."
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.next.pre-*' \
  --exclude '.next_stale_*' \
  --exclude '.git' \
  --exclude '.env' \
  --exclude '.env.local' \
  --exclude 'output/' \
  --exclude 'docs/' \
  -e ssh ./ ${SERVER}:${REMOTE_DIR}/

# 2. Install & Build on server
echo "[2/4] Installing dependencies & building on server..."
ssh ${SERVER} "cd ${REMOTE_DIR} && npm install --prefer-offline --no-audit --no-fund && npm run build"

# 3. Prepare standalone + restart PM2
echo "[3/4] Preparing standalone & restarting application..."
ssh ${SERVER} "cd ${REMOTE_DIR} && \
    cp -r public .next/standalone/public 2>/dev/null; \
    cp -r .next/static .next/standalone/.next/static 2>/dev/null; \
    cp .env.local .next/standalone/.env.local 2>/dev/null; \
    pm2 delete ${PM2_NAME} 2>/dev/null || true; \
    cd .next/standalone && PORT=3001 pm2 start server.js --name ${PM2_NAME} && pm2 save && pm2 status"

# 4. Verify bundle size (warn if standalone > 500 MB)
echo "[4/4] Verifying standalone bundle size..."
ssh ${SERVER} "cd ${REMOTE_DIR}/.next/standalone && du -sh . && \
    SIZE_MB=\$(du -sm . | awk '{print \$1}'); \
    if [ \"\$SIZE_MB\" -gt 500 ]; then \
        echo \"⚠️  Standalone bundle is \${SIZE_MB} MB (soft limit: 500 MB)\"; \
    fi"

echo "========================================="
echo "  ✅ Deploy complete!"
echo "========================================="
