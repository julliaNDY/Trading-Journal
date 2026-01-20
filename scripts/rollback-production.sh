#!/bin/bash
#
# PRÉ-13.3: Rollback Production Deployment
#
# This script rolls back the production environment to the previous version.
#
# Usage: ./scripts/rollback-production.sh [backup-timestamp]

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

echo -e "${RED}======================================${NC}"
echo -e "${RED}  PRODUCTION ROLLBACK${NC}"
echo -e "${RED}======================================${NC}"
echo ""
echo -e "${YELLOW}⚠️  WARNING: You are about to ROLLBACK PRODUCTION${NC}"
echo ""

# Confirmation prompts
read -p "Are you sure you want to rollback production? (yes/no): " -r
echo
if [[ ! $REPLY =~ ^yes$ ]]; then
  echo -e "${YELLOW}Rollback cancelled${NC}"
  exit 0
fi

read -p "Type 'ROLLBACK PRODUCTION' to continue: " -r
echo
if [[ $REPLY != "ROLLBACK PRODUCTION" ]]; then
  echo -e "${YELLOW}Rollback cancelled${NC}"
  exit 0
fi

echo ""
echo -e "${BLUE}Starting production rollback...${NC}"
echo ""

# Step 1: List available backups
echo -e "${YELLOW}[1/6] Listing available backups...${NC}"

BACKUPS=$(ssh "${PRODUCTION_USER}@${PRODUCTION_HOST}" << 'ENDSSH'
  PRODUCTION_DIR="${PRODUCTION_DIR:-/var/www/trading-journal-prod}"
  BACKUP_DIR="${PRODUCTION_DIR}/backups"
  
  if [ ! -d "$BACKUP_DIR" ]; then
    echo "ERROR: No backups directory found"
    exit 1
  fi
  
  echo "Available backups:"
  ls -lth "$BACKUP_DIR"/app-backup-*.tar.gz 2>/dev/null | head -10 | awk '{print $9, $6, $7, $8}' || echo "No backups found"
ENDSSH
)

echo "$BACKUPS"
echo ""

# Step 2: Select backup
if [ -z "${1:-}" ]; then
  read -p "Enter backup timestamp (or 'latest' for most recent): " BACKUP_TIMESTAMP
else
  BACKUP_TIMESTAMP="$1"
fi

# Step 3: Create current state backup (just in case)
echo -e "${YELLOW}[2/6] Creating safety backup of current state...${NC}"

ssh "${PRODUCTION_USER}@${PRODUCTION_HOST}" << 'ENDSSH'
  set -e
  
  PRODUCTION_DIR="${PRODUCTION_DIR:-/var/www/trading-journal-prod}"
  BACKUP_DIR="${PRODUCTION_DIR}/backups"
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  
  mkdir -p "$BACKUP_DIR"
  if [ -d "$PRODUCTION_DIR/.next" ]; then
    tar -czf "$BACKUP_DIR/app-pre-rollback-${TIMESTAMP}.tar.gz" -C "$PRODUCTION_DIR" .next public 2>/dev/null || true
    echo "Safety backup created: app-pre-rollback-${TIMESTAMP}.tar.gz"
  fi
ENDSSH

echo -e "${GREEN}✅ Safety backup created${NC}"

# Step 4: Perform rollback
echo -e "${YELLOW}[3/6] Rolling back application...${NC}"

ssh "${PRODUCTION_USER}@${PRODUCTION_HOST}" << ENDSSH
  set -e
  
  PRODUCTION_DIR="${PRODUCTION_DIR}"
  BACKUP_DIR="\${PRODUCTION_DIR}/backups"
  BACKUP_TIMESTAMP="${BACKUP_TIMESTAMP}"
  
  # Determine backup file
  if [ "\$BACKUP_TIMESTAMP" = "latest" ]; then
    BACKUP_FILE=\$(ls -t "\$BACKUP_DIR"/app-backup-*.tar.gz 2>/dev/null | head -1)
  else
    BACKUP_FILE="\$BACKUP_DIR/app-backup-\${BACKUP_TIMESTAMP}.tar.gz"
  fi
  
  if [ ! -f "\$BACKUP_FILE" ]; then
    echo "ERROR: Backup file not found: \$BACKUP_FILE"
    exit 1
  fi
  
  echo "Rolling back to: \$BACKUP_FILE"
  
  # Remove current version
  cd "\$PRODUCTION_DIR"
  rm -rf .next public 2>/dev/null || true
  
  # Extract backup
  tar -xzf "\$BACKUP_FILE" -C "\$PRODUCTION_DIR"
  
  echo "Rollback extraction completed"
