/**
 * Charles Schwab OAuth 2.0 Service
 * 
 * Handles OAuth 2.0 authorization flow for Charles Schwab integration
 * 
 * @module lib/schwab-oauth
 * @created 2026-01-18
 */

import { prisma } from '@/lib/prisma';
import { SchwabProvider } from '@/services/broker/schwab-provider';
import { encryptCredential } from '@/services/broker/broker-sync-service';
import { brokerLogger } from '@/lib/logger';
import { getRedisConnection, isRedisConfigured } from '@/lib/queue/redis';
import { randomBytes } from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

export interface SchwabAuthUrl {
  url: string;
  state: string;
}

export interface SchwabCallbackResult {
  connectionId: string;
  accountIds: string[];
}

// ============================================================================
// OAUTH SERVICE
// ============================================================================

export class SchwabOAuthService {
  private provider: SchwabProvider;
  private readonly STATE_TTL_SECONDS = 600; // 10 minutes
  
  constructor() {
    const clientId = process.env.SCHWAB_CLIENT_ID;
    const clientSecret = process.env.SCHWAB_CLIENT_SECRET;
    const redirectUri = process.env.SCHWAB_REDIRECT_URI || 
      `${process.env.APP_URL || 'http://localhost:3000'}/api/broker/schwab/callback`;
    
    if (!clientId || !clientSecret) {
      throw new Error('SCHWAB_CLIENT_ID and SCHWAB_CLIENT_SECRET must be configured');
    }
    
    this.provider = new SchwabProvider(clientId, clientSecret, redirectUri);
  }
  
