# Charles Schwab Integration Guide

> **For**: Dev 24, Dev 25, Dev 28, Dev 29 (Team 1D)  
> **Timeline**: Feb 3-5, 2026  
> **Status**: Ready for Implementation  
> **Prepared By**: Dev 26

---

## 📋 Overview

This guide provides step-by-step instructions for completing the Charles Schwab integration. Dev 26 has completed the research and core provider implementation. Your tasks focus on OAuth service, testing, and deployment.

**What's Already Done** ✅:
- API research and documentation
- Schwab provider implementation (`schwab-provider.ts`)
- Unit tests (15+ tests)
- Trade reconstruction algorithm
- Error handling

**What You Need to Do**:
1. **Dev 24 + Dev 25**: Implement OAuth 2.0 service (12h)
2. **Dev 26 + Dev 27**: Finalize API integration (10h)
3. **Dev 28 + Dev 29**: E2E testing and documentation (6h)

---

## 🚀 Quick Start

### Prerequisites

1. **Schwab Developer Account**
   - Register at https://developer.schwab.com
   - Create application
   - Wait for approval (1-3 days)
   - Receive App Key + Client Secret

2. **Environment Variables**
   ```bash
   SCHWAB_CLIENT_ID=your_app_key
   SCHWAB_CLIENT_SECRET=your_client_secret
   SCHWAB_REDIRECT_URI=https://yourdomain.com/api/broker/schwab/callback
   ```

3. **Schwab Brokerage Account**
   - Real account required (no sandbox)
   - Use paper trading if available
   - Minimal balance for testing

---

## 📦 Task PRÉ-5.1: OAuth 2.0 Service (Dev 24 + Dev 25)

### Objective

Implement OAuth 2.0 service to handle authorization flow, token storage, and refresh logic.

### File Structure

```
src/
  lib/
    schwab-oauth.ts          # OAuth service (NEW)
  app/
    api/
      broker/
        schwab/
          authorize/
            route.ts          # Start OAuth flow (NEW)
          callback/
            route.ts          # Handle OAuth callback (NEW)
```

### Step 1: Create OAuth Service

**File**: `src/lib/schwab-oauth.ts`

```typescript
import { prisma } from '@/lib/prisma';
import { SchwabProvider } from '@/services/broker/schwab-provider';

export class SchwabOAuthService {
  private provider: SchwabProvider;
  
  constructor() {
    this.provider = new SchwabProvider(
      process.env.SCHWAB_CLIENT_ID!,
      process.env.SCHWAB_CLIENT_SECRET!,
      process.env.SCHWAB_REDIRECT_URI!
    );
  }
  
  /**
   * Generate authorization URL with state parameter
   */
  generateAuthUrl(userId: string): { url: string; state: string } {
    const state = this.generateState(userId);
    const url = this.provider.getAuthorizationUrl(state);
    
    return { url, state };
  }
  
  /**
   * Handle OAuth callback
   */
  async handleCallback(
    userId: string,
    authorizationCode: string,
    state: string
  ): Promise<void> {
    // Validate state
    this.validateState(userId, state);
    
    // Exchange code for tokens
    const authResult = await this.provider.authenticate({
      apiKey: process.env.SCHWAB_CLIENT_ID!,
      apiSecret: process.env.SCHWAB_CLIENT_SECRET!,
      authorizationCode,
    } as any);
    
    // Store tokens in database
    await this.storeTokens(userId, authResult);
  }
  
  /**
   * Refresh tokens if needed
   */
  async refreshTokensIfNeeded(userId: string): Promise<void> {
    const connection = await prisma.brokerConnection.findFirst({
      where: { userId, brokerType: 'SCHWAB' },
    });
    
    if (!connection) {
      throw new Error('No Schwab connection found');
    }
    
    // Check if refresh needed
    const newTokens = await this.provider.refreshToken(connection.accessToken);
    
    if (newTokens) {
      await this.storeTokens(userId, newTokens);
    }
  }
  
  // Helper methods
  private generateState(userId: string): string {
    // Generate cryptographically secure state
    const crypto = require('crypto');
    const state = crypto.randomBytes(32).toString('hex');
    
    // Store state in cache/database with 10 min expiry
    // TODO: Implement state storage
    
    return state;
  }
  
  private validateState(userId: string, state: string): void {
    // Validate state matches stored state
    // TODO: Implement state validation
  }
  
  private async storeTokens(
    userId: string,
    authResult: { accessToken: string; expiresAt: Date }
  ): Promise<void> {
    await prisma.brokerConnection.upsert({
      where: {
        userId_brokerType: {
          userId,
          brokerType: 'SCHWAB',
        },
      },
      create: {
        userId,
        brokerType: 'SCHWAB',
        accessToken: authResult.accessToken,
        expiresAt: authResult.expiresAt,
      },
      update: {
        accessToken: authResult.accessToken,
        expiresAt: authResult.expiresAt,
      },
    });
  }
}
```

