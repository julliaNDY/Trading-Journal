import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const search = searchParams.get('search') || '';
    const broker = searchParams.get('broker') || '';

    // Validate pagination params
    const validPage = Math.max(1, page);
    const validLimit = Math.min(Math.max(1, limit), 100); // Max 100 per page
    const skip = (validPage - 1) * validLimit;

    // Build where clause
    const where: any = {
      userId: user.id,
      name: {
        not: {
          startsWith: '[HIDDEN]',
        },
      },
    };

    // Add search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { broker: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Add broker filter
    if (broker) {
      where.broker = { equals: broker, mode: 'insensitive' };
    }

    // Execute queries in parallel
    const [accounts, totalCount] = await Promise.all([
      prisma.account.findMany({
        where,
        include: {
          _count: {
            select: { trades: true },
          },
          trades: {
            select: {
              realizedPnlUsd: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: validLimit,
      }),
      prisma.account.count({ where }),
    ]);

    // Transform accounts with stats
    const accountsWithStats = accounts.map((account) => {
      const totalPnl = account.trades.reduce(
        (sum, t) => sum + Number(t.realizedPnlUsd),
        0
      );
      const initialBalance = account.initialBalance
        ? Number(account.initialBalance)
        : null;
      const currentBalance =
        initialBalance !== null ? initialBalance + totalPnl : null;
      const roi =
        initialBalance !== null && initialBalance > 0
          ? (totalPnl / initialBalance) * 100
          : null;

      return {
        id: account.id,
        name: account.name,
        broker: account.broker,
        description: account.description,
        color: account.color,
        initialBalance,
        currentBalance,
        tradesCount: account._count.trades,
        totalPnl,
        roi,
      };
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / validLimit);
    const hasNextPage = validPage < totalPages;
    const hasPreviousPage = validPage > 1;

    return NextResponse.json({
      accounts: accountsWithStats,
      pagination: {
        page: validPage,
        limit: validLimit,
        totalCount,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
    });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
