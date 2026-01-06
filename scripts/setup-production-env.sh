#!/usr/bin/env bash
# ============================================
# Script de configuration des variables d'environnement production
# À exécuter sur le VPS après avoir récupéré le code
# ============================================

set -euo pipefail

APP_DIR="/home/debian/cryptosite"
ENV_FILE="$APP_DIR/.env.local"

echo "=========================================="
echo "🔧 Configuration environnement production"
echo "=========================================="

cd "$APP_DIR"

# Vérifier si .env.local existe déjà
if [ -f "$ENV_FILE" ]; then
    echo "⚠️  $ENV_FILE existe déjà."
    read -p "Voulez-vous le remplacer ? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Abandon."
        exit 0
    fi
    # Backup de l'ancien fichier
    cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%Y%m%d_%H%M%S)"
    echo "✓ Backup créé"
fi

echo ""
echo "Entrez les valeurs pour chaque variable :"
echo "(Récupérez-les depuis le dashboard Supabase)"
echo ""

# Supabase
read -p "NEXT_PUBLIC_SUPABASE_URL: " SUPABASE_URL
read -p "NEXT_PUBLIC_SUPABASE_ANON_KEY: " SUPABASE_ANON_KEY
read -p "SUPABASE_SERVICE_ROLE_KEY: " SUPABASE_SERVICE_KEY
read -p "DATABASE_URL (Connection string PostgreSQL): " DATABASE_URL

# App URL
read -p "URL du site production (ex: https://trading.votredomaine.com): " APP_URL

# Créer le fichier .env.local
cat > "$ENV_FILE" << EOF
# ===========================================
# PRODUCTION ENVIRONMENT - Trading Journal
# Généré le $(date)
# ===========================================

# Database - Supabase PostgreSQL
DATABASE_URL="$DATABASE_URL"

# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL"
NEXT_PUBLIC_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"
SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_KEY"

# App
NEXT_PUBLIC_APP_URL="$APP_URL"

# Storage
UPLOAD_DIR="public/uploads"
BACKUP_DIR="backups"
EOF

# Sécuriser le fichier
chmod 600 "$ENV_FILE"

echo ""
echo "=========================================="
echo "✅ Configuration terminée !"
echo "=========================================="
echo ""
echo "Fichier créé: $ENV_FILE"
echo ""
echo "Prochaines étapes:"
echo "  1. Vérifiez le contenu: cat $ENV_FILE"
echo "  2. Déployez: ./update_prod.sh"
echo ""

