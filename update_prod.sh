#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/debian/cryptosite"
PM2_NAME="cryptosite"
URL_TEST="http://127.0.0.1:3000/login"

echo "==> 0) Aller dans le dossier"
cd "$APP_DIR"

echo "==> 1) Vérifier que la DB Docker tourne"
docker compose ps | grep -q "cryptosite-db-1" || { echo "DB container introuvable"; exit 1; }

echo "==> 2) Backup DB (sécurité)"
/home/debian/backup_mysql.sh

echo "==> 3) Stop le site (évite des écritures pendant migration)"
pm2 stop "$PM2_NAME" || true

echo "==> 4) Récupérer le code"
git fetch --all
git pull --ff-only

echo "==> 5) Installer dépendances propres"
npm ci

echo "==> 6) Prisma (client + migrations PROD)"
npx prisma generate
npx prisma migrate deploy

echo "==> 7) Build Next.js (standalone)"
rm -rf .next
npm run build

echo "==> 8) Copier static + public dans standalone"
mkdir -p .next/standalone/.next
rm -rf .next/standalone/.next/static
cp -r .next/static .next/standalone/.next/static

rm -rf .next/standalone/public
cp -r public .next/standalone/public

echo "==> 9) Redémarrer le site"
pm2 restart "$PM2_NAME" --update-env
pm2 save

echo "==> 10) Test local /login"
curl -I "$URL_TEST" | head -n 1

echo "==> ✅ Update terminée"