ENDSSH

echo -e "${GREEN}✅ Application rolled back${NC}"

# Step 5: Rollback database (optional)
echo ""
read -p "Do you also need to rollback the database? (yes/no): " -r
echo

if [[ $REPLY =~ ^yes$ ]]; then
  echo -e "${YELLOW}[4/6] Rolling back database...${NC}"
  
  read -p "Enter database backup timestamp: " DB_BACKUP_TIMESTAMP
  
  ssh "${PRODUCTION_USER}@${PRODUCTION_HOST}" << ENDSSH
    set -e
    
    BACKUP_DIR="/var/backups/trading-journal"
    DB_BACKUP_TIMESTAMP="${DB_BACKUP_TIMESTAMP}"
    BACKUP_FILE="\$BACKUP_DIR/db-backup-\${DB_BACKUP_TIMESTAMP}.sql.gz"
    
    if [ ! -f "\$BACKUP_FILE" ]; then
      echo "ERROR: Database backup not found: \$BACKUP_FILE"
      exit 1
    fi
    
    echo "Rolling back database to: \$BACKUP_FILE"
    
    # Decompress and restore
    gunzip -c "\$BACKUP_FILE" | psql \$DATABASE_URL
    
    echo "Database rollback completed"
ENDSSH
  
  echo -e "${GREEN}✅ Database rolled back${NC}"
else
  echo -e "${YELLOW}⏭️  Skipping database rollback${NC}"
fi

# Step 6: Restart application
echo -e "${YELLOW}[5/6] Restarting application...${NC}"

ssh "${PRODUCTION_USER}@${PRODUCTION_HOST}" << 'ENDSSH'
  # Restart with PM2
  pm2 restart trading-journal-prod
  
  echo "Application restarted"
ENDSSH

echo -e "${GREEN}✅ Application restarted${NC}"

# Step 7: Health checks
echo -e "${YELLOW}[6/6] Running health checks...${NC}"

# Wait for app to start
sleep 10

# Health check
HEALTH_URL="https://${PRODUCTION_HOST}/api/health"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL")

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ Health check passed${NC}"
else
  echo -e "${RED}❌ Health check failed (HTTP $HTTP_CODE)${NC}"
  echo -e "${RED}🚨 CRITICAL: Application may still be down!${NC}"
  echo -e "${YELLOW}Please check logs immediately: ssh ${PRODUCTION_USER}@${PRODUCTION_HOST} 'pm2 logs trading-journal-prod'${NC}"
  exit 1
fi

# Log rollback
cat >> deployments.log << EOF
$(date +"%Y-%m-%d %H:%M:%S") | PRODUCTION | ROLLBACK | $BACKUP_TIMESTAMP | SUCCESS
EOF

echo ""
echo -e "${BLUE}======================================${NC}"
echo -e "${GREEN}✅ ROLLBACK COMPLETED${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""
echo -e "📝 Rollback Summary:"
echo -e "   • Environment: ${RED}PRODUCTION${NC}"
echo -e "   • Backup Used: $BACKUP_TIMESTAMP"
echo -e "   • Timestamp: $(date +%Y%m%d_%H%M%S)"
echo -e "   • URL: https://${PRODUCTION_HOST}"
echo ""
echo -e "${YELLOW}Post-rollback tasks:${NC}"
echo -e "   1. ✅ Verify critical functionality"
echo -e "   2. ✅ Monitor error rates"
echo -e "   3. ✅ Investigate root cause"
echo -e "   4. ✅ Notify team in Slack"
echo -e "   5. ✅ Update incident report"
echo ""
