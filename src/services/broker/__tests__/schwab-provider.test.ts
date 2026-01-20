/**
 * Charles Schwab Provider Tests
 * 
 * Unit tests for Schwab broker provider implementation.
 * 
 * @author Dev 26
 * @date 2026-01-17
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SchwabProvider } from '../schwab-provider';
import { BrokerAuthError, BrokerApiError, BrokerRateLimitError } from '../types';

// Mock fetch globally
global.fetch = vi.fn();

describe('SchwabProvider', () => {
  let provider: SchwabProvider;
  const mockClientId = 'test_client_id';
  const mockClientSecret = 'test_client_secret';
  const mockRedirectUri = 'https://example.com/callback';
  
  beforeEach(() => {
    provider = new SchwabProvider(mockClientId, mockClientSecret, mockRedirectUri);
    vi.clearAllMocks();
  });
  
  describe('OAuth 2.0 Flow', () => {
    it('should generate correct authorization URL', () => {
      const authUrl = provider.getAuthorizationUrl();
      
      expect(authUrl).toContain('https://api.schwabapi.com/v1/oauth/authorize');
      expect(authUrl).toContain(`client_id=${mockClientId}`);
      expect(authUrl).toContain(`redirect_uri=${encodeURIComponent(mockRedirectUri)}`);
      expect(authUrl).toContain('response_type=code');
      expect(authUrl).toContain('scope=api');
    });
    
    it('should include state parameter when provided', () => {
      const state = 'random_state_123';
      const authUrl = provider.getAuthorizationUrl(state);
      
      expect(authUrl).toContain(`state=${state}`);
    });
    
    it('should exchange authorization code for tokens', async () => {
      const mockAuthCode = 'test_auth_code';
      const mockTokenResponse = {
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
        expires_in: 1800,
        token_type: 'Bearer',
        scope: 'api',
      };
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      });
      
      const result = await provider.authenticate({
        apiKey: mockClientId,
        apiSecret: mockClientSecret,
        authorizationCode: mockAuthCode,
      } as any);
      
      expect(result.accessToken).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);
      
      // Verify fetch was called with correct parameters
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.schwabapi.com/v1/oauth/token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': expect.stringContaining('Basic'),
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        })
      );
    });
    
    it('should throw error when authorization code is missing', async () => {
      await expect(
        provider.authenticate({
          apiKey: mockClientId,
          apiSecret: mockClientSecret,
        } as any)
      ).rejects.toThrow(BrokerAuthError);
    });
    
    it('should throw error when token exchange fails', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        text: async () => 'Invalid authorization code',
      });
      
      await expect(
        provider.authenticate({
          apiKey: mockClientId,
          apiSecret: mockClientSecret,
          authorizationCode: 'invalid_code',
        } as any)
      ).rejects.toThrow(BrokerAuthError);
    });
  });
  
  describe('Token Refresh', () => {
    it('should refresh access token when expired', async () => {
      const expiredTokenData = {
        accessToken: 'old_access_token',
        refreshToken: 'valid_refresh_token',
        expiresAt: Date.now() - 1000, // Expired 1 second ago
      };
      const expiredToken = JSON.stringify(expiredTokenData);
      
      const mockTokenResponse = {
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        expires_in: 1800,
        token_type: 'Bearer',
        scope: 'api',
      };
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      });
      
      const result = await provider.refreshToken(expiredToken);
      
      expect(result).not.toBeNull();
      expect(result!.accessToken).toBeDefined();
      expect(result!.expiresAt).toBeInstanceOf(Date);
    });
    
    it('should return null when token is still valid', async () => {
      const validTokenData = {
        accessToken: 'valid_access_token',
        refreshToken: 'valid_refresh_token',
        expiresAt: Date.now() + 60000, // Expires in 1 minute
      };
      const validToken = JSON.stringify(validTokenData);
      
      const result = await provider.refreshToken(validToken);
      
      expect(result).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });
    
    it('should throw error when refresh token is invalid', async () => {
      const tokenData = {
        accessToken: 'old_access_token',
        refreshToken: 'invalid_refresh_token',
        expiresAt: Date.now() - 1000,
      };
      const token = JSON.stringify(tokenData);
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        text: async () => 'Invalid refresh token',
      });
      
      await expect(
        provider.refreshToken(token)
      ).rejects.toThrow(BrokerAuthError);
    });
  });
  
  describe('Get Accounts', () => {
    it('should fetch and format accounts correctly', async () => {
      const tokenData = {
        accessToken: 'valid_access_token',
        refreshToken: 'valid_refresh_token',
        expiresAt: Date.now() + 60000,
      };
      const token = JSON.stringify(tokenData);
      
      const mockAccountsResponse = [
        {
          securitiesAccount: {
            accountNumber: '12345678',
            accountHash: 'abc123hash',
            type: 'MARGIN',
            roundTrips: 0,
            isDayTrader: false,
            isClosingOnlyRestricted: false,
            currentBalances: {
              liquidationValue: 50000.00,
              cashBalance: 10000.00,
              equity: 50000.00,
            },
          },
        },
      ];
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAccountsResponse,
      });
      
      const accounts = await provider.getAccounts(token);
      
      expect(accounts).toHaveLength(1);
      expect(accounts[0]).toEqual({
        id: 'abc123hash',
        name: 'Schwab 12345678 (MARGIN)',
        balance: 50000.00,
        currency: 'USD',
      });
    });
    
    it('should throw error when API returns 401', async () => {
      const tokenData = {
        accessToken: 'invalid_access_token',
        refreshToken: 'valid_refresh_token',
        expiresAt: Date.now() + 60000,
      };
      const token = JSON.stringify(tokenData);
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });
      
      await expect(
        provider.getAccounts(token)
      ).rejects.toThrow(BrokerAuthError);
    });
  });
  
  describe('Get Trades', () => {
    it('should fetch and reconstruct trades correctly', async () => {
      const tokenData = {
        accessToken: 'valid_access_token',
        refreshToken: 'valid_refresh_token',
        expiresAt: Date.now() + 60000,
      };
      const token = JSON.stringify(tokenData);
      
      const mockTransactionsResponse = [
        // Buy order (opening)
        {
          activityId: 1001,
          time: '2026-01-15T14:30:00Z',
          type: 'TRADE',
          status: 'VALID',
          netAmount: -1500.50, // Negative = debit = buy
          activityType: 'EXECUTION',
          executionLegs: [
            {
              legId: 1,
              quantity: 10,
              price: 150.05,
              time: '2026-01-15T14:30:00Z',
            },
          ],
          orderRemainingQuantity: 0,
          instrument: {
            symbol: 'AAPL',
            cusip: '037833100',
            description: 'Apple Inc.',
            instrumentId: 123456,
            netChange: 2.50,
          },
          positionEffect: 'OPENING',
        },
        // Sell order (closing)
        {
          activityId: 1002,
          time: '2026-01-15T15:45:00Z',
          type: 'TRADE',
          status: 'VALID',
          netAmount: 1550.00, // Positive = credit = sell
          activityType: 'EXECUTION',
          executionLegs: [
            {
              legId: 1,
              quantity: 10,
              price: 155.00,
              time: '2026-01-15T15:45:00Z',
            },
          ],
          orderRemainingQuantity: 0,
          instrument: {
            symbol: 'AAPL',
            cusip: '037833100',
            description: 'Apple Inc.',
            instrumentId: 123456,
            netChange: 2.50,
          },
          positionEffect: 'CLOSING',
        },
      ];
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTransactionsResponse,
      });
      
      const trades = await provider.getTrades(token, 'abc123hash');
      
      expect(trades).toHaveLength(1);
      expect(trades[0]).toMatchObject({
        brokerTradeId: '1001-1002',
        symbol: 'AAPL',
        direction: 'LONG',
        entryPrice: 150.05,
        exitPrice: 155.00,
        quantity: 10,
        realizedPnl: expect.closeTo(49.50, 2), // (155 - 150.05) * 10
      });
    });
    
    it('should handle multiple entry orders (scale in)', async () => {
      const tokenData = {
        accessToken: 'valid_access_token',
        refreshToken: 'valid_refresh_token',
        expiresAt: Date.now() + 60000,
      };
      const token = JSON.stringify(tokenData);
      
      const mockTransactionsResponse = [
        // First buy
        {
          activityId: 1001,
          time: '2026-01-15T14:30:00Z',
          type: 'TRADE',
          status: 'VALID',
          netAmount: -1000.00,
          activityType: 'EXECUTION',
          executionLegs: [{ legId: 1, quantity: 10, price: 100.00, time: '2026-01-15T14:30:00Z' }],
          orderRemainingQuantity: 0,
          instrument: { symbol: 'TSLA', instrumentId: 123456 },
          positionEffect: 'OPENING',
        },
        // Second buy (scale in)
        {
          activityId: 1002,
          time: '2026-01-15T14:45:00Z',
          type: 'TRADE',
          status: 'VALID',
          netAmount: -1050.00,
          activityType: 'EXECUTION',
          executionLegs: [{ legId: 1, quantity: 10, price: 105.00, time: '2026-01-15T14:45:00Z' }],
          orderRemainingQuantity: 0,
          instrument: { symbol: 'TSLA', instrumentId: 123456 },
          positionEffect: 'OPENING',
        },
        // Sell all
        {
          activityId: 1003,
          time: '2026-01-15T15:00:00Z',
          type: 'TRADE',
          status: 'VALID',
          netAmount: 2200.00,
          activityType: 'EXECUTION',
          executionLegs: [{ legId: 1, quantity: 20, price: 110.00, time: '2026-01-15T15:00:00Z' }],
          orderRemainingQuantity: 0,
          instrument: { symbol: 'TSLA', instrumentId: 123456 },
          positionEffect: 'CLOSING',
        },
      ];
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTransactionsResponse,
      });
      
      const trades = await provider.getTrades(token, 'abc123hash');
      
      expect(trades).toHaveLength(1);
      expect(trades[0]).toMatchObject({
        symbol: 'TSLA',
        direction: 'LONG',
        entryPrice: 102.50, // Weighted average: (100*10 + 105*10) / 20
        exitPrice: 110.00,
        quantity: 20,
        realizedPnl: expect.closeTo(150.00, 2), // (110 - 102.5) * 20
      });
    });
    
    it('should handle SHORT trades correctly', async () => {
      const tokenData = {
        accessToken: 'valid_access_token',
        refreshToken: 'valid_refresh_token',
        expiresAt: Date.now() + 60000,
      };
      const token = JSON.stringify(tokenData);
      
      const mockTransactionsResponse = [
        // Sell short (opening)
        {
          activityId: 2001,
          time: '2026-01-15T14:30:00Z',
          type: 'TRADE',
          status: 'VALID',
          netAmount: 1000.00, // Positive = credit = sell
          activityType: 'EXECUTION',
          executionLegs: [{ legId: 1, quantity: 10, price: 100.00, time: '2026-01-15T14:30:00Z' }],
          orderRemainingQuantity: 0,
          instrument: { symbol: 'SPY', instrumentId: 123456 },
          positionEffect: 'OPENING',
        },
        // Buy to cover (closing)
        {
          activityId: 2002,
          time: '2026-01-15T15:00:00Z',
          type: 'TRADE',
          status: 'VALID',
          netAmount: -950.00, // Negative = debit = buy
          activityType: 'EXECUTION',
          executionLegs: [{ legId: 1, quantity: 10, price: 95.00, time: '2026-01-15T15:00:00Z' }],
          orderRemainingQuantity: 0,
          instrument: { symbol: 'SPY', instrumentId: 123456 },
          positionEffect: 'CLOSING',
        },
      ];
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTransactionsResponse,
      });
      
      const trades = await provider.getTrades(token, 'abc123hash');
      
      expect(trades).toHaveLength(1);
      expect(trades[0]).toMatchObject({
        symbol: 'SPY',
        direction: 'SHORT',
        entryPrice: 100.00,
        exitPrice: 95.00,
        quantity: 10,
        realizedPnl: expect.closeTo(50.00, 2), // (100 - 95) * 10 for SHORT
      });
    });
    
    it('should respect 60-day history limit', async () => {
      const tokenData = {
        accessToken: 'valid_access_token',
        refreshToken: 'valid_refresh_token',
        expiresAt: Date.now() + 60000,
      };
      const token = JSON.stringify(tokenData);
      
      // Request trades from 90 days ago (should be clamped to 60 days)
      const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });
      
      await provider.getTrades(token, 'abc123hash', since);
      
      // Verify fetch was called with 60-day limit
      const fetchCall = (global.fetch as any).mock.calls[0];
      const url = fetchCall[0] as string;
      
      expect(url).toContain('startDate=');
      
      // Extract startDate from URL
      const startDateMatch = url.match(/startDate=([^&]+)/);
      expect(startDateMatch).toBeTruthy();
      
      const startDate = new Date(startDateMatch![1]);
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      
      // Should be approximately 60 days ago (within 1 day tolerance)
      const diffDays = Math.abs(startDate.getTime() - sixtyDaysAgo.getTime()) / (24 * 60 * 60 * 1000);
      expect(diffDays).toBeLessThan(1);
    });
    
    it('should throw error when rate limit is exceeded', async () => {
      const tokenData = {
        accessToken: 'valid_access_token',
        refreshToken: 'valid_refresh_token',
        expiresAt: Date.now() + 60000,
      };
      const token = JSON.stringify(tokenData);
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Map([['Retry-After', '60']]),
        text: async () => 'Rate limit exceeded',
      });
      
      await expect(
        provider.getTrades(token, 'abc123hash')
      ).rejects.toThrow(BrokerRateLimitError);
    });
  });
  
  describe('Error Handling', () => {
    it('should throw BrokerAuthError for invalid token format', () => {
      expect(() => {
        (provider as any).parseAccessToken('invalid_json');
      }).toThrow(BrokerAuthError);
    });
    
    it('should throw BrokerApiError for API errors', async () => {
      const tokenData = {
        accessToken: 'valid_access_token',
        refreshToken: 'valid_refresh_token',
        expiresAt: Date.now() + 60000,
      };
      const token = JSON.stringify(tokenData);
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      });
      
      await expect(
        provider.getAccounts(token)
      ).rejects.toThrow(BrokerApiError);
    });
  });
});
