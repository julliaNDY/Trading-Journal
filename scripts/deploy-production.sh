#!/bin/bash
#
# PRÉ-13.2: Deploy to Production Environment
#
# This script deploys the application to the production environment
# with extensive safety checks, backups, and rollback capabilities.
#
# Usage: ./scripts/deploy-production.sh

set -e  # Exit on error
set -u  # Error on undefined variable

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PRODUCTION_HOST="${PRODUCTION_HOST:-production.tradingjournal.app}"
PRODUCTION_USER="${PRODUCTION_USER:-deploy}"
PRODUCTION_DIR="${PRODUCTION_DIR:-/var/www/trading-journal-prod}"
BRANCH="main"

echo -e "${RED}======================================${NC}"
echo -e "${RED}  Trading Journal - PRODUCTION Deploy${NC}"
echo -e "${RED}======================================${NC}"
echo ""
echo -e "${YELLOW}⚠️  WARNING: You are about to deploy to PRODUCTION${NC}"
echo ""

# Confirmation prompt
read -p "Are you sure you want to deploy to PRODUCTION? (yes/no): " -r
echo
if [[ ! $REPLY =~ ^yes$ ]]; then
  echo -e "${YELLOW}Deployment cancelled${NC}"
  exit 0
fi

read -p "Have you tested on staging and verified all tests pass? (yes/no): " -r
echo
if [[ ! $REPLY =~ ^yes$ ]]; then
  echo -e "${YELLOW}Deployment cancelled. Please test on staging first.${NC}"
  exit 0
fi

read -p "Type 'DEPLOY TO PRODUCTION' to continue: " -r
echo
if [[ $REPLY != "DEPLOY TO PRODUCTION" ]]; then
  echo -e "${YELLOW}Deployment cancelled${NC}"
  exit 0
fi

echo ""
echo -e "${BLUE}Starting production deployment...${NC}"
echo ""

# Step 1: Pre-flight checks
echo -e "${YELLOW}[1/12] Running pre-flight checks...${NC}"

# Check if Git is clean
if [[ -n $(git status -s) ]]; then
  echo -e "${RED}❌ Git working directory is not clean. Commit or stash changes first.${NC}"
  exit 1
fi

# Check if on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "$BRANCH" ]]; then
  echo -e "${RED}❌ Not on $BRANCH branch. Currently on: $CURRENT_BRANCH${NC}"
  exit 1
fi

# Check if up to date with remote
git fetch origin "$BRANCH"
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse @{u})

if [ "$LOCAL" != "$REMOTE" ]; then
  echo -e "${RED}❌ Local branch is not up to date with remote${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Pre-flight checks passed${NC}"

# Step 2: Pull latest changes
echo -e "${YELLOW}[2/12] Pulling latest changes from origin/$BRANCH...${NC}"
git pull origin "$BRANCH"
COMMIT_HASH=$(git rev-parse --short HEAD)
echo -e "${GREEN}✅ Code updated (commit: $COMMIT_HASH)${NC}"

# Step 3: Install dependencies
echo -e "${YELLOW}[3/12] Installing dependencies...${NC}"
npm ci
echo -e "${GREEN}✅ Dependencies installed${NC}"

# Step 4: Run linter
echo -e "${YELLOW}[4/12] Running linter...${NC}"
npm run lint || {
  echo -e "${RED}❌ Linter failed. Deployment aborted.${NC}"
  exit 1
}
echo -e "${GREEN}✅ Linter passed${NC}"

# Step 5: Run TypeScript type checking
echo -e "${YELLOW}[5/12] Running TypeScript type checks...${NC}"
npm run type-check || {
  echo -e "${RED}❌ Type check failed. Deployment aborted.${NC}"
  exit 1
}
echo -e "${GREEN}✅ Type checks passed${NC}"

# Step 6: Run unit tests
echo -e "${YELLOW}[6/12] Running unit tests...${NC}"
npm run test || {
  echo -e "${RED}❌ Unit tests failed. Deployment aborted.${NC}"
  exit 1
}
echo -e "${GREEN}✅ Unit tests passed${NC}"

# Step 7: Run integration tests
echo -e "${YELLOW}[7/12] Running integration tests...${NC}"
npm run test:integration || {
  echo -e "${RED}❌ Integration tests failed. Deployment aborted.${NC}"
  exit 1
}
echo -e "${GREEN}✅ Integration tests passed${NC}"

# Step 8: Build application
echo -e "${YELLOW}[8/12] Building application...${NC}"
npm run build || {
  echo -e "${RED}❌ Build failed. Deployment aborted.${NC}"
  exit 1
}
echo -e "${GREEN}✅ Build completed${NC}"

# Step 9: Create deployment package
echo -e "${YELLOW}[9/12] Creating deployment package...${NC}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PACKAGE_NAME="deploy-prod-${TIMESTAMP}-${COMMIT_HASH}.tar.gz"

tar -czf "$PACKAGE_NAME" \
  --exclude=node_modules \
  --exclude=.next/cache \
  --exclude=.git \
  --exclude=test-results \
  --exclude=playwright-report \
  .next \
  public \
  package.json \
  package-lock.json \
  prisma \
  next.config.mjs \
  tsconfig.json

