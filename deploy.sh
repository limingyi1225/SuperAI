#!/bin/bash
set -e

SERVER="nyuclass"
REMOTE_DIR="/var/www/isabby"
PM2_NAME="isabby"

echo "========================================="
echo "  IsabbY - Deploy to Server"
echo "========================================="

# 1. Sync code to server
echo "[1/3] Syncing code to server..."
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.git' \
  --exclude '.env' \
  --exclude '.env.local' \
  -e ssh ./ ${SERVER}:${REMOTE_DIR}/

# 2. Install & Build on server
echo "[2/3] Installing dependencies & building on server..."
ssh ${SERVER} "cd ${REMOTE_DIR} && npm install && npm run build"

# 3. Copy static assets & env for standalone mode & restart PM2
echo "[3/3] Preparing standalone & restarting application..."
ssh ${SERVER} "cd ${REMOTE_DIR} && cp -r public .next/standalone/public 2>/dev/null; cp -r .next/static .next/standalone/.next/static 2>/dev/null; cp .env.local .next/standalone/.env.local 2>/dev/null; pm2 delete ${PM2_NAME} 2>/dev/null || true; cd .next/standalone && PORT=3001 pm2 start server.js --name ${PM2_NAME} && pm2 save && pm2 status"

echo "========================================="
echo "  ✅ Deploy complete!"
echo "========================================="
