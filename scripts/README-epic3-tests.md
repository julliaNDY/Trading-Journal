# Epic 3 API Endpoints Test Suite

Comprehensive test suite for all API endpoints related to **Epic 3: Multi-Account & Broker Sync (240+ Brokers)**.

## 📋 Overview

This test suite validates all API endpoints for:
- **Accounts Management** (`/api/accounts/*`)
- **Brokers Directory** (`/api/brokers`)
- **Broker Metrics** (`/api/broker/metrics`)
- **Broker Sync Scheduler** (`/api/scheduler/broker-sync`)
- **Health Checks** (infrastructure supporting broker sync)

## 🚀 Quick Start

### Prerequisites

1. **Dev server running:**
   ```bash
   npm run dev
   ```

2. **Environment variables** (optional, for authenticated tests):
   ```bash
   export TEST_USER_EMAIL="your-test-user@example.com"
   export TEST_USER_PASSWORD="your-password"
   export SCHEDULER_SECRET="your-scheduler-secret"
   ```

### Run Tests

```bash
# Run all Epic 3 endpoint tests
npm run test:epic3

# Run with verbose output (shows response data)
npm run test:epic3:verbose

# Run against a different environment
BASE_URL=https://your-staging-url.com npm run test:epic3
```

## 📊 Test Coverage

### 1. Authentication Tests
- ✅ POST `/api/auth/login` - User login

### 2. Accounts Endpoints
- ✅ GET `/api/accounts` - List all accounts
- ✅ GET `/api/accounts?page=1&limit=10` - Pagination
- ✅ GET `/api/accounts?search=test` - Search accounts
- ✅ GET `/api/accounts?broker=IBKR` - Filter by broker
- ✅ GET `/api/accounts/brokers` - List unique brokers

### 3. Brokers Directory Endpoints
- ✅ GET `/api/brokers` - List all brokers (public)
- ✅ GET `/api/brokers?page=1&limit=20` - Pagination
- ✅ GET `/api/brokers?search=Interactive` - Search by name
- ✅ GET `/api/brokers?country=USA` - Filter by country
- ✅ GET `/api/brokers?region=North America` - Filter by region
- ✅ GET `/api/brokers?integrationStatus=API` - Filter by integration status
- ✅ GET `/api/brokers?assetType=STOCKS` - Filter by asset type
- ✅ GET `/api/brokers?isActive=true` - Filter by active status
- ✅ Combined filters test
- ✅ Edge cases (invalid params, empty results)

### 4. Broker Metrics Endpoints
- ✅ GET `/api/broker/metrics` - All broker metrics
- ✅ GET `/api/broker/metrics?brokerType=IBKR` - Specific broker
- ✅ GET `/api/broker/metrics?brokerType=TRADOVATE` - Another broker
- ✅ GET `/api/broker/metrics?since=2026-01-01` - Time-filtered metrics
- ✅ GET `/api/broker/metrics?format=text` - Text report format

### 5. Scheduler Endpoints
- ✅ GET `/api/scheduler/broker-sync` - Scheduler status (requires auth)
- ⚠️ POST `/api/scheduler/broker-sync` - Trigger sync (skipped by default)
- ✅ Unauthorized access test (401)

### 6. Health Endpoints
- ✅ GET `/api/health` - Overall health
- ✅ GET `/api/health/db` - Database health
- ✅ GET `/api/health/redis` - Redis health
- ✅ GET `/api/health/ready` - Readiness check

## 🔧 Configuration

### Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `BASE_URL` | No | API base URL | `http://localhost:3000` |
| `TEST_USER_EMAIL` | Optional | Test user email for auth | - |
| `TEST_USER_PASSWORD` | Optional | Test user password | - |
| `SCHEDULER_SECRET` | Optional | Scheduler auth secret | - |
| `VERBOSE` | No | Show response data | `false` |

### Test Configuration

Edit `scripts/test-epic3-endpoints.ts` to customize:
- Expected status codes
- Timeout values
- Test data
- Filter combinations

## 📈 Output Format

### Console Output

