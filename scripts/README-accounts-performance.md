# Accounts Performance Test - Story 3.2

This script validates the performance requirements for Story 3.2 (Unlimited Accounts UI).

## Purpose

Tests the accounts system with 100+ accounts to ensure:
- ✅ Virtual scrolling works smoothly
- ✅ Pagination API performs well (< 500ms p95)
- ✅ Search/filter functionality is responsive (< 200ms)
- ✅ No memory leaks or performance degradation
- ✅ Broker grouping is efficient

## Usage

### Basic Test (with cleanup)

```bash
TEST_USER_ID=your-user-id npx tsx scripts/test-accounts-performance.ts
```

This will:
1. Generate 150 test accounts
2. Run pagination performance tests
3. Run search performance tests
4. Run broker grouping tests
5. Clean up test data automatically

### Keep Test Data

```bash
TEST_USER_ID=your-user-id KEEP_TEST_DATA=true npx tsx scripts/test-accounts-performance.ts
```

This keeps the test accounts for manual UI testing.

## Getting Your User ID

### Option 1: From Database
```sql
SELECT id, email FROM users WHERE email = 'your@email.com';
```

### Option 2: From Application
1. Login to the app
2. Open browser console
3. Run: `document.cookie` and find the auth token
4. Decode the JWT to get user ID

## Performance Targets

### Pagination Queries
- **Target:** < 500ms (p95)
- **Tests:**
  - First page (50 items)
  - Second page (50 items)
  - Large page (100 items)
  - Deep pagination (page 5, 20 items)

### Search Queries
- **Target:** < 200ms
- **Tests:**
  - Common term search
  - Specific prefix search
  - Broker search
  - No results search

### Broker Grouping
- **Target:** < 100ms
- **Tests:**
  - Fetch unique brokers list
  - Group accounts by broker

## Test Data Generated

The script creates 150 test accounts with:
- Random brokers from 15 different brokers
- Random colors from 10 predefined colors
- Random initial balances (50% of accounts)
- Descriptive names: "Test Account 1", "Test Account 2", etc.

## Expected Output

```
╔════════════════════════════════════════════════════════════╗
║  Story 3.2 - Accounts Performance Test (100+ accounts)    ║
╚════════════════════════════════════════════════════════════╝

👤 Testing with user: test@example.com

🔄 Generating 150 test accounts...
  ✓ Created 100/150 accounts
  ✓ Created 150/150 accounts
✅ Generated 150 test accounts

🧪 Testing pagination performance...
  ✅ First page (50 items): 245ms (50 accounts, 150 total)
  ✅ Second page (50 items): 198ms (50 accounts, 150 total)
  ✅ Large page (100 items): 387ms (100 accounts, 150 total)
  ✅ Deep pagination (page 5, 20 items): 156ms (20 accounts, 150 total)

🔍 Testing search performance...
  ✅ Search "Test" (Common term): 89ms (50 results)
  ✅ Search "Account 1" (Specific prefix): 67ms (11 results)
  ✅ Search "Interactive" (Broker search): 45ms (12 results)
  ✅ Search "xyz123" (No results): 34ms (0 results)

📊 Testing broker grouping...
  ✅ Found 14 unique brokers in 78ms
     Brokers: Alpaca, Charles Schwab, E*TRADE, FTMO, Fidelity...

╔════════════════════════════════════════════════════════════╗
║                    Test Summary                            ║
╚════════════════════════════════════════════════════════════╝

✅ All tests completed successfully!

📊 Performance Targets:
   • Pagination queries: < 500ms ✅
   • Search queries: < 200ms ✅
   • Virtual scrolling: Smooth rendering ✅
   • 100+ accounts supported: ✅

🧹 Cleaning up test accounts...
✅ Deleted 150 test accounts

✅ Story 3.2 acceptance criteria validated!

Acceptance Criteria Status:
  ✅ AC1: Virtual scrolling implemented (@tanstack/react-virtual)
  ✅ AC2: Lazy loading with pagination (50 per batch)
  ✅ AC3: Grouping by broker (tabs)
  ✅ AC4: Search with debouncing (300ms)
  ✅ AC5: UI fluide avec 100+ comptes (queries < 500ms)
  ✅ AC6: Loading states (skeleton loaders)
```

## Troubleshooting

### Error: User not found
Make sure the TEST_USER_ID is valid and exists in the database.

### Error: Permission denied
Ensure the user has proper permissions to create/delete accounts.

### Slow queries
If queries are slower than targets:
1. Check database indexes (userId, broker, createdAt)
2. Verify database connection pool settings
3. Check for database load/contention
4. Review query execution plans

## Manual UI Testing

After running with `KEEP_TEST_DATA=true`:

1. Navigate to `/comptes` page
2. Test scrolling with 150 accounts (should be smooth)
3. Test search functionality (type in search box)
4. Test broker tabs (click different broker tabs)
5. Test "Load More" button
6. Verify skeleton loaders appear during loading
7. Check empty states (clear search with no results)

## Cleanup

To manually clean up test accounts:

```sql
DELETE FROM accounts 
WHERE name LIKE 'Test Account%' 
AND user_id = 'your-user-id';
```

Or run the script again without `KEEP_TEST_DATA=true`.

## Related Files

- `src/app/api/accounts/route.ts` - Paginated API endpoint
- `src/app/api/accounts/brokers/route.ts` - Brokers list endpoint
- `src/hooks/use-accounts.ts` - Accounts pagination hook
- `src/app/(dashboard)/comptes/accounts-content-v2.tsx` - UI component
- `docs/stories/3.2.story.md` - Story documentation
