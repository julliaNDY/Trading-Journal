#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/debian/cryptosite"
PM2_NAME="cryptosite"

echo "==> 1) Aller dans le dossier du site"
cd "$APP_DIR"

echo "==> 2) Installer les dépendances (propre)"
npm ci

echo "==> 3) Rebuild Next.js (standalone)"
rm -rf .next
npm run build

echo "==> 4) Copier les fichiers nécessaires au mode standalone"
mkdir -p .next/standalone/.next
rm -rf .next/standalone/.next/static
cp -r .next/static .next/standalone/.next/static

rm -rf .next/standalone/public
cp -r public .next/standalone/public

echo "==> 5) Redémarrer PM2"
pm2 restart "$PM2_NAME" --update-env

echo "==> ✅ Terminé"
pm2 status "$PM2_NAME"
