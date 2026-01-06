#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/debian/cryptosite"
PM2_NAME="cryptosite"
URL_TEST="http://127.0.0.1:3000/login"

echo "=========================================="
echo "🚀 Déploiement Trading Journal (Supabase)"
echo "=========================================="

echo "==> 0) Aller dans le dossier"
cd "$APP_DIR"

echo "==> 1) Stop le site (évite des écritures pendant migration)"
pm2 stop "$PM2_NAME" || true

echo "==> 2) Récupérer le code"
git fetch --all
git pull --ff-only

echo "==> 3) Installer dépendances propres"
npm ci --legacy-peer-deps

echo "==> 4) Prisma generate (client)"
npx prisma generate

echo "==> 5) Prisma migrate (si nouvelles migrations)"
npx prisma migrate deploy

echo "==> 6) Build Next.js (standalone)"
rm -rf .next
npm run build

echo "==> 7) Copier static + public dans standalone"
mkdir -p .next/standalone/.next
rm -rf .next/standalone/.next/static
cp -r .next/static .next/standalone/.next/static

rm -rf .next/standalone/public
cp -r public .next/standalone/public

echo "==> 8) Redémarrer le site"
pm2 restart "$PM2_NAME" --update-env
pm2 save

echo "==> 9) Test local /login"
sleep 3
curl -s -o /dev/null -w "%{http_code}" "$URL_TEST" | grep -q "200" && echo "✅ Site OK (200)" || echo "⚠️ Vérifier le site"

echo ""
echo "=========================================="
echo "✅ Déploiement terminé !"
echo "=========================================="
pm2 status "$PM2_NAME"