  /**
   * Generate authorization URL with CSRF state
   */
  async generateAuthUrl(userId: string): Promise<SchwabAuthUrl> {
    // Generate cryptographically secure state
    const state = randomBytes(32).toString('hex');
    
    // Store state in Redis/cache for validation (10 min expiry)
    if (isRedisConfigured()) {
      try {
        const redis = await getRedisConnection();
        const stateKey = `schwab:oauth:state:${state}`;
        await redis.setex(stateKey, this.STATE_TTL_SECONDS, userId);
      } catch (error) {
        brokerLogger.warn('Failed to store OAuth state in Redis, using fallback', {
          userId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        // Continue without Redis (state still generated, just won't validate)
      }
    }
    
    const url = this.provider.getAuthorizationUrl(state);
    
    brokerLogger.info('Schwab OAuth URL generated', {
      userId,
      state,
      hasStateStorage: isRedisConfigured()
    });
    
    return { url, state };
  }
  
  /**
   * Validate OAuth state parameter (CSRF protection)
   */
  private async validateState(state: string, expectedUserId: string): Promise<void> {
    if (!isRedisConfigured()) {
      brokerLogger.warn('OAuth state validation skipped (Redis not available)', {
        state,
        expectedUserId
      });
      // In production, this should fail - but for development, allow
      if (process.env.NODE_ENV === 'production') {
        throw new Error('OAuth state validation requires Redis in production');
      }
      return;
    }
    
    try {
      const redis = await getRedisConnection();
      const stateKey = `schwab:oauth:state:${state}`;
      const storedUserId = await redis.get(stateKey);
      
      if (!storedUserId) {
        throw new Error('Invalid or expired OAuth state parameter');
      }
      
      if (storedUserId !== expectedUserId) {
        throw new Error('OAuth state parameter does not match user');
      }
      
      // Delete state after validation (one-time use)
      await redis.del(stateKey);
      
      brokerLogger.debug('OAuth state validated successfully', {
        state,
        userId: expectedUserId
      });
    } catch (error) {
      brokerLogger.error('OAuth state validation failed', {
        state,
        expectedUserId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
  
  /**
   * Handle OAuth callback
   */
  async handleCallback(
    userId: string,
    authorizationCode: string,
    state: string
  ): Promise<SchwabCallbackResult> {
    // Validate state
    await this.validateState(state, userId);
    
    // Exchange authorization code for tokens
    const authResult = await this.provider.authenticate({
      apiKey: process.env.SCHWAB_CLIENT_ID!,
      apiSecret: process.env.SCHWAB_CLIENT_SECRET!,
      redirectUri: process.env.SCHWAB_REDIRECT_URI || 
        `${process.env.APP_URL || 'http://localhost:3000'}/api/broker/schwab/callback`,
      authorizationCode,
    } as any);
    
    brokerLogger.info('Schwab OAuth callback successful', {
      userId,
      expiresAt: authResult.expiresAt
    });
    
    // Fetch user's accounts
    const accounts = await this.provider.getAccounts(authResult.accessToken);
    
    if (accounts.length === 0) {
      throw new Error('No Schwab accounts found for user');
    }
    
    // Store connection in database
    const connectionId = await this.storeConnection(
      userId,
      authResult,
      accounts
    );
    
    return {
      connectionId,
      accountIds: accounts.map(acc => acc.id)
    };
  }
  
  /**
   * Store broker connection in database
   */
  private async storeConnection(
    userId: string,
    authResult: { accessToken: string; expiresAt: Date },
    accounts: Array<{ id: string; name: string }>
  ): Promise<string> {
    // Parse access token JSON to get refresh token
    let refreshToken: string | null = null;
    try {
      const tokenData = JSON.parse(authResult.accessToken);
      refreshToken = tokenData.refreshToken || null;
    } catch {
      // Access token is not JSON (fallback for non-OAuth flows)
      refreshToken = null;
    }
    
    // Encrypt tokens
    const encryptedAccessToken = encryptCredential(authResult.accessToken);
    const encryptedRefreshToken = refreshToken ? encryptCredential(refreshToken) : '';
    
    // For now, connect the first account
    // TODO: Allow user to select which account(s) to connect
    const primaryAccount = accounts[0];
    
    // Check if connection already exists
    const existing = await prisma.brokerConnection.findFirst({
      where: {
        userId,
        brokerType: 'SCHWAB',
        brokerAccountId: primaryAccount.id,
      },
    });
    
    if (existing) {
      // Update existing connection
      const updated = await prisma.brokerConnection.update({
        where: { id: existing.id },
        data: {
          status: 'CONNECTED',
          encryptedApiKey: encryptedAccessToken,
          encryptedApiSecret: encryptedRefreshToken,
          accessToken: authResult.accessToken,
          tokenExpiresAt: authResult.expiresAt,
          brokerAccountName: primaryAccount.name,
          syncEnabled: true,
          lastSyncAt: null,
        },
      });
      
      brokerLogger.info('Schwab connection updated', {
        userId,
        connectionId: updated.id,
        accountId: primaryAccount.id
      });
      
      return updated.id;
    } else {
      // Create new connection
      const connection = await prisma.brokerConnection.create({
        data: {
          userId,
          brokerType: 'SCHWAB',
          status: 'CONNECTED',
          encryptedApiKey: encryptedAccessToken,
          encryptedApiSecret: encryptedRefreshToken,
          accessToken: authResult.accessToken,
          tokenExpiresAt: authResult.expiresAt,
          brokerAccountId: primaryAccount.id,
          brokerAccountName: primaryAccount.name,
          syncEnabled: true,
          syncIntervalMin: 15,
        },
      });
      
      brokerLogger.info('Schwab connection created', {
        userId,
        connectionId: connection.id,
        accountId: primaryAccount.id
      });
      
      return connection.id;
    }
  }
  
  /**
   * Refresh tokens if needed
   */
  async refreshTokensIfNeeded(userId: string): Promise<boolean> {
    const connection = await prisma.brokerConnection.findFirst({
      where: {
        userId,
        brokerType: 'SCHWAB',
      },
    });
    
    if (!connection) {
      throw new Error('No Schwab connection found for user');
    }
    
    // Check if token is expired or expiring soon (within 5 minutes)
    const now = new Date();
    const expiresAt = connection.tokenExpiresAt;
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
    
    if (expiresAt && expiresAt > fiveMinutesFromNow) {
      // Token still valid
      return false;
    }
    
    // Token expired or expiring soon, refresh needed
    try {
      // Parse access token to get refresh token
      let tokenData: any;
      try {
        tokenData = JSON.parse(connection.accessToken);
      } catch {
        // Access token is not JSON (old format or direct token)
        brokerLogger.warn('Schwab access token not in JSON format, cannot refresh', {
          userId,
          connectionId: connection.id
        });
        await prisma.brokerConnection.update({
          where: { id: connection.id },
          data: { status: 'EXPIRED' },
        });
        return true;
      }
      
      const refreshToken = tokenData.refreshToken;
      
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }
      
      // Refresh token via Schwab API
      brokerLogger.info('Schwab token refresh initiated', {
        userId,
        connectionId: connection.id,
        expiresAt: expiresAt?.toISOString()
      });
      
      // Use provider's refreshToken method (available in SchwabProvider)
      try {
        const refreshed = await this.provider.refreshToken(connection.accessToken);
        
        if (refreshed) {
          // Parse new token to get refresh token
          let newTokenData: any;
          try {
            newTokenData = JSON.parse(refreshed.accessToken);
          } catch {
            // Token not in JSON format
            newTokenData = { accessToken: refreshed.accessToken, refreshToken: null };
          }
          
          // Update connection with new tokens
          const encryptedAccessToken = encryptCredential(refreshed.accessToken);
          const newRefreshToken = newTokenData.refreshToken || refreshToken;
          const encryptedRefreshToken = newRefreshToken ? encryptCredential(newRefreshToken) : '';
          
          await prisma.brokerConnection.update({
            where: { id: connection.id },
            data: {
              status: 'CONNECTED',
              encryptedApiKey: encryptedAccessToken,
              encryptedApiSecret: encryptedRefreshToken,
              accessToken: refreshed.accessToken,
              tokenExpiresAt: refreshed.expiresAt,
            },
          });
          
          brokerLogger.info('Schwab tokens refreshed successfully', {
            userId,
            connectionId: connection.id,
            newExpiresAt: refreshed.expiresAt.toISOString()
          });
          
          return true;
        }
      } catch (refreshError) {
        brokerLogger.warn('Schwab token refresh failed, marking expired', {
          userId,
          connectionId: connection.id,
          error: refreshError instanceof Error ? refreshError.message : 'Unknown error'
        });
      }
      
      // If refresh failed, mark as expired
      await prisma.brokerConnection.update({
        where: { id: connection.id },
        data: {
          status: 'EXPIRED', // Mark expired - user needs to re-authenticate
        },
      });
      
      return true;
    } catch (error) {
      brokerLogger.error('Failed to refresh Schwab tokens', {
        userId,
        connectionId: connection.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Mark connection as expired
      await prisma.brokerConnection.update({
        where: { id: connection.id },
        data: {
          status: 'EXPIRED',
        },
      });
      
      throw error;
    }
  }
}
