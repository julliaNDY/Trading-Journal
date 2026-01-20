# Uptime Monitoring Setup

## Story 1.9: Production Monitoring & Alerting

This document describes how to set up external uptime monitoring and a status page.

---

## Health Check Endpoints

The application provides the following health check endpoints:

| Endpoint | Description | Use Case |
|----------|-------------|----------|
| `GET /api/health` | Basic liveness probe | Load balancers |
| `GET /api/health/db` | Database connectivity | Dependency monitoring |
| `GET /api/health/redis` | Redis connectivity | Dependency monitoring |
| `GET /api/health/qdrant` | Vector DB connectivity | Dependency monitoring |
| `GET /api/health/ready` | All services ready | Kubernetes readiness probe |
| `GET /api/observability/health?full=true` | Full health check | Detailed monitoring |

---

## External Uptime Monitoring

### Recommended Services

1. **Better Uptime** (betteruptime.com) - Free tier available
2. **Pingdom** - Enterprise-grade
3. **UptimeRobot** - Simple and free
4. **Checkly** - API monitoring with Playwright tests

### Configuration

#### Better Uptime

1. Create a new monitor
2. Monitor type: **HTTP(S)**
3. URL: `https://your-domain.com/api/health/ready`
4. Check frequency: **1 minute**
5. Expected status code: **200**
6. Alerting: Configure Slack/Discord/Email

#### Sample Monitor Configuration

```json
{
  "monitors": [
    {
      "name": "Trading Path - Main App",
      "url": "https://tradingpath.app/api/health",
      "type": "http",
      "interval": 60,
      "alert_after": 2,
      "expected_status": 200
    },
    {
      "name": "Trading Path - Database",
      "url": "https://tradingpath.app/api/health/db",
      "type": "http",
      "interval": 300,
      "alert_after": 1,
      "expected_status": 200
    },
    {
      "name": "Trading Path - Readiness",
      "url": "https://tradingpath.app/api/health/ready",
      "type": "http",
      "interval": 60,
      "alert_after": 2,
      "expected_status": 200
    }
  ]
}
```

---

## Status Page

### Recommended Services

1. **Better Uptime Status Pages** - Included with monitoring
2. **Instatus** - Beautiful, customizable
3. **Statuspage.io** (Atlassian) - Enterprise
4. **Cachet** - Self-hosted, open source

### Status Page Components

Configure these components on your status page:

| Component | Monitor | Priority |
|-----------|---------|----------|
| Website | /api/health | Critical |
| Database | /api/health/db | Critical |
| Background Jobs | /api/health/redis | Major |
| AI Features | /api/health/qdrant | Minor |
| Authentication | /api/health | Critical |

### Incident Response

When an incident occurs:

1. **Investigating** - Issue detected, team investigating
2. **Identified** - Root cause identified
3. **Monitoring** - Fix deployed, monitoring situation
4. **Resolved** - Issue fully resolved

---

## Core Web Vitals Monitoring

### Vercel Analytics

Already integrated via `@vercel/analytics`. Provides:

- Core Web Vitals (LCP, FID, CLS)
- Page views
- Unique visitors
- Geographic distribution

### Lighthouse CI

Run Lighthouse checks in CI/CD:

```yaml
# In .github/workflows/deploy.yml
- name: Run Lighthouse CI
  run: |
    npm install -g @lhci/cli
    npm run build
    npm run start &
    sleep 5
    lhci autorun --upload.target=temporary-public-storage
```

### Performance Budgets

Configured in `lighthouserc.js`:

| Metric | Good | Warning | Budget |
|--------|------|---------|--------|
| LCP | <2.5s | <4s | 2.5s |
| FID | <100ms | <300ms | 100ms |
| CLS | <0.1 | <0.25 | 0.1 |
| TTI | <3.8s | <7.3s | 3.8s |
| TBT | <200ms | <600ms | 200ms |

---

## Alerting Channels

Configure alerts in your monitoring service:

### Slack

1. Create an Incoming Webhook in Slack
2. Add webhook URL to monitoring service
3. Configure alert severity levels

### Discord

1. Create a Webhook in Discord channel settings
2. Add webhook URL to monitoring service

### Email

Configure email recipients for critical alerts:
- ops@your-domain.com
- on-call@your-domain.com

### PagerDuty (Optional)

For on-call rotation and escalation:

1. Create a service in PagerDuty
2. Add integration key to monitoring service
3. Configure escalation policies

---

## Environment Variables

```bash
# For alerting
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
ALERT_EMAIL_RECIPIENTS="ops@example.com,alerts@example.com"

# For metrics API access
METRICS_API_KEY="your-secure-key"
```

---

## Maintenance Windows

When performing maintenance:

1. Update status page to "Scheduled Maintenance"
2. Pause uptime monitors (or acknowledge expected downtime)
3. Perform maintenance
4. Verify all health checks pass
5. Resume monitors and update status page

---

## Runbook

### High Error Rate Alert

1. Check `/api/observability/metrics` for error patterns
2. Check Sentry for error details
3. Check Axiom logs for context
4. Rollback if recent deployment

### High Latency Alert

1. Check `/api/observability/metrics` for slow endpoints
2. Check database query times
3. Check Redis queue depth
4. Scale if needed

### Service Unhealthy

1. Check specific health endpoint (`/api/health/db`, etc.)
2. Check service logs in Axiom
3. Check external service status pages
4. Restart service if needed
