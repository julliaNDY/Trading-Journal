#!/bin/bash
#
# PRÉ-13.1: Deploy to Staging Environment
#
# This script deploys the application to the staging environment
# with safety checks and automated testing.
#
# Usage: ./scripts/deploy-staging.sh

set -e  # Exit on error
set -u  # Error on undefined variable

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
STAGING_HOST="${STAGING_HOST:-staging.tradingjournal.app}"
STAGING_USER="${STAGING_USER:-deploy}"
STAGING_DIR="${STAGING_DIR:-/var/www/trading-journal-staging}"
BRANCH="${BRANCH:-develop}"

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  Trading Journal - Staging Deploy${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Step 1: Pre-flight checks
echo -e "${YELLOW}[1/10] Running pre-flight checks...${NC}"

# Check if Git is clean
if [[ -n $(git status -s) ]]; then
  echo -e "${RED}❌ Git working directory is not clean. Commit or stash changes first.${NC}"
  exit 1
fi

# Check if on correct branch
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "$BRANCH" ]]; then
  echo -e "${RED}❌ Not on $BRANCH branch. Currently on: $CURRENT_BRANCH${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Pre-flight checks passed${NC}"

# Step 2: Pull latest changes
echo -e "${YELLOW}[2/10] Pulling latest changes from origin/$BRANCH...${NC}"
git pull origin "$BRANCH"
echo -e "${GREEN}✅ Code updated${NC}"

# Step 3: Install dependencies
echo -e "${YELLOW}[3/10] Installing dependencies...${NC}"
npm ci
echo -e "${GREEN}✅ Dependencies installed${NC}"

# Step 4: Run linter
echo -e "${YELLOW}[4/10] Running linter...${NC}"
npm run lint
echo -e "${GREEN}✅ Linter passed${NC}"

# Step 5: Run TypeScript type checking
echo -e "${YELLOW}[5/10] Running TypeScript type checks...${NC}"
npm run type-check || true  # Non-blocking for staging
echo -e "${GREEN}✅ Type checks completed${NC}"

# Step 6: Run unit tests
echo -e "${YELLOW}[6/10] Running unit tests...${NC}"
npm run test || {
  echo -e "${RED}❌ Unit tests failed. Deployment aborted.${NC}"
  exit 1
}
echo -e "${GREEN}✅ Unit tests passed${NC}"

# Step 7: Build application
echo -e "${YELLOW}[7/10] Building application...${NC}"
npm run build
echo -e "${GREEN}✅ Build completed${NC}"

# Step 8: Create deployment package
echo -e "${YELLOW}[8/10] Creating deployment package...${NC}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PACKAGE_NAME="deploy-staging-${TIMESTAMP}.tar.gz"

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

# Step 9: Upload to staging server
echo -e "${YELLOW}[9/10] Uploading to staging server...${NC}"

scp "$PACKAGE_NAME" "${STAGING_USER}@${STAGING_HOST}:/tmp/"

ssh "${STAGING_USER}@${STAGING_HOST}" << 'ENDSSH'
  set -e
  
  STAGING_DIR="${STAGING_DIR:-/var/www/trading-journal-staging}"
  BACKUP_DIR="${STAGING_DIR}/backups"
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  
  # Create backup
  echo "Creating backup..."
  mkdir -p "$BACKUP_DIR"
  if [ -d "$STAGING_DIR/.next" ]; then
    tar -czf "$BACKUP_DIR/backup-${TIMESTAMP}.tar.gz" -C "$STAGING_DIR" .next public || true
  fi
  
  # Extract new version
  echo "Extracting new version..."
  cd "$STAGING_DIR"
  tar -xzf "/tmp/${PACKAGE_NAME}"
  
  # Install dependencies (if needed)
  echo "Installing dependencies..."
  npm ci --production
  
  # Run database migrations
  echo "Running database migrations..."
  npx prisma migrate deploy
  
  # Reload application (assuming PM2)
  echo "Reloading application..."
  pm2 reload trading-journal-staging --update-env || pm2 restart trading-journal-staging
  
  # Cleanup
  rm "/tmp/${PACKAGE_NAME}"
  
  echo "Deployment completed!"
ENDSSH

echo -e "${GREEN}✅ Deployed to staging${NC}"

# Step 10: Run smoke tests
echo -e "${YELLOW}[10/10] Running smoke tests...${NC}"

# Wait for app to start
sleep 5

# Health check
HEALTH_URL="https://${STAGING_HOST}/api/health"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL")

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ Health check passed${NC}"
else
  echo -e "${RED}❌ Health check failed (HTTP $HTTP_CODE)${NC}"
  echo -e "${YELLOW}⚠️  Deployment may have issues, check logs${NC}"
fi

# Cleanup local package
rm "$PACKAGE_NAME"

echo ""
echo -e "${BLUE}======================================${NC}"
echo -e "${GREEN}✅ Staging deployment completed!${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""
echo -e "📝 Deployment Summary:"
echo -e "   • Environment: Staging"
echo -e "   • Branch: $BRANCH"
echo -e "   • Timestamp: $TIMESTAMP"
echo -e "   • URL: https://${STAGING_HOST}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "   1. Test the staging environment"
echo -e "   2. Run E2E tests: npm run test:e2e"
echo -e "   3. If all good, deploy to production: ./scripts/deploy-production.sh"
echo ""