### Step 2: Create Authorization Endpoint

**File**: `src/app/api/broker/schwab/authorize/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { SchwabOAuthService } from '@/lib/schwab-oauth';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Generate authorization URL
    const oauthService = new SchwabOAuthService();
    const { url, state } = oauthService.generateAuthUrl(user.id);
    
    // Store state in session/cookie
    const response = NextResponse.redirect(url);
    response.cookies.set('schwab_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 600, // 10 minutes
      sameSite: 'lax',
    });
    
    return response;
  } catch (error) {
    console.error('Schwab authorization error:', error);
    return NextResponse.json(
      { error: 'Failed to start authorization' },
      { status: 500 }
    );
  }
}
```

### Step 3: Create Callback Endpoint

**File**: `src/app/api/broker/schwab/callback/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { SchwabOAuthService } from '@/lib/schwab-oauth';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getUser();
    if (!user) {
      return NextResponse.redirect('/login?error=unauthorized');
    }
    
    // Get authorization code and state from query params
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    
    if (!code || !state) {
      return NextResponse.redirect('/comptes/brokers?error=missing_params');
    }
    
    // Validate state from cookie
    const storedState = request.cookies.get('schwab_oauth_state')?.value;
    if (state !== storedState) {
      return NextResponse.redirect('/comptes/brokers?error=invalid_state');
    }
    
    // Handle OAuth callback
    const oauthService = new SchwabOAuthService();
    await oauthService.handleCallback(user.id, code, state);
    
    // Clear state cookie
    const response = NextResponse.redirect('/comptes/brokers?success=schwab_connected');
    response.cookies.delete('schwab_oauth_state');
    
    return response;
  } catch (error) {
    console.error('Schwab callback error:', error);
    return NextResponse.redirect('/comptes/brokers?error=connection_failed');
  }
}
```

### Step 4: Add to Provider Factory

**File**: `src/services/broker/provider-factory.ts`

```typescript
// Add Schwab case
case 'SCHWAB':
  return new SchwabProvider(
    process.env.SCHWAB_CLIENT_ID!,
    process.env.SCHWAB_CLIENT_SECRET!,
    process.env.SCHWAB_REDIRECT_URI!
  );
```

### Testing Checklist

- [ ] Authorization URL generates correctly
- [ ] State parameter is stored and validated
- [ ] Callback handles authorization code
- [ ] Tokens are stored in database
- [ ] Token refresh works correctly
- [ ] Error handling for invalid state
- [ ] Error handling for expired code
- [ ] CSRF protection works

---

## 📦 Task PRÉ-5.2: API Integration Finalization (Dev 26 + Dev 27)

### Objective

Finalize API integration, add Prisma enum, and integrate with broker sync service.

### Step 1: Add Schwab to Prisma Schema

**File**: `prisma/schema.prisma`

```prisma
enum BrokerType {
  // ... existing brokers
  SCHWAB
}
```

Run migration:
```bash
npx prisma migrate dev --name add_schwab_broker_type
```

### Step 2: Register Provider

**File**: `src/services/broker/index.ts`

```typescript
export { SchwabProvider, createSchwabProvider } from './schwab-provider';
```

### Step 3: Add to Broker List

**File**: `src/app/(dashboard)/comptes/brokers/page.tsx`

Add Schwab to broker list with OAuth button:

```typescript
{
  id: 'SCHWAB',
  name: 'Charles Schwab',
  logo: '/brokers/schwab.svg',
  authType: 'oauth',
  authUrl: '/api/broker/schwab/authorize',
  description: '33M+ accounts - Stocks, Options, Futures',
  features: ['OAuth 2.0', 'Real-time sync', 'Full history'],
}
```

### Step 4: Test Integration

```bash
# Run unit tests
npm test schwab-provider.test.ts

# Run type check
npm run type-check

# Run linter
npm run lint
```

### Testing Checklist

- [ ] Prisma migration applied
- [ ] Provider registered in factory
- [ ] UI shows Schwab option
- [ ] OAuth button works
- [ ] Unit tests pass (15+ tests)
- [ ] Type checking passes
- [ ] Linter passes

---

## 📦 Task PRÉ-5.3: E2E Testing & Documentation (Dev 28 + Dev 29)

### Objective

Perform end-to-end testing with real Schwab account and document setup process.

### Step 1: E2E Test Scenarios

**File**: `src/services/broker/__tests__/schwab-e2e.test.ts`