echo -e "${GREEN}✅ Package created: $PACKAGE_NAME${NC}"

# Step 10: Create database backup
echo -e "${YELLOW}[10/12] Creating production database backup...${NC}"

ssh "${PRODUCTION_USER}@${PRODUCTION_HOST}" << 'ENDSSH'
  BACKUP_DIR="/var/backups/trading-journal"
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  
  mkdir -p "$BACKUP_DIR"
  
  # Dump database
  pg_dump $DATABASE_URL > "$BACKUP_DIR/db-backup-${TIMESTAMP}.sql"
  gzip "$BACKUP_DIR/db-backup-${TIMESTAMP}.sql"
  
  echo "Database backup created: $BACKUP_DIR/db-backup-${TIMESTAMP}.sql.gz"
ENDSSH

echo -e "${GREEN}✅ Database backup created${NC}"

# Step 11: Upload and deploy
echo -e "${YELLOW}[11/12] Uploading to production server...${NC}"

scp "$PACKAGE_NAME" "${PRODUCTION_USER}@${PRODUCTION_HOST}:/tmp/"

ssh "${PRODUCTION_USER}@${PRODUCTION_HOST}" << ENDSSH
  set -e
  
  PRODUCTION_DIR="${PRODUCTION_DIR}"
  BACKUP_DIR="\${PRODUCTION_DIR}/backups"
  TIMESTAMP=\$(date +%Y%m%d_%H%M%S)
  PACKAGE_NAME="${PACKAGE_NAME}"
  
  # Create application backup
  echo "Creating application backup..."
  mkdir -p "\$BACKUP_DIR"
  if [ -d "\$PRODUCTION_DIR/.next" ]; then
    tar -czf "\$BACKUP_DIR/app-backup-\${TIMESTAMP}.tar.gz" -C "\$PRODUCTION_DIR" .next public
  fi
  
  # Extract new version
  echo "Extracting new version..."
  cd "\$PRODUCTION_DIR"
  tar -xzf "/tmp/\${PACKAGE_NAME}"
  
  # Install dependencies
  echo "Installing dependencies..."
  npm ci --production
  
  # Run database migrations
  echo "Running database migrations..."
  npx prisma migrate deploy
  
  # Reload application with zero-downtime (PM2)
  echo "Reloading application (zero-downtime)..."
  pm2 reload trading-journal-prod --update-env || pm2 restart trading-journal-prod
  
  # Wait for application to start
  sleep 5
  
  # Cleanup
  rm "/tmp/\${PACKAGE_NAME}"
  
  echo "Deployment completed!"
ENDSSH

echo -e "${GREEN}✅ Deployed to production${NC}"

# Step 12: Health checks
echo -e "${YELLOW}[12/12] Running health checks...${NC}"

# Wait for app to fully start
sleep 10

# Health check
HEALTH_URL="https://${PRODUCTION_HOST}/api/health"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL")

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ Health check passed${NC}"
else
  echo -e "${RED}❌ Health check failed (HTTP $HTTP_CODE)${NC}"
  echo -e "${RED}🚨 CRITICAL: Production may be down!${NC}"
  echo ""
  read -p "Do you want to rollback? (yes/no): " -r
  echo
  if [[ $REPLY =~ ^yes$ ]]; then
    echo -e "${YELLOW}Starting rollback...${NC}"
    ./scripts/rollback-production.sh
  fi
  exit 1
fi

# Additional smoke tests
echo "Running smoke tests..."

# Check API endpoints
API_ENDPOINTS=(
  "/api/health"
  "/api/me"
  "/api/brokers"
)

for endpoint in "${API_ENDPOINTS[@]}"; do
  URL="https://${PRODUCTION_HOST}${endpoint}"
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL")
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✅ $endpoint OK${NC}"
  else
    echo -e "${YELLOW}⚠️  $endpoint returned $HTTP_CODE${NC}"
  fi
done

# Cleanup local package
rm "$PACKAGE_NAME"

# Log deployment
cat >> deployments.log << EOF
$(date +"%Y-%m-%d %H:%M:%S") | PRODUCTION | $COMMIT_HASH | $TIMESTAMP | SUCCESS
EOF

echo ""
echo -e "${BLUE}======================================${NC}"
echo -e "${GREEN}✅ PRODUCTION DEPLOYMENT COMPLETED!${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""
echo -e "📝 Deployment Summary:"
echo -e "   • Environment: ${RED}PRODUCTION${NC}"
echo -e "   • Branch: $BRANCH"
echo -e "   • Commit: $COMMIT_HASH"
echo -e "   • Timestamp: $TIMESTAMP"
echo -e "   • URL: https://${PRODUCTION_HOST}"
echo ""
echo -e "${YELLOW}Post-deployment tasks:${NC}"
echo -e "   1. ✅ Monitor error rates in Grafana"
echo -e "   2. ✅ Check Sentry for new errors"
echo -e "   3. ✅ Verify critical user flows"
echo -e "   4. ✅ Monitor performance metrics"
echo -e "   5. ✅ Notify team in Slack"
echo ""
echo -e "📞 Rollback if needed: ./scripts/rollback-production.sh"
echo ""
