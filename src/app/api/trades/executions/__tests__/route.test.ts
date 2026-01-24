import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { GET } from '../route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/supabase/server');
jest.mock('@/lib/prisma');

const mockCreateClient = jest.fn();
const mockPrisma = {
  trade: {
    findMany: jest.fn(),
  },
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/trades/executions', () => {
  it('should return 401 if user not authenticated', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
      },
    });

    const req = new NextRequest('http://localhost/api/trades/executions?symbol=MES&from=1706092800&to=1706179200');
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it('should return 400 if missing required params', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
    });

    const req = new NextRequest('http://localhost/api/trades/executions?symbol=MES');
    const res = await GET(req);

    expect(res.status).toBe(400);
  });

  it('should return 400 if from >= to', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
    });

    const req = new NextRequest('http://localhost/api/trades/executions?symbol=MES&from=1706179200&to=1706092800');
    const res = await GET(req);

    expect(res.status).toBe(400);
  });

  it('should return execution markers for valid request', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
    });

    mockPrisma.trade.findMany.mockResolvedValue([
      {
        id: 'trade-1',
        symbol: 'MES',
        openedAt: new Date('2024-01-24T09:00:00Z'),
        closedAt: new Date('2024-01-24T10:00:00Z'),
        entryPrice: 5435.25,
        exitPrice: 5450.50,
        quantity: 1,
        realizedPnlUsd: 150.50,
        riskRewardRatio: 2.5,
        direction: 'LONG',
      },
    ]);

    const req = new NextRequest('http://localhost/api/trades/executions?symbol=MES&from=1706092800&to=1706179200');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('ok');
    expect(json.data).toHaveLength(2);
    expect(json.data[0].side).toBe('buy');
    expect(json.data[1].side).toBe('sell');
  });

  it('should filter by tradeIds if provided', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
    });

    mockPrisma.trade.findMany.mockResolvedValue([]);

    const req = new NextRequest('http://localhost/api/trades/executions?symbol=MES&from=1706092800&to=1706179200&tradeIds=trade-1,trade-2');
    await GET(req);

    expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ['trade-1', 'trade-2'] },
        }),
      })
    );
  });

  it('should sort markers by time ascending', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
    });

    mockPrisma.trade.findMany.mockResolvedValue([
      {
        id: 'trade-1',
        symbol: 'MES',
        openedAt: new Date('2024-01-24T10:00:00Z'),
        closedAt: new Date('2024-01-24T11:00:00Z'),
        entryPrice: 5435.25,
        exitPrice: 5450.50,
        quantity: 1,
        realizedPnlUsd: 150.50,
        riskRewardRatio: 2.5,
        direction: 'LONG',
      },
      {
        id: 'trade-2',
        symbol: 'MES',
        openedAt: new Date('2024-01-24T09:00:00Z'),
        closedAt: new Date('2024-01-24T09:30:00Z'),
        entryPrice: 5420.00,
        exitPrice: 5430.00,
        quantity: 1,
        realizedPnlUsd: 100.00,
        riskRewardRatio: 2.0,
        direction: 'LONG',
      },
    ]);

    const req = new NextRequest('http://localhost/api/trades/executions?symbol=MES&from=1706092800&to=1706179200');
    const res = await GET(req);

    const json = await res.json();
    const times = json.data.map((m: any) => m.time);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });
});
