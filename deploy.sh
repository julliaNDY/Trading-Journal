#!/usr/bin/env bash
# ============================================================================
# DEPLOY.SH - Script de déploiement production Next.js + Prisma + PM2
# Usage: bash deploy.sh
# ============================================================================
buy
set -e  # Arrêt immédiat en cas d'erreur

# Configuration
APP_DIR="/home/debian/cryptosite"
PM2_NAME="cryptosite"
ENV_FILE=".env"
NODE_MIN_VERSION="18"
NODE_MAX_VERSION="22"

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonctions utilitaires
log_info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ============================================================================
# ÉTAPE 1: Vérification du répertoire d'exécution
# ============================================================================
log_info "==> Étape 1/11: Vérification du répertoire d'exécution..."

if [ ! -d "$APP_DIR" ]; then
    log_error "Le répertoire $APP_DIR n'existe pas!"
    exit 1
fi

cd "$APP_DIR"

if [ ! -f "package.json" ]; then
    log_error "package.json non trouvé. Assurez-vous d'être à la racine du projet."
    exit 1
fi

log_success "Répertoire vérifié: $APP_DIR"

# ============================================================================
# ÉTAPE 2: Chargement des variables d'environnement
# ============================================================================
log_info "==> Étape 2/11: Chargement des variables d'environnement..."

if [ -f "$ENV_FILE" ]; then
    # Charger les variables (ignorer les commentaires et lignes vides)
    set -a
    source <(grep -v '^#' "$ENV_FILE" | grep -v '^$' | sed 's/\r$//')
    set +a
    log_success "Variables d'environnement chargées depuis $ENV_FILE"
else
    log_error "Fichier $ENV_FILE non trouvé!"
    exit 1
fi

# Vérification des variables critiques
if [ -z "$DATABASE_URL" ]; then
    log_error "DATABASE_URL n'est pas définie!"
    exit 1
fi

log_success "Variables critiques vérifiées (DATABASE_URL présente)"

# ============================================================================
# ÉTAPE 3: Vérification de la version Node.js
# ============================================================================
log_info "==> Étape 3/11: Vérification de la version Node.js..."

NODE_VERSION=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1)

if [ -z "$NODE_VERSION" ]; then
    log_error "Node.js n'est pas installé!"
    exit 1
fi

if [ "$NODE_VERSION" -lt "$NODE_MIN_VERSION" ] || [ "$NODE_VERSION" -gt "$NODE_MAX_VERSION" ]; then
    log_error "Version Node.js incompatible: v$NODE_VERSION"
    log_error "Version requise: v$NODE_MIN_VERSION - v$NODE_MAX_VERSION"
    exit 1
fi

log_success "Node.js version: v$NODE_VERSION (compatible)"

# ============================================================================
# ÉTAPE 4: Pull des dernières modifications Git
# ============================================================================
 log_info "==> Étape 4/10: Pull des dernières modifications Git..."

if [ -d ".git" ]; then
    git fetch origin main
    git reset --hard origin/main
    log_success "Code mis à jour depuis origin/main"
else
    log_warn "Pas de dépôt Git détecté, étape ignorée"
fi

# ============================================================================
# ÉTAPE 5: Installation des dépendances
# ============================================================================
log_info "==> Étape 5/11: Installation des dépendances..."

if [ -f "package-lock.json" ]; then
    npm ci --legacy-peer-deps --prefer-offline --no-audit
    log_success "Dépendances installées avec npm ci"
else
    npm install --prefer-offline --no-audit
    log_success "Dépendances installées avec npm install"
fi

# ============================================================================
# ÉTAPE 6: Génération du client Prisma
# ============================================================================
log_info "==> Étape 6/11: Génération du client Prisma..."

npx prisma generate
log_success "Client Prisma généré"

# ============================================================================
# ÉTAPE 7: Application des migrations Prisma
# ============================================================================
log_info "==> Étape 7/11: Application des migrations Prisma..."

# Utiliser migrate deploy pour la production (applique les migrations sans prompt)
npx prisma migrate deploy
log_success "Migrations Prisma appliquées"

# ============================================================================
# ÉTAPE 8: Build Next.js
# ============================================================================
log_info "==> Étape 8/11: Build de l'application Next.js..."

# Supprimer l'ancien build pour un build propre
rm -rf .next

# Build avec les variables d'environnement chargées
npm run build

log_success "Build Next.js terminé"

# ============================================================================
# ÉTAPE 9: Création du fichier ecosystem PM2 avec variables d'environnement
# ============================================================================
log_info "==> Étape 9/11: Création du fichier ecosystem PM2..."

