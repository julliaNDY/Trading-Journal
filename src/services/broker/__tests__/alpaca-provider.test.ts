/**
 * Alpaca Provider Tests
 * 
 * Tests for the Alpaca broker provider implementation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AlpacaProvider } from '../alpaca-provider';
import { BrokerAuthError, BrokerApiError, BrokerRateLimitError } from '../types';

// Mock fetch
global.fetch = vi.fn();

describe('AlpacaProvider', () => {
  let provider: AlpacaProvider;
  const mockApiKey = 'test-api-key';
  const mockApiSecret = 'test-api-secret';

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new AlpacaProvider('paper');
  });

  describe('authenticate', () => {
    it('should authenticate successfully with valid credentials', async () => {
      const mockAccount = {
        id: 'account-123',
        account_number: 'ACC123456',
        status: 'ACTIVE',
        currency: 'USD',
        equity: '10000.00',
        cash: '5000.00',
        portfolio_value: '10000.00',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAccount,
        headers: {
          get: (key: string) => {
            if (key === 'X-RateLimit-Remaining') return '200';
            return null;
          },
        },
      });

      const result = await provider.authenticate({
        apiKey: mockApiKey,
        apiSecret: mockApiSecret,
      });

      expect(result.accessToken).toBeDefined();
      expect(result.userId).toBe('account-123');
      expect(result.expiresAt).toBeInstanceOf(Date);

      // Verify accessToken contains credentials
      const parsed = JSON.parse(result.accessToken);
      expect(parsed.apiKey).toBe(mockApiKey);
      expect(parsed.apiSecret).toBe(mockApiSecret);
      expect(parsed.environment).toBe('paper');
    });

    it('should throw BrokerAuthError on 401', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      await expect(
        provider.authenticate({
          apiKey: 'invalid',
          apiSecret: 'invalid',
        })
      ).rejects.toThrow(BrokerAuthError);
    });

    it('should throw BrokerRateLimitError on 429', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
        headers: {
          get: (key: string) => {
            if (key === 'X-RateLimit-Reset') {
              return String(Math.floor(Date.now() / 1000) + 60);
            }
            return null;
          },
        },
      });

      await expect(
        provider.authenticate({
          apiKey: mockApiKey,
          apiSecret: mockApiSecret,
        })
      ).rejects.toThrow(BrokerRateLimitError);
    });
  });

  describe('getAccounts', () => {
    it('should return account list', async () => {
      const mockAccount = {
        id: 'account-123',
        account_number: 'ACC123456',
        status: 'ACTIVE',
        currency: 'USD',
        equity: '10000.00',
        cash: '5000.00',
        portfolio_value: '10000.00',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAccount,
        headers: {
          get: (key: string) => {
            if (key === 'X-RateLimit-Remaining') return '200';
            return null;
          },
        },
      });

      const accessToken = JSON.stringify({
        apiKey: mockApiKey,
        apiSecret: mockApiSecret,
        environment: 'paper',
      });

      const accounts = await provider.getAccounts(accessToken);

      expect(accounts).toHaveLength(1);
      expect(accounts[0].id).toBe('ACC123456');
      expect(accounts[0].name).toContain('Alpaca');
      expect(accounts[0].balance).toBe(10000);
      expect(accounts[0].currency).toBe('USD');
    });
  });

  describe('getTrades', () => {
    it('should reconstruct trades from orders', async () => {
      const mockOrders = [
        {
          id: 'order-1',
          symbol: 'AAPL',
          side: 'buy',
          filled_at: '2024-01-15T10:00:00Z',
          filled_qty: '100',
          filled_avg_price: '150.00',
          status: 'filled',
          asset_class: 'us_equity',
          commission: 0,
        },
        {
          id: 'order-2',
          symbol: 'AAPL',
          side: 'sell',
          filled_at: '2024-01-15T15:00:00Z',
          filled_qty: '100',
          filled_avg_price: '155.00',
          status: 'filled',
          asset_class: 'us_equity',
          commission: 0,
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOrders,
        headers: {
          get: (key: string) => {
            if (key === 'X-RateLimit-Remaining') return '200';
            return null;
          },
        },
      });

      const accessToken = JSON.stringify({
        apiKey: mockApiKey,
        apiSecret: mockApiSecret,
        environment: 'paper',
      });

      const trades = await provider.getTrades(accessToken, 'ACC123456');

      expect(trades).toHaveLength(1);
      expect(trades[0].symbol).toBe('AAPL');
      expect(trades[0].direction).toBe('LONG');
      expect(trades[0].entryPrice).toBe(150);
      expect(trades[0].exitPrice).toBe(155);
      expect(trades[0].quantity).toBe(100);
      expect(trades[0].realizedPnl).toBe(500); // (155 - 150) * 100
    });

    it('should handle SHORT trades', async () => {
      const mockOrders = [
        {
          id: 'order-1',
          symbol: 'TSLA',
          side: 'sell',
          filled_at: '2024-01-15T10:00:00Z',
          filled_qty: '50',
          filled_avg_price: '200.00',
          status: 'filled',
          asset_class: 'us_equity',
          commission: 0,
        },
        {
          id: 'order-2',
          symbol: 'TSLA',
          side: 'buy',
          filled_at: '2024-01-15T15:00:00Z',
          filled_qty: '50',
          filled_avg_price: '195.00',
          status: 'filled',
          asset_class: 'us_equity',
          commission: 0,
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOrders,
        headers: {
          get: (key: string) => {
            if (key === 'X-RateLimit-Remaining') return '200';
            return null;
          },
        },
      });

      const accessToken = JSON.stringify({
        apiKey: mockApiKey,
        apiSecret: mockApiSecret,
        environment: 'paper',
      });

      const trades = await provider.getTrades(accessToken, 'ACC123456');

      expect(trades).toHaveLength(1);
      expect(trades[0].symbol).toBe('TSLA');
      expect(trades[0].direction).toBe('SHORT');
      expect(trades[0].entryPrice).toBe(200);
      expect(trades[0].exitPrice).toBe(195);
      expect(trades[0].quantity).toBe(50);
      expect(trades[0].realizedPnl).toBe(250); // (200 - 195) * 50
    });

    it('should handle multiple trades for same symbol', async () => {
      const mockOrders = [
        // First trade
        {
          id: 'order-1',
          symbol: 'AAPL',
          side: 'buy',
          filled_at: '2024-01-15T10:00:00Z',
          filled_qty: '100',
          filled_avg_price: '150.00',
          status: 'filled',
          asset_class: 'us_equity',
          commission: 0,
        },
        {
          id: 'order-2',
          symbol: 'AAPL',
          side: 'sell',
          filled_at: '2024-01-15T11:00:00Z',
          filled_qty: '100',
          filled_avg_price: '155.00',
          status: 'filled',
          asset_class: 'us_equity',
          commission: 0,
        },
        // Second trade
        {
          id: 'order-3',
          symbol: 'AAPL',
          side: 'buy',
          filled_at: '2024-01-15T14:00:00Z',
          filled_qty: '200',
          filled_avg_price: '152.00',
          status: 'filled',
          asset_class: 'us_equity',
          commission: 0,
        },
        {
          id: 'order-4',
          symbol: 'AAPL',
          side: 'sell',
          filled_at: '2024-01-15T15:00:00Z',
          filled_qty: '200',
          filled_avg_price: '158.00',
          status: 'filled',
          asset_class: 'us_equity',
          commission: 0,
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOrders,
        headers: {
          get: (key: string) => {
            if (key === 'X-RateLimit-Remaining') return '200';
            return null;
          },
        },
      });

      const accessToken = JSON.stringify({
        apiKey: mockApiKey,
        apiSecret: mockApiSecret,
        environment: 'paper',
      });

      const trades = await provider.getTrades(accessToken, 'ACC123456');

      expect(trades).toHaveLength(2);
      expect(trades[0].realizedPnl).toBe(500); // First trade
      expect(trades[1].realizedPnl).toBe(1200); // Second trade
    });

    it('should filter by since date', async () => {
      const mockOrders = [
        {
          id: 'order-1',
          symbol: 'AAPL',
          side: 'buy',
          filled_at: '2024-01-15T10:00:00Z',
          filled_qty: '100',
          filled_avg_price: '150.00',
          status: 'filled',
          asset_class: 'us_equity',
          commission: 0,
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOrders,
        headers: {
          get: (key: string) => {
            if (key === 'X-RateLimit-Remaining') return '200';
            return null;
          },
        },
      });

      const accessToken = JSON.stringify({
        apiKey: mockApiKey,
        apiSecret: mockApiSecret,
        environment: 'paper',
      });

      const since = new Date('2024-01-10T00:00:00Z');
      await provider.getTrades(accessToken, 'ACC123456', since);

      // Verify the API was called with the correct params
      const fetchCall = (global.fetch as any).mock.calls[0];
      const url = fetchCall[0];
      // URL encode the colon characters
      expect(url).toContain('after=2024-01-10T00%3A00%3A00.000Z');
    });
  });

  describe('rate limiting', () => {
    it('should warn when rate limit is low', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const mockAccount = {
        id: 'account-123',
        account_number: 'ACC123456',
        status: 'ACTIVE',
        currency: 'USD',
        equity: '10000.00',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAccount,
        headers: {
          get: (key: string) => {
            if (key === 'X-RateLimit-Remaining') return '5'; // Low remaining
            return null;
          },
        },
      });

      await provider.authenticate({
        apiKey: mockApiKey,
        apiSecret: mockApiSecret,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Rate limit warning')
      );

      consoleSpy.mockRestore();
    });
  });
});
