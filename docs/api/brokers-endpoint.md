# Brokers API Endpoint Documentation

## Overview

The `/api/brokers` endpoint provides access to the broker database with filtering, search, pagination, and Redis caching capabilities.

**Story:** 3.8 - Broker Database  
**Status:** ✅ Complete  
**Cache TTL:** 5 minutes (300 seconds)

---

## Endpoint

```
GET /api/brokers
```

### Authentication

Currently public (no authentication required). This allows users to browse available brokers before signing up.

---

## Query Parameters

All parameters are optional. Default behavior returns the first 20 active brokers ordered by priority.

| Parameter | Type | Default | Description | Example |
|-----------|------|---------|-------------|---------|
| `page` | integer | `1` | Page number (min: 1) | `?page=2` |
| `limit` | integer | `20` | Results per page (min: 1, max: 100) | `?limit=50` |
| `search` | string | - | Search in name, displayName, description | `?search=tradovate` |
| `country` | string | - | Filter by ISO country code | `?country=US` |
| `region` | string | - | Filter by region | `?region=North America` |
| `integrationStatus` | enum | - | Filter by integration status | `?integrationStatus=API` |
| `assetType` | enum | - | Filter by supported asset type | `?assetType=FUTURES` |
| `isActive` | boolean | - | Filter by active status | `?isActive=true` |

### Integration Status Values

- `API` - Full API integration available
- `FILE_UPLOAD` - CSV/Excel upload only
- `COMING_SOON` - Planned for future

### Asset Type Values

- `FOREX` - Foreign exchange
- `FUTURES` - Futures contracts
- `STOCKS` - Stock trading
- `CRYPTO` - Cryptocurrency
- `MULTI_ASSET` - Multiple asset types
- `PROP_FIRM` - Proprietary trading firm
- `OPTIONS` - Options trading

---

## Response Format

### Success Response (200 OK)

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "tradovate",
      "displayName": "Tradovate",
      "country": "US",
      "region": "North America",
      "integrationStatus": "API",
      "supportedAssets": ["FUTURES"],
      "logoUrl": "https://example.com/logo.png",
      "websiteUrl": "https://tradovate.com",
      "apiDocumentationUrl": "https://api.tradovate.com/docs",
      "csvTemplateUrl": null,
      "description": "Futures trading platform",
      "isActive": true,
      "priority": 10,
      "createdAt": "2026-01-17T00:00:00.000Z",
      "updatedAt": "2026-01-17T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### Error Response (400 Bad Request)

```json
{
  "success": false,
  "error": "Invalid query parameters",
  "details": [
    {
      "code": "too_small",
      "minimum": 1,
      "type": "number",
      "inclusive": true,
      "exact": false,
      "message": "Number must be greater than or equal to 1",
      "path": ["page"]
    }
  ]
}
```

### Error Response (500 Internal Server Error)

```json
{
  "success": false,
  "error": "Failed to fetch brokers"
}
```

---

## Examples

### Basic Request

Get first page with default settings:

```bash
curl http://localhost:3000/api/brokers
```

### Pagination

Get page 2 with 10 results per page:

```bash
curl "http://localhost:3000/api/brokers?page=2&limit=10"
```

### Search

Search for brokers containing "interactive":

```bash
curl "http://localhost:3000/api/brokers?search=interactive"
```

### Filter by Country

Get all US brokers:

```bash
curl "http://localhost:3000/api/brokers?country=US"
```

### Filter by Integration Status

Get brokers with API integration:

```bash
curl "http://localhost:3000/api/brokers?integrationStatus=API"
```

### Filter by Asset Type

Get brokers supporting futures:

```bash
curl "http://localhost:3000/api/brokers?assetType=FUTURES"
```

### Combined Filters

Get active US brokers with API integration supporting futures:

```bash
curl "http://localhost:3000/api/brokers?country=US&integrationStatus=API&assetType=FUTURES&isActive=true"
```

### Multiple Filters with Pagination and Search

```bash
curl "http://localhost:3000/api/brokers?search=broker&region=North%20America&integrationStatus=API&page=1&limit=25"
```

---

## Caching Strategy

### Cache Key Format

Cache keys are generated from query parameters:

```
brokers:page:1:limit:20:search:tradovate:country:US:status:API:asset:FUTURES:active:true
```

### Cache Behavior

- **TTL:** 5 minutes (300 seconds)
- **Invalidation:** Automatic on broker create/update/delete
- **Hit/Miss:** Tracked internally for monitoring
- **Fallback:** If Redis unavailable, queries database directly

### Cache Invalidation

