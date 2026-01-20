# 📊 Trading Journal - Monitoring Stack

Complete monitoring infrastructure for Phase 11 (AI Daily Bias Analysis).

## 🎯 Stack Components

- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and dashboards
- **Alertmanager**: Alert routing and notifications
- **Node Exporter**: System metrics

---

## 🚀 Quick Start

### 1. Prerequisites

- Docker & Docker Compose
- Application running on `localhost:3000`
- Ports available: 3001 (Grafana), 9090 (Prometheus), 9093 (Alertmanager)

### 2. Start Monitoring Stack

```bash
cd monitoring
docker-compose up -d
```

### 3. Access Dashboards

- **Grafana**: http://localhost:3001
  - Default credentials: `admin` / `admin` (change on first login)
  
- **Prometheus**: http://localhost:9090
  
- **Alertmanager**: http://localhost:9093

### 4. Import Gemini API Dashboard

1. Login to Grafana (http://localhost:3001)
2. Navigate to: Dashboards → Import
3. Upload file: `grafana/gemini-api-dashboard.json`
4. Select Prometheus datasource
5. Click "Import"

---

## 📁 Directory Structure

```
monitoring/
├── docker-compose.yml              # Main orchestration file
├── prometheus/
│   ├── prometheus.yml              # Prometheus configuration
│   └── alerts/
│       └── gemini-api-alerts.yml   # Alert rules
├── grafana/
│   ├── gemini-api-dashboard.json   # Main dashboard
│   └── provisioning/               # Auto-provisioning configs
├── alertmanager/
│   └── alertmanager.yml            # Alert routing
└── README.md                       # This file
```

---

## 🔧 Configuration

### Environment Variables

Create `.env` file in `monitoring/` directory:

```env
# Grafana
GRAFANA_ADMIN_PASSWORD=your-secure-password

# Slack Integration
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# PagerDuty Integration
PAGERDUTY_SERVICE_KEY=your-pagerduty-service-key

# Metrics Endpoint (optional)
METRICS_SECRET_TOKEN=your-metrics-secret-token
```

### Slack Channels Setup

Create these channels in your Slack workspace:
- `#alerts-production` - All alerts
- `#alerts-critical` - Critical only
- `#alerts-warnings` - Warnings only

Get webhook URL:
1. Go to https://api.slack.com/apps
2. Create new app → Incoming Webhooks
3. Add webhook to workspace
4. Copy webhook URL to `.env`

### PagerDuty Setup

1. Create service in PagerDuty
2. Generate Integration Key (Events API v2)
3. Add to `.env` as `PAGERDUTY_SERVICE_KEY`

---

## 📊 Available Dashboards

### Gemini API Dashboard

**File**: `grafana/gemini-api-dashboard.json`

**Panels**:
1. API Request Rate (req/sec)
2. Error Rate (%)
3. Response Time (p50, p95, p99)
4. Circuit Breaker Status
5. Cache Hit Rate (%)
6. Fallback Usage (OpenAI)
7. Token Consumption (TPM)
8. Rate Limit Status
9. Error Types Distribution
10. Daily Request Volume
11. API Uptime (24h)

**Features**:
- 30s auto-refresh
- 6h default time range
- Environment selector
- Annotations for deployments & incidents

---

## 🚨 Alerts

### Configured Alerts (11 total)

| Alert | Threshold | Severity | Channel |
|-------|-----------|----------|---------|
| High API Request Rate | > 10 req/sec | Warning | Slack Warnings |
| High Error Rate | > 5% | Critical | PagerDuty + Slack |
| Slow API Response Time | p95 > 3s | Critical | PagerDuty + Slack |
| Circuit Breaker Open | state = OPEN | Critical | PagerDuty + Slack |
| High Fallback Usage | > 1 fallback/sec | Warning | Slack Warnings |
| Low Cache Hit Rate | < 50% | Warning | Slack Warnings |
| High Token Consumption | > 100k TPM | Warning | Slack Warnings |
| Rate Limit Exceeded | > 0.1/sec | Warning | Slack Warnings |
| Low API Uptime | < 99% | Critical | PagerDuty + Slack |
| No Recent Requests | 0 req in 10m | Warning | Slack Warnings |
| High Retry Rate | > 1 retry/sec | Warning | Slack Warnings |

### Alert Routing

```
Critical Alerts → PagerDuty + Slack (#alerts-critical)
Warning Alerts → Slack (#alerts-warnings)
```

### Inhibition Rules

- Circuit Breaker Open **inhibits** High Error Rate
- High Error Rate **inhibits** Slow Response Time

---

## 🧪 Testing

### Test Metrics Endpoint

```bash
curl http://localhost:3000/api/metrics
```

Expected: Prometheus text format with metrics.

### Generate Test Traffic

```bash
# Generate API requests
for i in {1..50}; do
  curl -X POST http://localhost:3000/api/daily-bias/security \
    -H "Content-Type: application/json" \
    -d '{"instrument":"NQ1","timeframe":"1d"}' &
done
```

### Trigger Test Alerts

```bash
# High request rate
watch -n 0.1 'curl -s http://localhost:3000/api/daily-bias/security > /dev/null'
```

Then check Grafana → Alerting.

---

## 📈 Metrics Reference

### Available Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `gemini_api_requests_total` | Counter | Total API requests |
| `gemini_api_errors_total` | Counter | Total errors |
| `gemini_api_duration_seconds` | Histogram | Request duration |
| `gemini_circuit_breaker_state` | Gauge | Circuit breaker state |
| `gemini_cache_hits_total` | Counter | Cache hits |
| `gemini_cache_misses_total` | Counter | Cache misses |
| `gemini_fallback_usage_total` | Counter | Fallback usage |
| `gemini_tokens_consumed_total` | Counter | Token consumption |
| `gemini_rate_limit_remaining` | Gauge | Rate limit quota |
| `gemini_rate_limit_exceeded_total` | Counter | Rate limit exceeded |
| `gemini_retry_attempts_total` | Counter | Retry attempts |
| `gemini_active_connections` | Gauge | Active connections |
| `gemini_queue_size` | Gauge | Queue size |

### Query Examples

**Request rate**:
```promql
rate(gemini_api_requests_total[1m])
```

**Error percentage**:
```promql
rate(gemini_api_errors_total[5m]) / rate(gemini_api_requests_total[5m]) * 100
```

**p95 latency**:
```promql
histogram_quantile(0.95, rate(gemini_api_duration_seconds_bucket[5m]))
```

**Cache hit rate**:
```promql
rate(gemini_cache_hits_total[5m]) / (rate(gemini_cache_hits_total[5m]) + rate(gemini_cache_misses_total[5m])) * 100
```

---

## 🔍 Troubleshooting

### Grafana can't connect to Prometheus

1. Check Prometheus is running: `docker ps | grep prometheus`
2. Verify datasource URL in Grafana: http://prometheus:9090
3. Check network: `docker network inspect monitoring_monitoring`

### No metrics in dashboard

1. Check application is exposing metrics: `curl http://localhost:3000/api/metrics`
2. Verify Prometheus is scraping: http://localhost:9090/targets
3. Check Prometheus logs: `docker logs trading-journal-prometheus`

### Alerts not firing

1. Verify alert rules loaded: http://localhost:9090/alerts
2. Check Alertmanager config: http://localhost:9093
3. Test webhook: `curl -X POST $SLACK_WEBHOOK_URL -d '{"text":"Test"}'`

### High memory usage

Prometheus stores 15 days of data by default. Adjust in `prometheus.yml`:
```yaml
--storage.tsdb.retention.time=7d
```

---

## 🔒 Security

### Production Checklist

- [ ] Change Grafana admin password
- [ ] Enable HTTPS for Grafana
- [ ] Restrict metrics endpoint to internal network
- [ ] Use `METRICS_SECRET_TOKEN` for `/api/metrics`
- [ ] Configure firewall rules (ports 3001, 9090, 9093)
- [ ] Enable Grafana authentication (OAuth, LDAP, etc.)
- [ ] Rotate Slack/PagerDuty tokens regularly
- [ ] Use read-only Grafana users for viewers

### Firewall Rules (iptables example)

```bash
# Allow from internal network only
iptables -A INPUT -p tcp --dport 9090 -s 10.0.0.0/8 -j ACCEPT
iptables -A INPUT -p tcp --dport 9090 -j DROP

iptables -A INPUT -p tcp --dport 3001 -s 10.0.0.0/8 -j ACCEPT
iptables -A INPUT -p tcp --dport 3001 -j DROP
```

---

## 📚 Documentation

- [PRÉ-7.4 Completion Report](../docs/monitoring/PRE-7.4-MONITORING-DASHBOARDS-COMPLETION.md)
- [Gemini API Integration](../docs/phase-11/gemini-api-integration.md)
- [Prometheus Official Docs](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)

---

## 🛠️ Maintenance

### Backup Grafana Dashboards

```bash
# Export dashboard
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:3001/api/dashboards/uid/DASHBOARD_UID > backup.json
```

### Update Prometheus Rules

1. Edit `prometheus/alerts/gemini-api-alerts.yml`
2. Reload config: `curl -X POST http://localhost:9090/-/reload`

### Scale Storage

If running out of disk space:
```bash
# Check volume size
docker volume inspect monitoring_prometheus-data

# Increase retention or clean old data
docker exec trading-journal-prometheus \
  curl -X POST http://localhost:9090/api/v1/admin/tsdb/clean_tombstones
```

---

## ✅ Health Check

Run this command to verify all services:

```bash
#!/bin/bash
echo "🔍 Checking monitoring stack health..."

# Check Prometheus
if curl -s http://localhost:9090/-/healthy > /dev/null; then
  echo "✅ Prometheus: Healthy"
else
  echo "❌ Prometheus: Down"
fi

# Check Grafana
if curl -s http://localhost:3001/api/health | grep -q "ok"; then
  echo "✅ Grafana: Healthy"
else
  echo "❌ Grafana: Down"
fi

# Check Alertmanager
if curl -s http://localhost:9093/-/healthy > /dev/null; then
  echo "✅ Alertmanager: Healthy"
else
  echo "❌ Alertmanager: Down"
fi

# Check metrics endpoint
if curl -s http://localhost:3000/api/metrics | grep -q "gemini_api_requests_total"; then
  echo "✅ Metrics Endpoint: Working"
else
  echo "❌ Metrics Endpoint: Not responding"
fi

echo ""
echo "📊 Access Points:"
echo "   Grafana:      http://localhost:3001"
echo "   Prometheus:   http://localhost:9090"
echo "   Alertmanager: http://localhost:9093"
```

Save as `monitoring/health-check.sh` and run:
```bash
chmod +x monitoring/health-check.sh
./monitoring/health-check.sh
```

---

## 📞 Support

- **Team**: Team 2A (Gemini API)
- **Lead**: Dev 45
- **Slack**: #ws2-ai-infrastructure
- **Issues**: Create ticket in project management tool

---

**Last Updated**: 2026-01-17  
**Version**: 1.0.0  
**Status**: ✅ Production-Ready