# Générer le fichier ecosystem.config.js avec les variables d'environnement injectées
cat > ecosystem.config.js << ECOSYSTEM_EOF
module.exports = {
  apps: [{
    name: 'cryptosite',
    script: 'npm',
    args: 'start',
    cwd: '/home/debian/cryptosite',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024',
    env: {
      NODE_ENV: 'production',
      DATABASE_URL: '${DATABASE_URL}',
      NEXT_PUBLIC_SUPABASE_URL: '${NEXT_PUBLIC_SUPABASE_URL}',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: '${NEXT_PUBLIC_SUPABASE_ANON_KEY}',
      SUPABASE_SERVICE_ROLE_KEY: '${SUPABASE_SERVICE_ROLE_KEY}',
      APP_URL: '${APP_URL}',
      NEXT_PUBLIC_APP_URL: '${NEXT_PUBLIC_APP_URL}',
      UPLOAD_DIR: '${UPLOAD_DIR}',
      BACKUP_DIR: '${BACKUP_DIR}',
      OPENAI_API_KEY: '${OPENAI_API_KEY}',
      GOOGLE_GEMINI_API_KEY: '${GOOGLE_GEMINI_API_KEY}',
      GOOGLE_API_KEY: '${GOOGLE_API_KEY}',
      STRIPE_SECRET_KEY: '${STRIPE_SECRET_KEY}',
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: '${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}',
      STRIPE_WEBHOOK_SECRET: '${STRIPE_WEBHOOK_SECRET}',
      NEXTAUTH_URL: '${NEXTAUTH_URL}',
      NEXTAUTH_SECRET: '${NEXTAUTH_SECRET}',
      POLYGON_API_KEY: '${POLYGON_API_KEY}',
      GOOGLE_APPLICATION_CREDENTIALS: '${GOOGLE_APPLICATION_CREDENTIALS}',
      QDRANT_URL: '${QDRANT_URL}',
      QDRANT_API_KEY: '${QDRANT_API_KEY}',
      TIMESCALE_DATABASE_URL: '${TIMESCALE_DATABASE_URL}',
      USE_TIMESCALEDB: '${USE_TIMESCALEDB}',
      UPSTASH_REDIS_REST_URL: '${UPSTASH_REDIS_REST_URL}',
      UPSTASH_REDIS_REST_TOKEN: '${UPSTASH_REDIS_REST_TOKEN}',
      REDIS_URL: '${REDIS_URL}',
      SENTRY_DSN: '${SENTRY_DSN}',
      NEXT_PUBLIC_SENTRY_DSN: '${NEXT_PUBLIC_SENTRY_DSN}',
      SENTRY_AUTH_TOKEN: '${SENTRY_AUTH_TOKEN}',
      SENTRY_ORG: '${SENTRY_ORG}',
      SENTRY_PROJECT: '${SENTRY_PROJECT}'
    }
  }]
};
ECOSYSTEM_EOF

log_success "Fichier ecosystem.config.js créé avec variables d'environnement"

# ============================================================================
# ÉTAPE 10: Redémarrage PM2
# ============================================================================
log_info "==> Étape 10/11: Redémarrage de l'application avec PM2..."

# Arrêter et supprimer l'ancienne instance si elle existe
if pm2 describe "$PM2_NAME" > /dev/null 2>&1; then
    log_info "Arrêt de l'ancienne instance PM2..."
    pm2 delete "$PM2_NAME" --silent || true
fi

# Démarrer avec le fichier ecosystem
pm2 start ecosystem.config.js

log_success "Application démarrée avec PM2"

# ============================================================================
# ÉTAPE 11: Sauvegarde de la configuration PM2
# ============================================================================
log_info "==> Étape 11/11: Sauvegarde de la configuration PM2..."

pm2 save

log_success "Configuration PM2 sauvegardée"

# ============================================================================
# RÉSUMÉ DU DÉPLOIEMENT
# ============================================================================
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}✅ DÉPLOIEMENT TERMINÉ AVEC SUCCÈS${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "${BLUE}Résumé:${NC}"
echo "  - Application: $PM2_NAME"
echo "  - Répertoire:  $APP_DIR"
echo "  - Node.js:     v$NODE_VERSION"
echo "  - Mode:        npm start (production)"
echo ""
echo -e "${BLUE}Commandes utiles:${NC}"
echo "  - Voir les logs:  pm2 logs $PM2_NAME"
echo "  - Statut PM2:     pm2 status"
echo "  - Redémarrer:     pm2 restart $PM2_NAME"
echo "  - Arrêter:        pm2 stop $PM2_NAME"
echo ""

# Afficher le statut PM2
pm2 status "$PM2_NAME"
