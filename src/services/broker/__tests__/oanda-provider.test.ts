/**
 * OANDA Provider Tests
 * 
 * Unit tests for OANDA broker provider implementation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OandaProvider } from '../oanda-provider';
import { BrokerAuthError, BrokerApiError, BrokerRateLimitError } from '../types';

// Mock fetch
global.fetch = vi.fn();

describe('OandaProvider', () => {
  let provider: OandaProvider;
  const mockApiKey = 'test-api-key-12345';
  const mockAccountId = '001-004-1234567-001';

  beforeEach(() => {
    provider = new OandaProvider('practice');
    vi.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should authenticate successfully with valid credentials', async () => {
      const mockResponse = {
        accounts: [
          { id: mockAccountId, tags: [] }
        ]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map(),
      });

      const result = await provider.authenticate({
        apiKey: mockApiKey,
        apiSecret: '', // OANDA doesn't use API secret
      });

      expect(result.accessToken).toBe(mockApiKey);
      expect(result.userId).toBe(mockAccountId);
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should throw BrokerAuthError on invalid credentials', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      await expect(
        provider.authenticate({
          apiKey: 'invalid-key',
          apiSecret: '',
        })
      ).rejects.toThrow(BrokerAuthError);
    });

    it('should throw BrokerAuthError when no accounts found', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accounts: [] }),
        headers: new Map(),
      });

      await expect(
        provider.authenticate({
          apiKey: mockApiKey,
          apiSecret: '',
        })
      ).rejects.toThrow('No OANDA accounts found');
    });
  });

  describe('getAccounts', () => {
    it('should fetch accounts successfully', async () => {
      const mockAccountsResponse = {
        accounts: [
          { id: mockAccountId, tags: [] }
        ]
      };

      const mockAccountDetails = {
        account: {
          id: mockAccountId,
          alias: 'My Practice Account',
          currency: 'USD',
          balance: '100000.0000',
        },
        lastTransactionID: '12345'
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockAccountsResponse,
          headers: new Map(),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockAccountDetails,
          headers: new Map(),
        });

      const accounts = await provider.getAccounts(mockApiKey);

      expect(accounts).toHaveLength(1);
      expect(accounts[0].id).toBe(mockAccountId);
      expect(accounts[0].name).toBe('My Practice Account');
      expect(accounts[0].balance).toBe(100000);
      expect(accounts[0].currency).toBe('USD');
    });
  });

  describe('getTrades', () => {
    it('should fetch and reconstruct trades successfully', async () => {
      const mockTransactions = {
        transactions: [
          {
            id: '1',
            time: '2024-01-01T12:00:00.000000000Z',
            type: 'ORDER_FILL',
            instrument: 'EUR_USD',
            units: '10000',
            price: '1.1000',
            tradeOpened: {
              tradeID: 'trade-1',
              units: '10000',
              price: '1.1000',
            },
          },
          {
            id: '2',
            time: '2024-01-01T14:00:00.000000000Z',
            type: 'ORDER_FILL',
            instrument: 'EUR_USD',
            units: '-10000',
            price: '1.1050',
            tradesClosed: [
              {
                tradeID: 'trade-1',
                units: '-10000',
                realizedPL: '50.00',
                financing: '-0.50',
                guaranteedExecutionFee: '0.00',
                halfSpreadCost: '0.10',
              },
            ],
          },
        ],
        lastTransactionID: '2',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTransactions,
        headers: new Map(),
      });

      const trades = await provider.getTrades(mockApiKey, mockAccountId);

      expect(trades).toHaveLength(1);
      expect(trades[0].brokerTradeId).toBe('trade-1');
      expect(trades[0].symbol).toBe('EURUSD');
      expect(trades[0].direction).toBe('LONG');
      expect(trades[0].entryPrice).toBe(1.1000);
      expect(trades[0].quantity).toBe(10000);
      expect(trades[0].realizedPnl).toBe(50.00);
    });

    it('should handle SHORT trades correctly', async () => {
      const mockTransactions = {
        transactions: [
          {
            id: '1',
            time: '2024-01-01T12:00:00.000000000Z',
            type: 'ORDER_FILL',
            instrument: 'GBP_USD',
            units: '-5000',
            price: '1.2500',
            tradeOpened: {
              tradeID: 'trade-2',
              units: '-5000',
              price: '1.2500',
            },
          },
          {
            id: '2',
            time: '2024-01-01T14:00:00.000000000Z',
            type: 'ORDER_FILL',
            instrument: 'GBP_USD',
            units: '5000',
            price: '1.2450',
            tradesClosed: [
              {
                tradeID: 'trade-2',
                units: '5000',
                realizedPL: '25.00',
                financing: '-0.25',
                guaranteedExecutionFee: '0.00',
                halfSpreadCost: '0.05',
              },
            ],
          },
        ],
        lastTransactionID: '2',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTransactions,
        headers: new Map(),
      });

      const trades = await provider.getTrades(mockApiKey, mockAccountId);

      expect(trades).toHaveLength(1);
      expect(trades[0].direction).toBe('SHORT');
      expect(trades[0].symbol).toBe('GBPUSD');
    });

    it('should handle partial closes correctly', async () => {
      const mockTransactions = {
        transactions: [
          {
            id: '1',
            time: '2024-01-01T12:00:00.000000000Z',
            type: 'ORDER_FILL',
            instrument: 'EUR_USD',
            units: '10000',
            price: '1.1000',
            tradeOpened: {
              tradeID: 'trade-3',
              units: '10000',
              price: '1.1000',
            },
          },
          {
            id: '2',
            time: '2024-01-01T13:00:00.000000000Z',
            type: 'ORDER_FILL',
            instrument: 'EUR_USD',
            units: '-5000',
            price: '1.1025',
            tradeReduced: {
              tradeID: 'trade-3',
              units: '-5000',
              realizedPL: '12.50',
              financing: '-0.10',
              guaranteedExecutionFee: '0.00',
              halfSpreadCost: '0.05',
            },
          },
        ],
        lastTransactionID: '2',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTransactions,
        headers: new Map(),
      });

      const trades = await provider.getTrades(mockApiKey, mockAccountId);

      expect(trades).toHaveLength(1);
      expect(trades[0].quantity).toBe(5000); // Partial close
      expect(trades[0].metadata?.isPartialClose).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should throw BrokerRateLimitError on 429 response', async () => {
      const mockHeaders = {
        get: (key: string) => {
          if (key === 'X-RateLimit-Reset') return '1234567890';
          return null;
        },
      };
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
        headers: mockHeaders,
      });

      await expect(
        provider.authenticate({
          apiKey: mockApiKey,
          apiSecret: '',
        })
      ).rejects.toThrow(BrokerRateLimitError);
    });

    it('should throw BrokerApiError on other API errors', async () => {
      const mockHeaders = {
        get: () => null,
      };
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
        headers: mockHeaders,
      });

      await expect(
        provider.authenticate({
          apiKey: mockApiKey,
          apiSecret: '',
        })
      ).rejects.toThrow(BrokerApiError);
    });
  });

  describe('symbol normalization', () => {
    it('should normalize OANDA instrument format to standard symbols', async () => {
      const mockTransactions = {
        transactions: [
          {
            id: '1',
            time: '2024-01-01T12:00:00.000000000Z',
            type: 'ORDER_FILL',
            instrument: 'USD_JPY',
            units: '10000',
            price: '110.00',
            tradeOpened: {
              tradeID: 'trade-4',
              units: '10000',
              price: '110.00',
            },
          },
          {
            id: '2',
            time: '2024-01-01T14:00:00.000000000Z',
            type: 'ORDER_FILL',
            instrument: 'USD_JPY',
            units: '-10000',
            price: '110.50',
            tradesClosed: [
              {
                tradeID: 'trade-4',
                units: '-10000',
                realizedPL: '50.00',
                financing: '0.00',
                guaranteedExecutionFee: '0.00',
                halfSpreadCost: '0.00',
              },
            ],
          },
        ],
        lastTransactionID: '2',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTransactions,
        headers: new Map(),
      });

      const trades = await provider.getTrades(mockApiKey, mockAccountId);

      expect(trades[0].symbol).toBe('USDJPY'); // Normalized from USD_JPY
    });
  });
});
