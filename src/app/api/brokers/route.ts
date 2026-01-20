/**
 * Brokers API Endpoint
 * Story 3.8: GET /api/brokers - List brokers with filters and pagination
 *
 * Features:
 * - Filtering by country, region, integrationStatus, assetType, isActive
 * - Full-text search on name, displayName, description
 * - Pagination with metadata
 * - Redis caching (5 minutes TTL)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BrokerAssetType, IntegrationStatus } from '@prisma/client';
import { z } from 'zod';
import { getOrSetCache } from '@/lib/cache';
import { logger } from '@/lib/observability';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  country: z.string().optional(),
  region: z.string().optional(),
  integrationStatus: z.nativeEnum(IntegrationStatus).optional(),
  assetType: z.nativeEnum(BrokerAssetType).optional(),
  isActive: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
});

type QueryParams = z.infer<typeof querySchema>;

/**
 * Generate cache key from query parameters
 */
function generateCacheKey(params: QueryParams): string {
  const parts = [
    'brokers',
    `page:${params.page}`,
    `limit:${params.limit}`,
  ];

  if (params.search) parts.push(`search:${params.search}`);
  if (params.country) parts.push(`country:${params.country}`);
  if (params.region) parts.push(`region:${params.region}`);
  if (params.integrationStatus) parts.push(`status:${params.integrationStatus}`);
  if (params.assetType) parts.push(`asset:${params.assetType}`);
  if (params.isActive !== undefined) parts.push(`active:${params.isActive}`);

  return parts.join(':');
}

/**
 * Build Prisma where clause from query parameters
 */
function buildWhereClause(params: QueryParams) {
  const where: any = {};

  if (params.search) {
    where.OR = [
      { name: { contains: params.search, mode: 'insensitive' } },
      { displayName: { contains: params.search, mode: 'insensitive' } },
      { description: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  if (params.country) {
    where.country = params.country;
  }

  if (params.region) {
    where.region = params.region;
  }

  if (params.integrationStatus) {
    where.integrationStatus = params.integrationStatus;
  }

  if (params.assetType) {
    where.supportedAssets = {
      has: params.assetType,
    };
  }

  if (params.isActive !== undefined) {
    where.isActive = params.isActive;
  }

  return where;
}

/**
 * Fetch brokers from database
 */
async function fetchBrokers(params: QueryParams) {
  const where = buildWhereClause(params);
  const skip = (params.page - 1) * params.limit;

  // Execute queries in parallel
  const [brokers, total] = await Promise.all([
    prisma.broker.findMany({
      where,
      skip,
      take: params.limit,
      orderBy: [{ priority: 'desc' }, { name: 'asc' }],
    }),
    prisma.broker.count({ where }),
  ]);

  // Calculate pagination metadata
  const totalPages = Math.ceil(total / params.limit);
  const hasNextPage = params.page < totalPages;
  const hasPrevPage = params.page > 1;

  return {
    brokers,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages,
      hasNextPage,
      hasPrevPage,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse and validate query parameters
    const params = querySchema.parse({
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
      search: searchParams.get('search') || undefined,
      country: searchParams.get('country') || undefined,
      region: searchParams.get('region') || undefined,
      integrationStatus: searchParams.get('integrationStatus') || undefined,
      assetType: searchParams.get('assetType') || undefined,
      isActive: searchParams.get('isActive') || undefined,
    });

    // Generate cache key
    const cacheKey = generateCacheKey(params);

    // Try to get from cache, or fetch from database
    const result = await getOrSetCache(
      cacheKey,
      () => fetchBrokers(params),
      { ttl: 300 } // 5 minutes cache
    );

    logger.info('Brokers fetched', {
      params,
      total: result.pagination.total,
      cached: true, // getOrSetCache handles cache hit/miss internally
    });

    return NextResponse.json({
      success: true,
      data: result.brokers,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('Error fetching brokers', { error });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch brokers',
      },
      { status: 500 }
    );
  }
}
