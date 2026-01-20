/**
 * TradeStation Provider Unit Tests
 * 
 * Tests OAuth flow, account fetching, and trade reconstruction.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TradeStationProvider } from '../tradestation-provider';
import { Direction } from '@prisma/client';

// Mock fetch
global.fetch = vi.fn();

describe('TradeStationProvider', () => {
  let provider: TradeStationProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new TradeStationProvider(
      'live',
      'test_client_id',
      'test_client_secret',
      'http://localhost:3000/callback'
    );
  });

  describe('OAuth Flow', () => {
    it('should generate authorization URL with correct parameters', () => {
      const state = 'random_state_123';
      const authUrl = provider.getAuthorizationUrl(state);

      expect(authUrl).toContain('https://signin.tradestation.com/authorize');
      expect(authUrl).toContain('response_type=code');
      expect(authUrl).toContain('client_id=test_client_id');
      expect(authUrl).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback');
      expect(authUrl).toContain('scope=openid+profile+offline_access+ReadAccount');
      expect(authUrl).toContain(`state=${state}`);
    });

    it('should exchange authorization code for access token', async () => {
      const mockResponse = {
        access_token: 'test_access_token',
        refresh_token: 'test_refresh_token',
        expires_in: 1200, // 20 minutes
        token_type: 'Bearer',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await provider.authenticate({
        apiKey: '',
        apiSecret: '',
        authorizationCode: 'test_auth_code',
      });

      expect(result.accessToken).toBe('test_access_token');
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://signin.tradestation.com/oauth/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
      );
    });

    it('should throw error if authorization code is missing', async () => {
      await expect(
        provider.authenticate({
          apiKey: '',
          apiSecret: '',
        })
      ).rejects.toThrow('Authorization code is required');
    });

    it('should refresh access token', async () => {
      const mockResponse = {
        access_token: 'new_access_token',
        expires_in: 1200,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await provider.refreshToken('old_refresh_token');

      expect(result).not.toBeNull();
      expect(result?.accessToken).toBe('new_access_token');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://signin.tradestation.com/oauth/token',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  describe('Account Fetching', () => {
    it('should fetch and map accounts correctly', async () => {
      const mockResponse = {
        Accounts: [
          {
            AccountID: '123456789',
            AccountType: 'Cash',
            Status: 'Active',
            Currency: 'USD',
          },
          {
            AccountID: '987654321',
            AccountType: 'Margin',
            Status: 'Active',
            Currency: 'USD',
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const accounts = await provider.getAccounts('test_access_token');

      expect(accounts).toHaveLength(2);
      expect(accounts[0]).toEqual({
        id: '123456789',
        name: 'Cash (123456789)',
        currency: 'USD',
      });
      expect(accounts[1]).toEqual({
        id: '987654321',
        name: 'Margin (987654321)',
        currency: 'USD',
      });
    });

    it('should return empty array if no accounts', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ Accounts: [] }),
      });

      const accounts = await provider.getAccounts('test_access_token');

      expect(accounts).toHaveLength(0);
    });
  });

  describe('Trade Reconstruction', () => {
    it('should reconstruct simple LONG trade (buy then sell)', async () => {
      const mockOrders = {
        Orders: [
          {
            OrderID: 'ORD-1',
            Symbol: 'AAPL',
            Quantity: 100,
            Side: 'Buy',
            Status: 'Filled',
            FilledQuantity: 100,
            AveragePrice: 150.0,
            OrderPlacedTime: '2026-01-17T10:00:00Z',
            FilledTime: '2026-01-17T10:00:05Z',
            Commission: 1.0,
          },
          {
            OrderID: 'ORD-2',
            Symbol: 'AAPL',
            Quantity: 100,
            Side: 'Sell',
            Status: 'Filled',
            FilledQuantity: 100,
            AveragePrice: 155.0,
            OrderPlacedTime: '2026-01-17T11:00:00Z',
            FilledTime: '2026-01-17T11:00:05Z',
            Commission: 1.0,
          },
        ],
        NextToken: null,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOrders,
      });

      const trades = await provider.getTrades('test_access_token', '123456789');

      expect(trades).toHaveLength(1);
      expect(trades[0]).toMatchObject({
        brokerTradeId: 'ORD-1-ORD-2',
        symbol: 'AAPL',
        direction: Direction.LONG,
        entryPrice: 150.0,
        exitPrice: 155.0,
        quantity: 100,
        realizedPnl: 500.0 - 2.0, // (155-150)*100 - fees
        fees: 2.0,
      });
    });

    it('should reconstruct simple SHORT trade (sell then buy)', async () => {
      const mockOrders = {
        Orders: [
          {
            OrderID: 'ORD-1',
            Symbol: 'TSLA',
            Quantity: 50,
            Side: 'Sell',
            Status: 'Filled',
            FilledQuantity: 50,
            AveragePrice: 250.0,
            OrderPlacedTime: '2026-01-17T10:00:00Z',
            FilledTime: '2026-01-17T10:00:05Z',
            Commission: 1.0,
          },
          {
            OrderID: 'ORD-2',
            Symbol: 'TSLA',
            Quantity: 50,
            Side: 'Buy',
            Status: 'Filled',
            FilledQuantity: 50,
            AveragePrice: 245.0,
            OrderPlacedTime: '2026-01-17T11:00:00Z',
            FilledTime: '2026-01-17T11:00:05Z',
            Commission: 1.0,
          },
        ],
        NextToken: null,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOrders,
      });

      const trades = await provider.getTrades('test_access_token', '123456789');

      expect(trades).toHaveLength(1);
      expect(trades[0]).toMatchObject({
        brokerTradeId: 'ORD-1-ORD-2',
        symbol: 'TSLA',
        direction: Direction.SHORT,
        entryPrice: 250.0,
        exitPrice: 245.0,
        quantity: 50,
        realizedPnl: 250.0 - 2.0, // (250-245)*50 - fees
        fees: 2.0,
      });
    });

    it('should handle multiple trades for same symbol', async () => {
      const mockOrders = {
        Orders: [
          // First trade
          {
            OrderID: 'ORD-1',
            Symbol: 'AAPL',
            Quantity: 100,
            Side: 'Buy',
            Status: 'Filled',
            FilledQuantity: 100,
            AveragePrice: 150.0,
            OrderPlacedTime: '2026-01-17T10:00:00Z',
            FilledTime: '2026-01-17T10:00:05Z',
            Commission: 1.0,
          },
          {
            OrderID: 'ORD-2',
            Symbol: 'AAPL',
            Quantity: 100,
            Side: 'Sell',
            Status: 'Filled',
            FilledQuantity: 100,
            AveragePrice: 155.0,
            OrderPlacedTime: '2026-01-17T11:00:00Z',
            FilledTime: '2026-01-17T11:00:05Z',
            Commission: 1.0,
          },
          // Second trade
          {
            OrderID: 'ORD-3',
            Symbol: 'AAPL',
            Quantity: 200,
            Side: 'Buy',
            Status: 'Filled',
            FilledQuantity: 200,
            AveragePrice: 160.0,
            OrderPlacedTime: '2026-01-17T12:00:00Z',
            FilledTime: '2026-01-17T12:00:05Z',
            Commission: 2.0,
          },
          {
            OrderID: 'ORD-4',
            Symbol: 'AAPL',
            Quantity: 200,
            Side: 'Sell',
            Status: 'Filled',
            FilledQuantity: 200,
            AveragePrice: 165.0,
            OrderPlacedTime: '2026-01-17T13:00:00Z',
            FilledTime: '2026-01-17T13:00:05Z',
            Commission: 2.0,
          },
        ],
        NextToken: null,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOrders,
      });

      const trades = await provider.getTrades('test_access_token', '123456789');

      expect(trades).toHaveLength(2);
      expect(trades[0].quantity).toBe(100);
      expect(trades[1].quantity).toBe(200);
    });

    it('should filter out non-filled orders', async () => {
      const mockOrders = {
        Orders: [
          {
            OrderID: 'ORD-1',
            Symbol: 'AAPL',
            Quantity: 100,
            Side: 'Buy',
            Status: 'Filled',
            FilledQuantity: 100,
            AveragePrice: 150.0,
            OrderPlacedTime: '2026-01-17T10:00:00Z',
            FilledTime: '2026-01-17T10:00:05Z',
            Commission: 1.0,
          },
          {
            OrderID: 'ORD-2',
            Symbol: 'AAPL',
            Quantity: 100,
            Side: 'Sell',
            Status: 'Pending',
            FilledQuantity: 0,
            AveragePrice: 0,
            OrderPlacedTime: '2026-01-17T11:00:00Z',
            FilledTime: '2026-01-17T11:00:05Z',
            Commission: 0,
          },
        ],
        NextToken: null,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOrders,
      });

      const trades = await provider.getTrades('test_access_token', '123456789');

      // Should not create a trade because sell order is not filled
      expect(trades).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle 401 unauthorized error', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'unauthorized' }),
      });

      await expect(
        provider.getAccounts('invalid_token')
      ).rejects.toThrow('Access token expired or invalid');
    });

    it('should handle 429 rate limit error', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: {
          get: (name: string) => (name === 'Retry-After' ? '300' : null),
        },
        json: async () => ({ error: 'rate_limit_exceeded' }),
      });

      await expect(
        provider.getAccounts('test_token')
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('should handle generic API errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'server_error' }),
      });

      await expect(
        provider.getAccounts('test_token')
      ).rejects.toThrow();
    });
  });
});
