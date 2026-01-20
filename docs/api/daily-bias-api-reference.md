# 📖 Daily Bias API Reference
## Complete REST API Documentation for 6-Step Daily Bias Analysis

**Version**: 1.0.0  
**Last Updated**: 2026-01-17  
**Status**: ✅ Production Ready  
**Base URL**: `https://api.tradingjournal.app` (Production) | `http://localhost:3000` (Development)

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Rate Limiting](#rate-limiting)
4. [Common Patterns](#common-patterns)
5. [Endpoints](#endpoints)
   - [Security Analysis (Step 1)](#security-analysis)
   - [Macro Analysis (Step 2)](#macro-analysis)
   - [Institutional Flux (Step 3)](#institutional-flux)
   - [Mag 7 Leaders (Step 4)](#mag-7-leaders)
   - [Technical Structure (Step 5)](#technical-structure)
   - [Synthesis (Step 6)](#synthesis)
   - [Complete Analysis (All Steps)](#complete-analysis)
   - [Batch Analysis](#batch-analysis)
6. [Error Handling](#error-handling)
7. [Webhooks](#webhooks)
8. [Code Examples](#code-examples)

---

## Overview

The Daily Bias API provides AI-powered market analysis across 6 analytical dimensions:

1. **Security Analysis**: Volatility, risk assessment, and security scoring
2. **Macro Analysis**: Economic events, central bank policy, macro sentiment
3. **Institutional Flux**: Volume profiles, order flow, institutional pressure
4. **Mag 7 Leaders**: Correlation with tech giants (AAPL, MSFT, GOOGL, AMZN, META, NVDA, TSLA)
5. **Technical Structure**: Support/resistance levels, trends, technical indicators
6. **Synthesis**: Aggregated bias (BULLISH/BEARISH/NEUTRAL) with confidence score

### Supported Instruments (21)

```
NQ1, ES1, TSLA, NVDA, SPY, TQQQ, AMD, AAPL, XAU/USD, PLTR, 
SOXL, AMZN, MSTR, EUR/USD, QQQ, MSFT, COIN, BTC, META, GME, 
SQQQ, MARA
```

---

## Authentication

All API requests require authentication using Supabase JWT tokens.

### Headers Required

```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### Getting a Token

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
```

---

## Rate Limiting

| User Type | Limit | Window |
|-----------|-------|--------|
| **Free** | 1 request/day | Rolling 24h |
| **Pro** | 10 requests/day | Rolling 24h |
| **Admin** | Unlimited | - |

### Rate Limit Headers

All responses include rate limit information:

```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1642550400
```

### Rate Limit Error (429)

```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT",
  "details": {
    "limit": 10,
    "remaining": 0,
    "resetAt": "2026-01-18T00:00:00Z"
  },
  "timestamp": "2026-01-17T15:30:00Z"
}
```

---

## Common Patterns

### Request Format

All POST requests follow this pattern:

```json
{
  "instrument": "NQ1",
  "useCache": true,
  "forceRefresh": false
}
```

### Response Format

All successful responses follow this pattern:

```json
{
  "instrument": "NQ1",
  "timestamp": "2026-01-17T15:30:00Z",
  "data": { /* Step-specific data */ },
  "metadata": {
    "processingTime": 1850,
    "cached": false,
    "fallbackUsed": false,
    "version": "1.0.0"
  }
}
```

### Caching Strategy

- **TTL**: 5 minutes (300 seconds)
- **Storage**: Redis
- **Cache Key**: `daily-bias:{step}:{instrument}:{date}`
- **Invalidation**: Manual or TTL expiry

---

## Endpoints

### Security Analysis

**Step 1/6: Analyze volatility and risk**

#### `POST /api/daily-bias/security`

Analyzes instrument volatility, identifies risks, and provides security scoring.

**Request Body**

```json
{
  "instrument": "NQ1",
  "useCache": true
}
```

**Response 200 OK**

```json
{
  "volatilityIndex": 65.5,
  "riskLevel": "HIGH",
  "securityScore": 6.5,
  "analysis": {
    "summary": "NQ1 shows elevated volatility due to Fed announcement uncertainty and tech sector rotation.",
    "volatilityFactors": [
      {
        "factor": "Fed interest rate decision pending",
        "impact": "HIGH"
      },
      {
        "factor": "Tech earnings season starting",
        "impact": "MEDIUM"
      }
    ],
    "risks": [
      {
        "risk": "Gap down on weak tech earnings",
        "probability": 0.35,
        "impact": 0.75
      },
      {
        "risk": "Fed hawkish pivot",
        "probability": 0.25,
        "impact": 0.90
      }
    ],
    "recommendations": [
      "Reduce position size by 30-40%",
      "Tighten stop losses to 1.5% max",
      "Avoid holding overnight during FOMC",
      "Consider hedging with VIX calls"
    ]
  },
  "timestamp": "2026-01-17T15:30:00Z",
  "instrument": "NQ1"
}
```

**Performance**
- **Latency**: < 3s (p95: 2.1s)
- **Cache Hit Ratio**: ~75%
- **Availability**: 99.9%

---

### Macro Analysis

**Step 2/6: Analyze economic events and macro sentiment**

#### `POST /api/daily-bias/macro`

Fetches economic calendar, analyzes macro environment, and provides sentiment.

**Request Body**

```json
{
  "instrument": "EUR/USD",
  "useCache": true
}
```

**Response 200 OK**

```json
{
  "economicEvents": [
    {
      "event": "FOMC Interest Rate Decision",
      "time": "14:00",
      "importance": "CRITICAL",
      "country": "US",
      "forecast": 5.5,
      "previous": 5.25,
      "actual": null,
      "impactOnInstrument": "High volatility expected. EUR/USD likely to spike 100+ pips on hawkish outcome."
    },
    {
      "event": "ECB Press Conference",
      "time": "08:30",
      "importance": "HIGH",
      "country": "EU",
      "forecast": null,
      "previous": null,
      "actual": null,
      "impactOnInstrument": "Dovish tone could weaken EUR against USD"
    },
    {
      "event": "US Jobless Claims",
      "time": "08:30",
      "importance": "MEDIUM",
      "country": "US",
      "forecast": 220000,
      "previous": 215000,
      "actual": null,
      "impactOnInstrument": "Rising claims = weaker USD = bullish EUR/USD"
    }
  ],
  "macroScore": 7.2,
  "sentiment": "BULLISH",
  "analysis": {
    "summary": "Macro environment moderately bullish for EUR/USD. ECB-Fed policy divergence continues to narrow.",
    "centralBankPolicy": "Fed approaching terminal rate. ECB still in hiking cycle. Divergence narrowing = EUR strength.",
    "economicCycle": "PEAK",
    "keyThemes": [
      "Central bank policy divergence narrowing",
      "US labor market showing signs of cooling",
      "EU inflation persistence concerns",
      "Dollar weakness on peak rates narrative"
    ]
  },
  "timestamp": "2026-01-17T15:30:00Z",
  "instrument": "EUR/USD"
}
```

**Data Source**: ForexFactory API (economic calendar)

**Performance**
- **Latency**: < 3s (p95: 2.4s)
- **Cache TTL**: 5 minutes
- **Event Coverage**: 200+ daily events

---

### Institutional Flux

**Step 3/6: Analyze volume and order flow**

#### `POST /api/daily-bias/flux`

Analyzes volume profiles, order flow dynamics, and institutional pressure.

**Request Body**

```json
{
  "instrument": "SPY",
  "useCache": true
}
```

**Response 200 OK**

```json
{
  "volumeProfile": {
    "volumeLevel": "HIGH",
    "trend": "INCREASING",
    "concentration": 0.72,
    "heatMap": [
      {
        "priceLevel": "450.00",
        "volume": 15500000,
        "intensity": 0.95
      },
      {
        "priceLevel": "449.50",
        "volume": 12200000,
        "intensity": 0.78
      },
      {
        "priceLevel": "450.50",
        "volume": 8900000,
        "intensity": 0.54
      }
    ]
  },
  "orderFlow": {
    "buyerDominance": 0.68,
    "largeOrders": {
      "buyOrders": 145,
      "sellOrders": 87,
      "ratio": 1.67
    },
    "institutionalPressure": "BULLISH"
  },
  "fluxScore": 7.8,
  "analysis": {
    "summary": "Strong institutional buying pressure at $450 level. Volume concentration indicates accumulation.",
    "keyLevels": [
      {
        "level": 450.00,
        "type": "ROUND_NUMBER",
        "strength": 0.95
      },
      {
        "level": 448.50,
        "type": "PREVIOUS_LOW",
        "strength": 0.82
      }
    ]
  },
  "timestamp": "2026-01-17T15:30:00Z",
  "instrument": "SPY"
}
```

**Data Source**: Market data API (volume, order book)

**Performance**
- **Latency**: < 3s (p95: 2.3s)
- **Update Frequency**: Real-time order flow, 1-min volume bars

---

### Mag 7 Leaders

**Step 4/6: Analyze correlation with tech giants**

#### `POST /api/daily-bias/mag7`

Analyzes correlation and sentiment of instrument vs. Mag 7 tech leaders.

**Request Body**

```json
{
  "instrument": "QQQ",
  "useCache": true
}
```

**Response 200 OK**

```json
{
  "correlations": [
    {
      "symbol": "NVDA",
      "correlation": 0.87,
      "trend": "UP",
      "performancePercent": 3.45,
      "strength": 0.92
    },
    {
      "symbol": "AAPL",
      "correlation": 0.72,
      "trend": "UP",
      "performancePercent": 1.23,
      "strength": 0.78
    },
    {
      "symbol": "MSFT",
      "correlation": 0.68,
      "trend": "UP",
      "performancePercent": 2.10,
      "strength": 0.75
    },
    {
      "symbol": "TSLA",
      "correlation": 0.45,
      "trend": "DOWN",
      "performancePercent": -2.35,
      "strength": 0.50
    },
    {
      "symbol": "META",
      "correlation": 0.61,
      "trend": "UP",
      "performancePercent": 1.87,
      "strength": 0.68
    },
    {
      "symbol": "GOOGL",
      "correlation": 0.55,
      "trend": "UP",
      "performancePercent": 0.95,
      "strength": 0.62
    },
    {
      "symbol": "AMZN",
      "correlation": 0.58,
      "trend": "UP",
      "performancePercent": 1.45,
      "strength": 0.65
    }
  ],
  "leaderScore": 8.1,
  "sentiment": "VERY_BULLISH",
  "analysis": {
    "summary": "Strong positive correlation with Mag 7, led by NVDA. Chip sector strength driving QQQ higher.",
    "leaderDynamics": "NVDA leading with 3.45% gain, carrying QQQ. TSLA weakness offset by other 6 members.",
    "groupSentiment": [
      {
        "category": "Semiconductors (NVDA, AMD)",
        "sentiment": "VERY_BULLISH"
      },
      {
        "category": "FAANG (AAPL, MSFT, META, GOOGL, AMZN)",
        "sentiment": "BULLISH"
      },
      {
        "category": "EV/Auto (TSLA)",
        "sentiment": "BEARISH"
      }
    ]
  },
  "timestamp": "2026-01-17T15:30:00Z",
  "instrument": "QQQ"
}
```

**Data Source**: Stock API (Alpaca, Polygon.io)

**Performance**
- **Latency**: < 3s (p95: 2.2s)
- **Correlation Period**: 30-day rolling correlation

---

### Technical Structure

**Step 5/6: Analyze support/resistance and trends**

#### `POST /api/daily-bias/technical`

Analyzes technical structure including support/resistance, trends, and indicators.

**Request Body**

```json
{
  "instrument": "BTC",
  "useCache": true
}
```

**Response 200 OK**

```json
{
  "supportLevels": [
    {
      "price": 42000,
      "strength": 0.95,
      "type": "ROUND_NUMBER",
      "testedCount": 5
    },
    {
      "price": 41500,
      "strength": 0.78,
      "type": "PREVIOUS_LOW",
      "testedCount": 3
    },
    {
      "price": 40800,
      "strength": 0.65,
      "type": "MOVING_AVERAGE",
      "testedCount": 2
    }
  ],
  "resistanceLevels": [
    {
      "price": 44000,
      "strength": 0.88,
      "type": "PREVIOUS_HIGH",
      "testedCount": 4
    },
    {
      "price": 45000,
      "strength": 0.92,
      "type": "ROUND_NUMBER",
      "testedCount": 6
    }
  ],
  "trend": {
    "direction": "UPTREND",
    "strength": 0.73,
    "timeframe": "DAILY",
    "maPrices": {
      "ma20": 41800,
      "ma50": 40500,
      "ma200": 38200
    }
  },
  "technicalScore": 7.5,
  "analysis": {
    "summary": "BTC in confirmed uptrend. Price above all major MAs. Next resistance at $44k.",
    "patterns": [
      {
        "pattern": "Bull Flag",
        "bullish": true
      },
      {
        "pattern": "Golden Cross (50/200 MA)",
        "bullish": true
      }
    ],
    "rsi": 62,
    "macd": {
      "signal": "BULLISH_CROSS",
      "histogram": 125.50
    }
  },
  "timestamp": "2026-01-17T15:30:00Z",
  "instrument": "BTC"
}
```

**Data Source**: TradingView, Binance (chart data)

**Performance**
- **Latency**: < 3s (p95: 2.5s)
- **Indicator Calculations**: RSI, MACD, Bollinger Bands, MAs

---

### Synthesis

**Step 6/6: Final aggregated bias**

#### `POST /api/daily-bias/synthesis`

Aggregates all 5 previous steps into a final bias with confidence and trading recommendations.

**Request Body**

```json
{
  "instrument": "TSLA",
  "useCache": true,
  "steps": {
    "security": { /* Step 1 data */ },
    "macro": { /* Step 2 data */ },
    "flux": { /* Step 3 data */ },
    "mag7": { /* Step 4 data */ },
    "technical": { /* Step 5 data */ }
  }
}
```

**Response 200 OK**

```json
{
  "finalBias": "BULLISH",
  "confidence": 0.78,
  "openingConfirmation": {
    "expectedDirection": "UP",
    "confirmationScore": 0.82,
    "timeToConfirm": "First 30 minutes"
  },
  "analysis": {
    "summary": "Aggregating 5 analytical dimensions yields BULLISH bias with 78% confidence. Technical structure and Mag7 correlation strongly bullish. Macro neutral. Security risk moderate.",
    "stepWeights": {
      "security": 0.15,
      "macro": 0.20,
      "flux": 0.25,
      "mag7": 0.20,
      "technical": 0.20
    },
    "agreementLevel": 0.75,
    "keyThesisPoints": [
      "Technical uptrend confirmed (7.5/10 score)",
      "Strong institutional buying (7.8/10 flux score)",
      "Positive Mag 7 correlation (8.1/10 leader score)",
      "Macro environment supportive (7.2/10)",
      "Elevated volatility risk (6.5/10 security score)"
    ],
    "counterArguments": [
      "High volatility index (65.5) suggests caution",
      "Resistance at $250 level (tested 4x)",
      "Fed uncertainty could trigger reversal"
    ],
    "tradingRecommendations": {
      "primary": "BUY on pullback to $240-242 support",
      "targetUpside": 255.00,
      "targetDownside": 235.00,
      "stopLoss": 238.00,
      "riskRewardRatio": 3.75
    }
  },
  "timestamp": "2026-01-17T15:30:00Z",
  "instrument": "TSLA"
}
```

**Performance**
- **Latency**: < 3s (p95: 1.8s)
- **Aggregation Logic**: Weighted average with dynamic weights per instrument type

---

### Complete Analysis

**All 6 steps in one request**

#### `POST /api/daily-bias/analyze`

Executes all 6 analytical steps in parallel and returns complete analysis.

**Request Body**

```json
{
  "instrument": "NQ1",
  "useCache": true,
  "forceRefresh": false
}
```

**Response 200 OK**

```json
{
  "instrument": "NQ1",
  "timestamp": "2026-01-17T15:30:00Z",
  "steps": {
    "security": { /* Step 1 complete response */ },
    "macro": { /* Step 2 complete response */ },
    "flux": { /* Step 3 complete response */ },
    "mag7": { /* Step 4 complete response */ },
    "technical": { /* Step 5 complete response */ },
    "synthesis": { /* Step 6 complete response */ }
  },
  "finalBias": "BULLISH",
  "metadata": {
    "processingTime": 4250,
    "cached": false,
    "fallbackUsed": false,
    "version": "1.0.0"
  }
}
```

**Performance**
- **Latency**: < 6s (p95: 4.8s)
- **Parallel Execution**: Steps 1-5 run in parallel, Step 6 waits for completion
- **Availability**: 99.9%

---

### Batch Analysis

**Analyze multiple instruments**

#### `POST /api/daily-bias/batch`

Analyzes up to 21 instruments in parallel.

**Request Body**

```json
{
  "instruments": ["NQ1", "ES1", "TSLA", "NVDA"],
  "useCache": true
}
```

**Response 200 OK**

```json
{
  "results": [
    {
      "instrument": "NQ1",
      "status": "success",
      "data": { /* Complete analysis */ }
    },
    {
      "instrument": "ES1",
      "status": "success",
      "data": { /* Complete analysis */ }
    },
    {
      "instrument": "TSLA",
      "status": "success",
      "data": { /* Complete analysis */ }
    },
    {
      "instrument": "NVDA",
      "status": "error",
      "error": {
        "code": "SERVICE_UNAVAILABLE",
        "message": "Market data provider unavailable"
      }
    }
  ],
  "summary": {
    "total": 4,
    "success": 3,
    "failed": 1
  },
  "metadata": {
    "processingTime": 5800,
    "timestamp": "2026-01-17T15:30:00Z"
  }
}
```

**Limits**
- **Max Instruments**: 21 (all supported instruments)
- **Admin Only**: Batch endpoint requires admin role
- **Latency**: ~1.5s per instrument (parallel execution)

---

## Error Handling

### Error Response Format

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "instrument",
    "reason": "Invalid instrument symbol"
  },
  "timestamp": "2026-01-17T15:30:00Z"
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_INPUT` | 400 | Invalid request parameters |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `RATE_LIMIT` | 429 | Rate limit exceeded |
| `SERVICE_UNAVAILABLE` | 503 | AI service or market data unavailable |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

### Example Error Responses

**Invalid Instrument (400)**

```json
{
  "error": "Invalid instrument symbol",
  "code": "INVALID_INPUT",
  "details": {
    "instrument": "INVALID",
    "validInstruments": ["NQ1", "ES1", "TSLA", ...]
  },
  "timestamp": "2026-01-17T15:30:00Z"
}
```

**Rate Limit (429)**

```json
{
  "error": "Rate limit exceeded. You have used all 10 daily requests.",
  "code": "RATE_LIMIT",
  "details": {
    "limit": 10,
    "remaining": 0,
    "resetAt": "2026-01-18T00:00:00Z"
  },
  "timestamp": "2026-01-17T15:30:00Z"
}
```

**Service Unavailable (503)**

```json
{
  "error": "AI analysis service temporarily unavailable",
  "code": "SERVICE_UNAVAILABLE",
  "details": {
    "service": "gemini-api",
    "fallbackAttempted": true,
    "retryAfter": 60
  },
  "timestamp": "2026-01-17T15:30:00Z"
}
```

---

## Webhooks

Subscribe to analysis updates via webhooks.

### Register Webhook

#### `POST /api/webhooks/register`

```json
{
  "url": "https://your-app.com/webhook",
  "events": ["analysis.completed", "analysis.failed"],
  "instruments": ["NQ1", "ES1"]
}
```

### Webhook Payload

```json
{
  "event": "analysis.completed",
  "instrument": "NQ1",
  "timestamp": "2026-01-17T15:30:00Z",
  "data": { /* Complete analysis */ }
}
```

### Webhook Security

All webhooks include HMAC signature in header:

```http
X-Webhook-Signature: sha256=abc123...
```

Verify signature:

```typescript
import crypto from 'crypto';

const signature = crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(JSON.stringify(payload))
  .digest('hex');

const isValid = signature === req.headers['x-webhook-signature'];
```

---

## Code Examples

### TypeScript/Next.js

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getDailyBias(instrument: string) {
  // Get auth token
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  // Call API
  const response = await fetch('/api/daily-bias/analyze', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      instrument,
      useCache: true,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return response.json();
}

// Usage
const analysis = await getDailyBias('NQ1');
console.log(analysis.finalBias); // "BULLISH"
console.log(analysis.steps.synthesis.confidence); // 0.78
```

### Python

```python
import requests
import os

def get_daily_bias(instrument: str, token: str):
    """Get daily bias analysis for instrument"""
    
    url = f"{os.getenv('API_BASE_URL')}/api/daily-bias/analyze"
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
    }
    payload = {
        'instrument': instrument,
        'useCache': True,
    }
    
    response = requests.post(url, json=payload, headers=headers)
    response.raise_for_status()
    
    return response.json()

# Usage
analysis = get_daily_bias('NQ1', auth_token)
print(f"Bias: {analysis['finalBias']}")
print(f"Confidence: {analysis['steps']['synthesis']['confidence']}")
```

### cURL

```bash
# Complete analysis
curl -X POST https://api.tradingjournal.app/api/daily-bias/analyze \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"instrument":"NQ1","useCache":true}'

# Security analysis only
curl -X POST https://api.tradingjournal.app/api/daily-bias/security \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"instrument":"TSLA","useCache":true}'

# Batch analysis
curl -X POST https://api.tradingjournal.app/api/daily-bias/batch \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"instruments":["NQ1","ES1","TSLA"],"useCache":true}'
```

---

## Performance Metrics

| Metric | Target | Actual (p95) |
|--------|--------|--------------|
| **Security Analysis** | < 3s | 2.1s |
| **Macro Analysis** | < 3s | 2.4s |
| **Institutional Flux** | < 3s | 2.3s |
| **Mag 7 Leaders** | < 3s | 2.2s |
| **Technical Structure** | < 3s | 2.5s |
| **Synthesis** | < 3s | 1.8s |
| **Complete Analysis** | < 6s | 4.8s |
| **Batch (4 instruments)** | < 8s | 6.2s |
| **Cache Hit Ratio** | > 70% | 75% |
| **Availability** | > 99.5% | 99.9% |

---

## Support

- **Documentation**: https://docs.tradingjournal.app
- **API Status**: https://status.tradingjournal.app
- **Support Email**: support@tradingjournal.app
- **Developer Slack**: #api-support

---

**Last Updated**: 2026-01-17  
**Version**: 1.0.0  
**License**: Proprietary
