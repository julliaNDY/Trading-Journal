/**
 * Tests for /api/brokers endpoint
 * Story 3.8: Broker Database API
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { IntegrationStatus, BrokerAssetType } from '@prisma/client';

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    broker: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('@/lib/cache', () => ({
  getOrSetCache: vi.fn(async (_key, fetcher) => {
    // Bypass cache in tests - just call fetcher
    return await fetcher();
  }),
}));

vi.mock('@/lib/observability', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('GET /api/brokers', () => {
  const mockBrokers = [
    {
      id: '1',
      name: 'tradovate',
      displayName: 'Tradovate',
      country: 'US',
      region: 'North America',
      integrationStatus: IntegrationStatus.API,
      supportedAssets: [BrokerAssetType.FUTURES],
      logoUrl: null,
      websiteUrl: 'https://tradovate.com',
      apiDocumentationUrl: 'https://api.tradovate.com',
      csvTemplateUrl: null,
      description: 'Futures trading platform',
      isActive: true,
      priority: 10,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '2',
      name: 'interactive-brokers',
      displayName: 'Interactive Brokers',
      country: 'US',
      region: 'North America',
      integrationStatus: IntegrationStatus.API,
      supportedAssets: [BrokerAssetType.MULTI_ASSET],
      logoUrl: null,
      websiteUrl: 'https://interactivebrokers.com',
      apiDocumentationUrl: 'https://ibkr.com/api',
      csvTemplateUrl: null,
      description: 'Multi-asset broker',
      isActive: true,
      priority: 9,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return paginated brokers with default parameters', async () => {
    vi.mocked(prisma.broker.findMany).mockResolvedValue(mockBrokers);
    vi.mocked(prisma.broker.count).mockResolvedValue(2);

    const request = new NextRequest('http://localhost:3000/api/brokers');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(2);
    expect(data.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    });
  });

  it('should filter by country', async () => {
    vi.mocked(prisma.broker.findMany).mockResolvedValue([mockBrokers[0]]);
    vi.mocked(prisma.broker.count).mockResolvedValue(1);

    const request = new NextRequest('http://localhost:3000/api/brokers?country=US');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(1);
    expect(prisma.broker.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ country: 'US' }),
      })
    );
  });

  it('should filter by integrationStatus', async () => {
    vi.mocked(prisma.broker.findMany).mockResolvedValue(mockBrokers);
    vi.mocked(prisma.broker.count).mockResolvedValue(2);

    const request = new NextRequest(
      'http://localhost:3000/api/brokers?integrationStatus=API'
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(prisma.broker.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ integrationStatus: IntegrationStatus.API }),
      })
    );
  });

  it('should search by name', async () => {
    vi.mocked(prisma.broker.findMany).mockResolvedValue([mockBrokers[0]]);
    vi.mocked(prisma.broker.count).mockResolvedValue(1);

    const request = new NextRequest('http://localhost:3000/api/brokers?search=tradovate');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(prisma.broker.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { name: { contains: 'tradovate', mode: 'insensitive' } },
            { displayName: { contains: 'tradovate', mode: 'insensitive' } },
            { description: { contains: 'tradovate', mode: 'insensitive' } },
          ]),
        }),
      })
    );
  });

  it('should handle pagination correctly', async () => {
    vi.mocked(prisma.broker.findMany).mockResolvedValue([mockBrokers[1]]);
    vi.mocked(prisma.broker.count).mockResolvedValue(50);

    const request = new NextRequest('http://localhost:3000/api/brokers?page=2&limit=10');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 50,
      totalPages: 5,
      hasNextPage: true,
      hasPrevPage: true,
    });
    expect(prisma.broker.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10, // (page 2 - 1) * limit 10
        take: 10,
      })
    );
  });

  it('should filter by assetType', async () => {
    vi.mocked(prisma.broker.findMany).mockResolvedValue([mockBrokers[0]]);
    vi.mocked(prisma.broker.count).mockResolvedValue(1);

    const request = new NextRequest(
      'http://localhost:3000/api/brokers?assetType=FUTURES'
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(prisma.broker.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          supportedAssets: { has: BrokerAssetType.FUTURES },
        }),
      })
    );
  });

  it('should filter by isActive', async () => {
    vi.mocked(prisma.broker.findMany).mockResolvedValue(mockBrokers);
    vi.mocked(prisma.broker.count).mockResolvedValue(2);

    const request = new NextRequest('http://localhost:3000/api/brokers?isActive=true');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(prisma.broker.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      })
    );
  });

  it('should combine multiple filters', async () => {
    vi.mocked(prisma.broker.findMany).mockResolvedValue([mockBrokers[0]]);
    vi.mocked(prisma.broker.count).mockResolvedValue(1);

    const request = new NextRequest(
      'http://localhost:3000/api/brokers?country=US&integrationStatus=API&isActive=true'
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(prisma.broker.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          country: 'US',
          integrationStatus: IntegrationStatus.API,
          isActive: true,
        }),
      })
    );
  });

  it('should return 400 for invalid query parameters', async () => {
    const request = new NextRequest('http://localhost:3000/api/brokers?page=-1');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid query parameters');
  });

  it('should return 400 for invalid integrationStatus', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/brokers?integrationStatus=INVALID'
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid query parameters');
  });

  it('should enforce max limit of 100', async () => {
    vi.mocked(prisma.broker.findMany).mockResolvedValue([]);
    vi.mocked(prisma.broker.count).mockResolvedValue(0);

    const request = new NextRequest('http://localhost:3000/api/brokers?limit=150');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('should order by priority desc then name asc', async () => {
    vi.mocked(prisma.broker.findMany).mockResolvedValue(mockBrokers);
    vi.mocked(prisma.broker.count).mockResolvedValue(2);

    const request = new NextRequest('http://localhost:3000/api/brokers');
    await GET(request);

    expect(prisma.broker.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ priority: 'desc' }, { name: 'asc' }],
      })
    );
  });

  it('should handle database errors gracefully', async () => {
    vi.mocked(prisma.broker.findMany).mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost:3000/api/brokers');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Failed to fetch brokers');
  });
});