```typescript
describe('Schwab E2E Tests', () => {
  it('should complete full OAuth flow', async () => {
    // 1. Start authorization
    // 2. Login to Schwab
    // 3. Grant permissions
    // 4. Handle callback
    // 5. Verify tokens stored
  });
  
  it('should fetch accounts', async () => {
    // 1. Get stored tokens
    // 2. Fetch accounts
    // 3. Verify account data
  });
  
  it('should sync trades', async () => {
    // 1. Get stored tokens
    // 2. Fetch trades
    // 3. Verify trade data
    // 4. Verify PnL calculations
  });
  
  it('should refresh tokens', async () => {
    // 1. Wait for token expiry
    // 2. Trigger refresh
    // 3. Verify new tokens
  });
});
```

### Step 2: Manual Testing

1. **OAuth Flow**
   - Click "Connect Schwab" button
   - Login to Schwab
   - Grant permissions
   - Verify redirect to success page
   - Check database for stored tokens

2. **Account Sync**
   - Navigate to accounts page
   - Click "Sync Schwab"
   - Verify accounts appear
   - Verify balances match Schwab

3. **Trade Sync**
   - Navigate to trades page
   - Click "Sync Trades"
   - Verify trades imported
   - Verify PnL calculations match Schwab

4. **Error Scenarios**
   - Test with invalid credentials
   - Test with expired token
   - Test with rate limit
   - Test with network error

### Step 3: Documentation

**File**: `docs/brokers/charles-schwab-setup-guide.md`

Create user-facing setup guide:
- How to create Schwab developer account
- How to register app
- How to get App Key + Secret
- How to connect account
- Troubleshooting common issues

### Testing Checklist

- [ ] OAuth flow works end-to-end
- [ ] Accounts sync correctly
- [ ] Trades sync correctly
- [ ] PnL calculations match Schwab
- [ ] Token refresh works
- [ ] Error handling works
- [ ] 60-day limit respected
- [ ] Multiple accounts supported
- [ ] Documentation complete
- [ ] Troubleshooting guide complete

---

## 🔐 Security Checklist

- [ ] Client secret stored in environment variables
- [ ] Tokens encrypted in database
- [ ] State parameter validated (CSRF protection)
- [ ] HTTPS enforced for OAuth callbacks
- [ ] Rate limiting implemented
- [ ] Error messages don't leak sensitive data
- [ ] Tokens cleared on logout
- [ ] Session timeout configured

---

## 📊 Success Metrics

### Technical Metrics

- [ ] 95%+ sync success rate
- [ ] < 30s average sync time
- [ ] < 5% error rate
- [ ] 100% unit test coverage
- [ ] 0 P0/P1 bugs

### User Experience Metrics

- [ ] Clear OAuth instructions
- [ ] Helpful error messages
- [ ] Re-auth prompts before expiry
- [ ] CSV fallback for older trades

---

## 🚨 Common Issues & Solutions

### Issue 1: App Not Approved

**Problem**: Schwab hasn't approved developer app yet.

**Solution**:
- Check approval status in developer portal
- Contact Schwab support if > 3 days
- Use CSV import as fallback

### Issue 2: Callback URI Mismatch

**Problem**: OAuth error "redirect_uri mismatch".

**Solution**:
- Verify callback URI matches exactly (including HTTPS, path)
- Check environment variable
- Update in developer portal if needed

### Issue 3: Token Expired After 7 Days

**Problem**: Refresh token expired, user must re-authenticate.

**Solution**:
- Expected behavior (Schwab limitation)
- Implement weekly re-auth prompt
- Show "Re-connect Schwab" button

### Issue 4: 60-Day History Limit

**Problem**: Can't fetch trades older than 60 days.

**Solution**:
- Expected behavior (Schwab limitation)
- Prompt user to export CSV for older trades
- Document limitation clearly

---

## 📚 References

- **API Research**: `docs/brokers/api-research/charles-schwab.md`
- **Provider Implementation**: `src/services/broker/schwab-provider.ts`
- **Unit Tests**: `src/services/broker/__tests__/schwab-provider.test.ts`
- **Schwab API Docs**: https://developer.schwab.com
- **OAuth 2.0 Spec**: https://oauth.net/2/

---

## 📞 Support

**Questions?** Contact Dev 26:
- Slack: @dev26
- Email: dev26@tradingpathjournal.com

**Blockers?** Escalate to:
- Team Lead: [Name]
- PM: John

---

**Document Status**: ✅ Ready for Implementation  
**Created By**: Dev 26  
**Date**: 2026-01-17  
**For**: Team 1D (Dev 24, 25, 27, 28, 29)  
**Timeline**: Feb 3-5, 2026