Cache is automatically invalidated when:
- Admin creates a new broker
- Admin updates an existing broker
- Admin deletes a broker

Pattern used: `brokers:*` (invalidates all filter combinations)

---

## Performance

### Database Indexes

The following indexes optimize query performance:

```sql
CREATE INDEX idx_brokers_integration_status ON brokers(integrationStatus);
CREATE INDEX idx_brokers_country ON brokers(country);
CREATE INDEX idx_brokers_priority ON brokers(priority);
CREATE INDEX idx_brokers_is_active ON brokers(isActive);
```

### Query Optimization

- Parallel execution of count and data queries
- Efficient pagination with `skip` and `take`
- Case-insensitive search using Postgres `ILIKE`
- Array containment check for `supportedAssets`

### Expected Response Times

- **Cache Hit:** < 10ms
- **Cache Miss (DB Query):** 50-100ms
- **Search Query:** 100-200ms

---

## Frontend Integration

### React Hook Example

```typescript
import { useState, useEffect } from 'react';

interface BrokerFilters {
  page?: number;
  limit?: number;
  search?: string;
  country?: string;
  integrationStatus?: string;
  assetType?: string;
}

export function useBrokers(filters: BrokerFilters = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBrokers = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) {
            params.append(key, String(value));
          }
        });

        const response = await fetch(`/api/brokers?${params}`);
        const result = await response.json();

        if (result.success) {
          setData(result);
        } else {
          setError(result.error);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchBrokers();
  }, [JSON.stringify(filters)]);

  return { data, loading, error };
}
```

### Usage Example

```typescript
function BrokersList() {
  const { data, loading, error } = useBrokers({
    integrationStatus: 'API',
    country: 'US',
    page: 1,
    limit: 20,
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {data.data.map(broker => (
        <div key={broker.id}>
          <h3>{broker.displayName || broker.name}</h3>
          <p>{broker.description}</p>
        </div>
      ))}
      
      <Pagination
        currentPage={data.pagination.page}
        totalPages={data.pagination.totalPages}
        hasNext={data.pagination.hasNextPage}
        hasPrev={data.pagination.hasPrevPage}
      />
    </div>
  );
}
```

---

## Testing

### Test Coverage

- ✅ Default parameters
- ✅ Pagination
- ✅ Search functionality
- ✅ Country filter
- ✅ Region filter
- ✅ Integration status filter
- ✅ Asset type filter
- ✅ Active status filter
- ✅ Combined filters
- ✅ Invalid parameters (validation)
- ✅ Database errors
- ✅ Sort order (priority desc, name asc)

### Run Tests

```bash
npm test -- src/app/api/brokers/__tests__/route.test.ts
```

---

## Admin Actions

Broker management is handled through server actions (not REST API):

### Create Broker

```typescript
import { createBroker } from '@/app/actions/brokers';

const result = await createBroker({
  name: 'new-broker',
  displayName: 'New Broker',
  integrationStatus: 'COMING_SOON',
  supportedAssets: ['FUTURES'],
  priority: 50,
  isActive: true,
});
```

### Update Broker

```typescript
import { updateBroker } from '@/app/actions/brokers';

const result = await updateBroker('broker-id', {
  displayName: 'Updated Name',
  priority: 100,
});
```

### Delete Broker

```typescript
import { deleteBroker } from '@/app/actions/brokers';

const result = await deleteBroker('broker-id');
```

All admin actions automatically invalidate the broker cache.

---

## Monitoring

### Logs

The endpoint logs the following events:

- Successful requests with filter parameters
- Cache hits/misses (internal tracking)
- Validation errors
- Database errors
- Cache invalidation events

### Metrics to Track

- Request count by filter combination
- Cache hit rate
- Average response time
- Error rate by type
- Most searched brokers

---

## Future Enhancements

### Planned Features

- [ ] Broker ratings/reviews
- [ ] User-submitted broker suggestions
- [ ] Broker comparison tool
- [ ] Integration status notifications
- [ ] Broker availability by user location
- [ ] CSV export of broker list

### API Versioning

When breaking changes are needed, version the endpoint:

```
GET /api/v2/brokers
```

Current version is implicit v1.

---

## Related Documentation

- [Broker Database Schema](../architecture/database-schema.md#broker-model)
- [Cache Service](../architecture/services-documentation.md#cache-service)
- [Admin Broker Management](../stories/3.8.story.md)
- [Integration Template](../brokers/integration-template.md)

---

## Support

For issues or questions:
- Check test file: `src/app/api/brokers/__tests__/route.test.ts`
- Review implementation: `src/app/api/brokers/route.ts`
- Contact: dev team