```
================================================================================
🧪 EPIC 3 API ENDPOINTS TEST SUITE
================================================================================
Base URL: http://localhost:3000
Timestamp: 2026-01-17T23:45:00.000Z
================================================================================

🔐 Testing Authentication...

✅ POST   /api/auth/login                                      200 (245ms)

📊 Testing Accounts Endpoints...

✅ GET    /api/accounts                                        200 (123ms)
✅ GET    /api/accounts?page=1&limit=10                        200 (98ms)
✅ GET    /api/accounts?search=test                            200 (105ms)
✅ GET    /api/accounts?broker=IBKR                            200 (112ms)
✅ GET    /api/accounts/brokers                                200 (87ms)

🏦 Testing Brokers Endpoints...

✅ GET    /api/brokers                                         200 (156ms)
✅ GET    /api/brokers?page=1&limit=20                         200 (134ms)
...

================================================================================
📊 TEST SUMMARY
================================================================================
Total Tests:     32
Passed:          30 ✅
Failed:          2 ❌
Total Duration:  3.45s
Average:         107.81ms
================================================================================
```

### Exit Codes

- `0` - All tests passed
- `1` - One or more tests failed

## 🐛 Troubleshooting

### Authentication Issues

If you see `⚠️ Skipping authenticated endpoint tests`:
1. Set `TEST_USER_EMAIL` and `TEST_USER_PASSWORD`
2. Ensure the user exists in your database
3. Check that the dev server is running

### Connection Refused

```
❌ GET /api/accounts (0ms): fetch failed
```

**Solution:**
- Start the dev server: `npm run dev`
- Check `BASE_URL` is correct
- Verify no firewall blocking localhost

### 401 Unauthorized

```
❌ GET /api/accounts (123ms): Expected 200, got 401
```

**Solution:**
- Check authentication credentials
- Verify session cookie is being set
- Check middleware configuration

### 500 Internal Server Error

```
❌ GET /api/brokers (234ms): Expected 200, got 500
```

**Solution:**
- Check server logs for errors
- Verify database connection
- Check Prisma schema matches migrations
- Ensure all required env vars are set

### Scheduler Tests Skipped

```
⚠️ Skipping scheduler tests (SCHEDULER_SECRET not set)
```

**Solution:**
- Set `SCHEDULER_SECRET` or `CRON_SECRET` env var
- This is optional for basic testing

## 🔍 Advanced Usage

### Testing Specific Endpoints

Edit the script and comment out test suites you don't need:

```typescript
// await testAccountsEndpoints();
await testBrokersEndpoints();
// await testBrokerMetricsEndpoints();
```

### Adding Custom Tests

Add new test functions following the pattern:

```typescript
async function testMyEndpoint() {
  console.log('\n🧪 Testing My Endpoint...\n');
  
  const result = await makeRequest('GET', '/api/my-endpoint', {
    expectStatus: 200,
    requireAuth: true,
  });
  
  results.push(result);
  printResult(result);
}
```

### Testing Against Production

```bash
# Test production endpoints (read-only tests only!)
BASE_URL=https://your-production-url.com \
TEST_USER_EMAIL=test@example.com \
TEST_USER_PASSWORD=password \
npm run test:epic3
```

⚠️ **Warning:** Be careful testing against production. The test suite includes:
- ✅ Safe: All GET requests
- ⚠️ Caution: POST `/api/auth/login` (creates session)
- ❌ Dangerous: POST `/api/scheduler/broker-sync` (triggers actual sync - disabled by default)

## 📝 Related Documentation

- **Epic 3 Stories:** `docs/stories/3.*.story.md`
- **API Reference:** `docs/architecture/api-reference.md`
- **Broker Service:** `src/services/broker/README.md`
- **Database Schema:** `docs/architecture/database-schema.md`

## 🤝 Contributing

When adding new Epic 3 endpoints:

1. Add endpoint implementation
2. Add test case to this script
3. Update this README with new test coverage
4. Run tests to verify: `npm run test:epic3`
5. Update API reference docs

## 📊 CI/CD Integration

### GitHub Actions

```yaml
- name: Test Epic 3 Endpoints
  run: npm run test:epic3
  env:
    BASE_URL: http://localhost:3000
    TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
    TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
```

### Pre-deployment Check

```bash
#!/bin/bash
# Run before deploying Epic 3 changes

echo "Testing Epic 3 endpoints..."
npm run test:epic3

if [ $? -eq 0 ]; then
  echo "✅ All tests passed - safe to deploy"
  exit 0
else
  echo "❌ Tests failed - fix before deploying"
  exit 1
fi
```

## 🎯 Success Criteria

All tests should pass with:
- ✅ Status codes match expected (200, 401, 400, etc.)
- ✅ Response times < 2s for most endpoints
- ✅ Pagination works correctly
- ✅ Filters return expected results
- ✅ Authentication properly enforced
- ✅ Error handling returns proper error messages

## 📅 Maintenance

- **Review:** Monthly or after major Epic 3 changes
- **Update:** When new endpoints are added
- **Refactor:** If test patterns change
- **Document:** Keep this README in sync with tests
