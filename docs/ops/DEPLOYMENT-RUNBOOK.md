# 📖 Trading Journal - Deployment Runbook

**Version**: 1.0  
**Last Updated**: 2026-01-18  
**Owner**: DevOps Team  
**Status**: ✅ Production Ready

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Environment Setup](#environment-setup)
4. [Deployment Procedures](#deployment-procedures)
5. [Rollback Procedures](#rollback-procedures)
6. [Monitoring & Health Checks](#monitoring--health-checks)
7. [Emergency Procedures](#emergency-procedures)
8. [Post-Deployment Tasks](#post-deployment-tasks)
9. [Troubleshooting](#troubleshooting)
10. [Appendix](#appendix)

---

## Overview

### Purpose

This runbook provides comprehensive procedures for deploying the Trading Journal application to staging and production environments, including rollback procedures and emergency protocols.

### Deployment Strategy

- **Zero-downtime deployments** using PM2 reload
- **Database migrations** applied automatically
- **Automated rollback** capabilities
- **Health checks** after each deployment
- **Backups** created before every deployment

### Environments

| Environment | URL | Purpose | Deploy Frequency |
|-------------|-----|---------|------------------|
| **Development** | http://localhost:3000 | Local development | Continuous |
| **Staging** | https://staging.tradingjournal.app | Pre-production testing | Daily / On-demand |
| **Production** | https://production.tradingjournal.app | Live application | Weekly / Hot-fixes |

---

## Prerequisites

### Required Access

- [ ] SSH access to staging/production servers
- [ ] GitHub repository access (read/write)
- [ ] Database credentials (read/write)
- [ ] AWS/Cloud provider access (if applicable)
- [ ] Monitoring dashboards access (Grafana, Sentry)
- [ ] Slack notifications channel access

### Required Tools

```bash
# Install required tools
npm install -g pm2
brew install postgresql  # For database backups
```

### Environment Variables

Ensure the following variables are set:

**Staging:**
```bash
export STAGING_HOST=staging.tradingjournal.app
export STAGING_USER=deploy
export STAGING_DIR=/var/www/trading-journal-staging
```

**Production:**
```bash
export PRODUCTION_HOST=production.tradingjournal.app
export PRODUCTION_USER=deploy
export PRODUCTION_DIR=/var/www/trading-journal-prod
```

---

## Environment Setup

### Server Setup (First Time Only)

#### 1. Install Node.js & PM2

```bash
# On server
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2
```

#### 2. Install PostgreSQL Client

```bash
sudo apt-get install -y postgresql-client
```

#### 3. Create Application Directory

```bash
sudo mkdir -p /var/www/trading-journal-prod
sudo chown -R deploy:deploy /var/www/trading-journal-prod
```

#### 4. Setup PM2 Ecosystem

```bash
# /var/www/trading-journal-prod/ecosystem.config.js
module.exports = {
  apps: [{
    name: 'trading-journal-prod',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/trading-journal-prod',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
```

#### 5. Start PM2 on Boot

```bash
pm2 startup
pm2 save
```

---

## Deployment Procedures

### 1. Staging Deployment

**When to Deploy:**
- After merging PRs to `develop` branch
- Daily automated deployments
- Manual deployments for urgent testing

**Command:**

```bash
./scripts/deploy-staging.sh
```

**Steps:**

1. **Pre-flight Checks**
   - Verify Git working directory is clean
   - Confirm on `develop` branch
   - Pull latest changes

2. **Quality Assurance**
   - Run linter
   - Run TypeScript type checks
   - Run unit tests

3. **Build & Package**
   - Build application (`npm run build`)
   - Create deployment package

4. **Deploy**
   - Upload package to staging server
   - Create backup of current version
   - Extract new version
   - Install dependencies
   - Run database migrations
   - Reload PM2 (zero-downtime)

5. **Verification**
   - Health check (`/api/health`)
   - Smoke tests
   - Manual verification

**Expected Duration:** 5-10 minutes

**Rollback:** If staging deployment fails, rollback is not critical. Fix and redeploy.

---

### 2. Production Deployment

**When to Deploy:**
- After successful staging testing
- Weekly releases (preferred: Tuesday 10 AM)
- Emergency hot-fixes (with approval)

**Command:**

```bash
./scripts/deploy-production.sh
```

**Pre-Deployment Checklist:**

- [ ] All E2E tests passing on staging
- [ ] No critical bugs in Sentry
- [ ] Database migrations tested on staging
- [ ] Rollback plan prepared
- [ ] Team notified in Slack
- [ ] Monitoring dashboards open
- [ ] On-call engineer available

**Steps:**

1. **Pre-flight Checks**
   - Verify Git working directory is clean
   - Confirm on `main` branch
   - Verify up-to-date with remote
   - **Multiple confirmation prompts**

2. **Quality Assurance**
   - Run linter (must pass)
   - Run TypeScript type checks (must pass)
   - Run unit tests (must pass)
   - Run integration tests (must pass)

3. **Build & Package**
   - Build application
   - Create deployment package with commit hash

4. **Backup**
   - **CRITICAL:** Create database backup
   - Create application backup
   - Store in `/var/backups/trading-journal/`

5. **Deploy**
   - Upload package to production server
   - Extract new version
   - Install production dependencies
   - Run database migrations (reversible)
   - Reload PM2 (zero-downtime)

6. **Health Checks**
   - Wait 10 seconds for startup
   - Health check (`/api/health`)
   - API endpoint smoke tests
   - **Auto-rollback if health check fails**

7. **Monitoring**
   - Monitor error rates for 15 minutes
   - Check Sentry for new errors
   - Verify Grafana metrics
   - Test critical user flows

**Expected Duration:** 15-20 minutes

**Success Criteria:**
- Health check returns 200
- Error rate < 0.1%
- p95 latency < 500ms
- No critical Sentry errors

---

## Rollback Procedures

### When to Rollback

**Immediate Rollback (P0):**
- Health check fails after deployment
- Error rate > 5%
- Application completely down
- Data corruption detected

**Consider Rollback (P1-P2):**
- Error rate > 1%
- p95 latency > 2000ms
- Critical feature broken
- Database migration issues

**Monitor & Fix Forward (P3):**
- Minor UI bugs
- Non-critical feature issues
- Cosmetic errors

### Rollback Command

```bash
./scripts/rollback-production.sh
```

or

```bash
./scripts/rollback-production.sh 20260118_143000
```

### Rollback Steps

1. **Confirmation Prompts**
   - Multiple prompts to prevent accidental rollback
   - Requires typing "ROLLBACK PRODUCTION"

2. **List Available Backups**
   - Shows last 10 backups with timestamps
   - Select specific backup or use 'latest'

3. **Safety Backup**
   - Create backup of current (broken) state
   - For forensic analysis later

4. **Application Rollback**
   - Remove current version
   - Extract backup version
   - Restart PM2

5. **Database Rollback (Optional)**
   - Prompt for database rollback
   - Restore from backup if needed
   - **CAUTION:** May lose recent data

6. **Health Checks**
   - Verify application is healthy
   - Test critical functionality

**Expected Duration:** 5-10 minutes

**Success Criteria:**
- Health check returns 200
- Error rate back to normal
- Critical flows working

---

## Monitoring & Health Checks

### Health Check Endpoint

```bash
curl https://production.tradingjournal.app/api/health
```

**Expected Response:**

```json
{
  "status": "healthy",
  "timestamp": "2026-01-18T10:00:00Z",
  "database": "connected",
  "redis": "connected",
  "version": "1.2.3"
}
```

### Monitoring Dashboards

1. **Grafana** (Primary): https://grafana.tradingjournal.app
   - Application Metrics
   - Database Performance
   - Redis Performance
   - API Response Times
   - Error Rates

2. **Sentry** (Error Tracking): https://sentry.io/trading-journal
   - Real-time error tracking
   - Error frequency
   - Affected users
   - Stack traces

3. **PM2 Monitoring**

```bash
ssh deploy@production.tradingjournal.app
pm2 status
pm2 logs trading-journal-prod --lines 100
pm2 monit
```

### Key Metrics to Monitor

| Metric | Warning | Critical |
|--------|---------|----------|
| Error Rate | > 0.5% | > 2% |
| p95 Latency | > 1000ms | > 2000ms |
| Database Connections | > 80% pool | > 95% pool |
| Memory Usage | > 80% | > 90% |
| CPU Usage | > 70% | > 85% |
| Disk Usage | > 80% | > 90% |

---

## Emergency Procedures

### Scenario 1: Application Down

**Symptoms:**
- Health check returns 5xx
- Users cannot access application
- PM2 shows app crashed

**Actions:**

1. **Immediate:**
   ```bash
   ssh deploy@production.tradingjournal.app
   pm2 restart trading-journal-prod
   ```

2. **If restart fails:**
   ```bash
   pm2 logs trading-journal-prod --err --lines 50
   # Identify error
   # Fix if simple (env var, etc)
   # Otherwise, rollback
   ./scripts/rollback-production.sh
   ```

3. **Notify:**
   - Post in #incidents Slack channel
   - Update status page
   - Notify on-call engineer

---

### Scenario 2: Database Connection Lost

**Symptoms:**
- "Cannot connect to database" errors
- 500 errors on all API calls
- High error rate in Sentry

**Actions:**

1. **Check database status:**
   ```bash
   ssh db-server
   systemctl status postgresql
   ```

2. **Check connection pool:**
   ```bash
   # On app server
   pm2 logs trading-journal-prod | grep "database"
   ```

3. **Restart application:**
   ```bash
   pm2 restart trading-journal-prod
   ```

4. **If database is down:**
   - Contact DBA / Cloud provider
   - Enable maintenance mode
   - Update status page

---

### Scenario 3: High Error Rate

**Symptoms:**
- Error rate > 2% in Grafana
- Multiple errors in Sentry
- Users reporting issues

**Actions:**

1. **Identify error type:**
   - Check Sentry dashboard
   - Check Grafana error breakdown
   - Check application logs

2. **Assess severity:**
   - P0 (critical): Immediate rollback
   - P1 (high): Rollback within 15 min
   - P2 (medium): Hot-fix within 1 hour
   - P3 (low): Fix in next release

3. **Decision matrix:**
   - Error rate > 5%: **ROLLBACK IMMEDIATELY**
   - Error rate 2-5%: Rollback within 10 minutes
   - Error rate 1-2%: Investigate & decide
   - Error rate < 1%: Monitor & fix forward

---

### Scenario 4: External API Down

**Symptoms:**
- Gemini API / OpenAI errors
- Broker sync failures
- Increased timeout errors

**Actions:**

1. **Verify external service:**
   ```bash
   # Check Gemini API
   curl https://generativelanguage.googleapis.com/v1/models
   
   # Check broker APIs
   curl https://api.alpaca.markets/v2/account
   ```

2. **Check circuit breaker:**
   - Circuit should open automatically
   - Fallback providers should activate
   - Monitor fallback usage in Grafana

3. **If persistent:**
   - Enable graceful degradation
   - Show maintenance message for affected features
   - Update status page

4. **Communication:**
   - Notify users via in-app banner
   - Post on status page
   - Update Slack #incidents

---

## Post-Deployment Tasks

### Immediately After Deployment (0-30 min)

- [ ] Monitor Grafana dashboards for anomalies
- [ ] Check Sentry for new errors
- [ ] Verify critical user flows work:
  - Login/Logout
  - Import CSV
  - View dashboard
  - Daily bias analysis
- [ ] Monitor API response times
- [ ] Check database query performance

### Within 24 Hours

- [ ] Post deployment summary in Slack:
  ```
  ✅ Production Deployed
  • Commit: abc1234
  • Time: 2026-01-18 10:00 AM
  • Duration: 15 minutes
  • Status: Healthy
  • Rollback: Not needed
  ```

- [ ] Update deployment log
- [ ] Review metrics vs. baseline
- [ ] Address any P3/P4 issues found
- [ ] Update documentation if needed

### Weekly Review

- [ ] Review deployment metrics
- [ ] Analyze rollback frequency
- [ ] Identify improvement opportunities
- [ ] Update runbook if gaps found

---

## Troubleshooting

### Build Fails

**Error:** `npm run build` fails

**Solutions:**
1. Check TypeScript errors: `npm run type-check`
2. Check linter errors: `npm run lint`
3. Verify dependencies: `npm ci`
4. Check Node version: `node --version` (should be 20.x)

---

### Migration Fails

**Error:** `npx prisma migrate deploy` fails

**Solutions:**
1. Check migration file syntax
2. Test migration on staging first
3. Verify database credentials
4. Check for conflicting migrations
5. Rollback database if needed

---

### PM2 Not Reloading

**Error:** `pm2 reload` fails or hangs

**Solutions:**
1. Check PM2 status: `pm2 status`
2. Check logs: `pm2 logs trading-journal-prod --err`
3. Hard restart: `pm2 restart trading-journal-prod`
4. Kill and start: `pm2 kill && pm2 start ecosystem.config.js`

---

### Health Check Fails

**Error:** `/api/health` returns 5xx or times out

**Solutions:**
1. Check application logs: `pm2 logs`
2. Check database connection
3. Check Redis connection
4. Verify environment variables
5. Restart application
6. If persists, rollback

---

## Appendix

### A. Deployment Checklist (Production)

**Pre-Deployment:**
- [ ] All tests pass on staging
- [ ] E2E tests pass
- [ ] Database migrations tested
- [ ] Rollback plan ready
- [ ] Team notified
- [ ] Monitoring dashboards open
- [ ] On-call engineer available

**During Deployment:**
- [ ] Confirmation prompts answered
- [ ] Database backup created
- [ ] Application deployed
- [ ] Health checks pass
- [ ] Smoke tests pass

**Post-Deployment:**
- [ ] Monitor for 30 minutes
- [ ] Verify critical flows
- [ ] Check error rates
- [ ] Post summary in Slack
- [ ] Update deployment log

---

### B. Emergency Contacts

| Role | Name | Slack | Phone |
|------|------|-------|-------|
| Tech Lead | [Name] | @tech-lead | +1-XXX-XXX-XXXX |
| DevOps | [Name] | @devops | +1-XXX-XXX-XXXX |
| On-Call | [Rotation] | @oncall | [PagerDuty] |
| DBA | [Name] | @dba | +1-XXX-XXX-XXXX |

---

### C. Useful Commands

**Check deployment logs:**
```bash
tail -f deployments.log
```

**Check PM2 status:**
```bash
pm2 status
pm2 logs trading-journal-prod --lines 100
pm2 monit
```

**Check database connection:**
```bash
psql $DATABASE_URL -c "SELECT 1;"
```

**Check Redis connection:**
```bash
redis-cli -u $REDIS_URL ping
```

**Check disk space:**
```bash
df -h
```

**Check memory usage:**
```bash
free -h
```

**Check application version:**
```bash
curl https://production.tradingjournal.app/api/version
```

---

### D. Deployment Log Template

```markdown
## Deployment - 2026-01-18 10:00 AM

**Environment:** Production  
**Branch:** main  
**Commit:** abc1234  
**Deployed By:** [Name]  
**Duration:** 15 minutes  

**Pre-Deployment Checklist:**
- [x] All tests passed
- [x] Staging verified
- [x] Team notified

**Changes:**
- Feature: Daily Bias Analysis UI enhancements
- Fix: Import CSV validation bug
- Chore: Update dependencies

**Database Migrations:**
- 20260118_100000_add_daily_bias_cache

**Health Checks:**
- [x] /api/health: 200 OK
- [x] /api/me: 401 (expected)
- [x] /api/brokers: 200 OK

**Monitoring:**
- Error rate: 0.02%
- p95 latency: 280ms
- No critical errors in Sentry

**Status:** ✅ Successful  
**Rollback:** Not needed

**Post-Deployment Notes:**
- All systems nominal
- Minor UI bug reported (P3) - will fix in next release
```

---

### E. Links & Resources

- **GitHub Repository:** https://github.com/yourorg/trading-journal
- **Staging:** https://staging.tradingjournal.app
- **Production:** https://production.tradingjournal.app
- **Grafana:** https://grafana.tradingjournal.app
- **Sentry:** https://sentry.io/trading-journal
- **Status Page:** https://status.tradingjournal.app
- **Slack #deployments:** https://yourorg.slack.com/channels/deployments
- **Slack #incidents:** https://yourorg.slack.com/channels/incidents

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-18  
**Next Review:** 2026-02-18
