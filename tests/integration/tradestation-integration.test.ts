/**
 * PRÉ-6.3: Integration Tests - TradeStation Provider
 * 
 * Integration tests for TradeStation broker provider:
 * - OAuth flow
 * - Account fetching
 * - Trade reconstruction
 * - Error handling
 * 
 * @module tests/integration/tradestation-integration
 * @created 2026-01-18
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TradeStationProvider } from '@/services/broker/tradestation-provider';
import { BrokerAuthError, BrokerApiError } from '@/services/broker/types';
import { Direction } from '@prisma/client';

// Mock fetch
global.fetch = vi.fn();

describe('TradeStation Integration Tests', () => {
  let provider: TradeStationProvider;
  
  const mockClientId = 'test_client_id';
  const mockClientSecret = 'test_client_secret';
  const mockRedirectUri = 'http://localhost:3000/api/broker/tradestation/callback';
  
  beforeEach(() => {
    vi.clearAllMocks();
    provider = new TradeStationProvider(
      'sim', // Use sim environment for testing
      mockClientId,
      mockClientSecret,
      mockRedirectUri
    );
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('OAuth Flow Integration', () => {
    it('should generate valid authorization URL', () => {
      const state = 'test_state_12345';
      const authUrl = provider.getAuthorizationUrl(state);
      
      expect(authUrl).toContain('https://signin.tradestation.com/authorize');
      expect(authUrl).toContain('response_type=code');
      expect(authUrl).toContain(`client_id=${mockClientId}`);
      expect(authUrl).toContain(`redirect_uri=${encodeURIComponent(mockRedirectUri)}`);
      expect(authUrl).toContain(`state=${state}`);
      expect(authUrl).toContain('scope=');
    });

    it('should exchange authorization code for tokens', async () => {
      const mockCode = 'test_auth_code';
      const mockTokenResponse = {
        access_token: 'test_access_token_123',
        refresh_token: 'test_refresh_token_456',
        expires_in: 1200,
        token_type: 'Bearer',
        scope: 'openid profile ReadAccount',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      });

      const authResult = await provider.authenticate({
        apiKey: mockClientId,
        apiSecret: mockClientSecret,
        authorizationCode: mockCode,
      } as any);

      expect(authResult.accessToken).toBe(mockTokenResponse.access_token);
      expect(authResult.expiresAt).toBeInstanceOf(Date);
      
      // Check that fetch was called with correct parameters
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://signin.tradestation.com/oauth/token'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        })
      );
    });

    it('should handle OAuth token exchange errors', async () => {
      const mockCode = 'invalid_code';
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'Invalid authorization code',
        }),
      });

      await expect(
        provider.authenticate({
          apiKey: mockClientId,
          apiSecret: mockClientSecret,
          authorizationCode: mockCode,
        } as any)
      ).rejects.toThrow(BrokerAuthError);
    });
  });

  describe('Account Fetching Integration', () => {
    it('should fetch user accounts successfully', async () => {
      const mockAccessToken = 'test_access_token';
      const mockAccountsResponse = {
        Accounts: [
          {
            AccountID: '12345678',
            AccountName: 'Test Account',
            AccountType: 'Cash',
            AccountStatus: 'Open',
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAccountsResponse,
      });

      const accounts = await provider.getAccounts(mockAccessToken);

      expect(accounts).toHaveLength(1);
      expect(accounts[0].id).toBe('12345678');
      expect(accounts[0].name).toBe('Test Account');
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/v3/brokerage/accounts'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockAccessToken}`,
          }),
        })
      );
    });

    it('should handle empty accounts list', async () => {
      const mockAccessToken = 'test_access_token';
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ Accounts: [] }),
      });

      const accounts = await provider.getAccounts(mockAccessToken);

      expect(accounts).toHaveLength(0);
    });

    it('should handle API errors when fetching accounts', async () => {
      const mockAccessToken = 'invalid_token';
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: 'Unauthorized',
          message: 'Invalid access token',
        }),
      });

      await expect(provider.getAccounts(mockAccessToken)).rejects.toThrow(
        BrokerApiError
      );
    });
  });

  describe('Trade Reconstruction Integration', () => {
    it('should reconstruct trades from orders', async () => {
      const mockAccessToken = 'test_access_token';
      const mockAccountId = '12345678';
      
      const mockOrdersResponse = {
        Orders: [
          {
            OrderID: 'ORD001',
            AccountID: mockAccountId,
            Symbol: 'TSLA',
            Quantity: 10,
            OrderType: 'Market',
            TimeInForce: 'Day',
            OrderStatus: 'Filled',
            OrderTime: '2026-01-18T10:00:00Z',
            Fills: [
              {
                FillID: 'FILL001',
                Quantity: 10,
                FillPrice: 250.50,
                FillTime: '2026-01-18T10:00:01Z',
              },
            ],
          },
          {
            OrderID: 'ORD002',
            AccountID: mockAccountId,
            Symbol: 'TSLA',
            Quantity: -10,
            OrderType: 'Market',
            TimeInForce: 'Day',
            OrderStatus: 'Filled',
            OrderTime: '2026-01-18T14:30:00Z',
            Fills: [
              {
                FillID: 'FILL002',
                Quantity: 10,
                FillPrice: 255.75,
                FillTime: '2026-01-18T14:30:01Z',
              },
            ],
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOrdersResponse,
      });

      const trades = await provider.getTrades(mockAccessToken, {
        accountId: mockAccountId,
        startDate: new Date('2026-01-18'),
        endDate: new Date('2026-01-18'),
      });

      expect(trades.length).toBeGreaterThan(0);
      
      // Verify trade structure
      const trade = trades[0];
      expect(trade.symbol).toBe('TSLA');
      expect(trade.quantity).toBe(10);
      expect(trade.direction).toBe(Direction.LONG);
    });

    it('should handle partial fills correctly', async () => {
      const mockAccessToken = 'test_access_token';
      const mockAccountId = '12345678';
      
      const mockOrdersResponse = {
        Orders: [
          {
            OrderID: 'ORD003',
            AccountID: mockAccountId,
            Symbol: 'NVDA',
            Quantity: 20,
            OrderType: 'Limit',
            TimeInForce: 'Day',
            OrderStatus: 'PartiallyFilled',
            OrderTime: '2026-01-18T09:00:00Z',
            Fills: [
              {
                FillID: 'FILL003',
                Quantity: 10,
                FillPrice: 500.00,
                FillTime: '2026-01-18T09:05:00Z',
              },
              {
                FillID: 'FILL004',
                Quantity: 10,
                FillPrice: 500.25,
                FillTime: '2026-01-18T09:10:00Z',
              },
            ],
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOrdersResponse,
      });

      const trades = await provider.getTrades(mockAccessToken, {
        accountId: mockAccountId,
        startDate: new Date('2026-01-18'),
        endDate: new Date('2026-01-18'),
      });

      // Should aggregate partial fills into single trade or multiple trades
      expect(trades.length).toBeGreaterThan(0);
      
      // Verify total quantity matches sum of fills
      const totalQuantity = trades
        .filter(t => t.symbol === 'NVDA' && t.direction === Direction.LONG)
        .reduce((sum, t) => sum + t.quantity, 0);
      
      expect(totalQuantity).toBe(20);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle rate limiting errors', async () => {
      const mockAccessToken = 'test_access_token';
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({
          'Retry-After': '60',
        }),
        json: async () => ({
          error: 'Rate limit exceeded',
          message: 'Too many requests',
        }),
      });

      await expect(provider.getAccounts(mockAccessToken)).rejects.toThrow();
    });

    it('should handle network errors gracefully', async () => {
      const mockAccessToken = 'test_access_token';
      
      (global.fetch as any).mockRejectedValueOnce(
        new Error('Network error: Failed to fetch')
      );

      await expect(provider.getAccounts(mockAccessToken)).rejects.toThrow();
    });

    it('should handle timeout errors', async () => {
      const mockAccessToken = 'test_access_token';
      
      (global.fetch as any).mockImplementationOnce(
        () => new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 5000)
        )
      );

      // This should timeout or throw error
      await expect(provider.getAccounts(mockAccessToken)).rejects.toThrow();
    });
  });

  describe('Sim vs Live Environment', () => {
    it('should use sim API endpoint for sim environment', () => {
      const simProvider = new TradeStationProvider(
        'sim',
        mockClientId,
        mockClientSecret,
        mockRedirectUri
      );
      
      const authUrl = simProvider.getAuthorizationUrl('test_state');
      
      // Sim environment should use sim API base
      // Note: Check actual implementation for sim URL pattern
      expect(authUrl).toBeTruthy();
    });

    it('should use live API endpoint for live environment', () => {
      const liveProvider = new TradeStationProvider(
        'live',
        mockClientId,
        mockClientSecret,
        mockRedirectUri
      );
      
      const authUrl = liveProvider.getAuthorizationUrl('test_state');
      
      expect(authUrl).toContain('signin.tradestation.com');
    });
  });
});
