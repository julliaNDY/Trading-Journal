import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { ExecutionMarker } from '@/lib/types/execution';
import { buildExecutionTooltip } from '@/components/charts/utils/execution-markers';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get('symbol');
    const fromStr = searchParams.get('from');
    const toStr = searchParams.get('to');
    const tradeIdsStr = searchParams.get('tradeIds');

    if (!symbol || !fromStr || !toStr) {
      return NextResponse.json(
        { error: 'Missing required params: symbol, from, to' },
        { status: 400 }
      );
    }

    const from = parseInt(fromStr, 10);
    const to = parseInt(toStr, 10);

    if (isNaN(from) || isNaN(to) || from >= to) {
      return NextResponse.json(
        { error: 'Invalid time range: from must be < to' },
        { status: 400 }
      );
    }

    const fromDate = new Date(from * 1000);
    const toDate = new Date(to * 1000);

    const where: any = {
      userId: user.id,
      symbol: {
        equals: symbol.toUpperCase(),
        mode: 'insensitive',
      },
      closedAt: {
        gte: fromDate,
        lte: toDate,
      },
    };

    if (tradeIdsStr) {
      const tradeIds = tradeIdsStr.split(',').filter(Boolean);
      if (tradeIds.length > 0) {
        where.id = { in: tradeIds };
      }
    }

    const trades = await prisma.trade.findMany({
      where,
      select: {
        id: true,
        symbol: true,
        openedAt: true,
        closedAt: true,
        entryPrice: true,
        exitPrice: true,
        quantity: true,
        realizedPnlUsd: true,
        riskRewardRatio: true,
        direction: true,
      },
      orderBy: {
        closedAt: 'asc',
      },
    });

    const markers: ExecutionMarker[] = [];

    for (const trade of trades) {
      const entryMarker: ExecutionMarker = {
        id: `${trade.id}-entry`,
        symbol: trade.symbol,
        time: Math.floor(trade.openedAt.getTime() / 1000),
        price: parseFloat(trade.entryPrice.toString()),
        side: 'buy',
        qty: parseFloat(trade.quantity.toString()),
        pnlUsd: undefined,
        riskRewardRatio: trade.riskRewardRatio
          ? parseFloat(trade.riskRewardRatio.toString())
          : undefined,
        text: 'Entry',
      };
      entryMarker.tooltip = buildExecutionTooltip(entryMarker);
      markers.push(entryMarker);

      const exitMarker: ExecutionMarker = {
        id: `${trade.id}-exit`,
        symbol: trade.symbol,
        time: Math.floor(trade.closedAt.getTime() / 1000),
        price: parseFloat(trade.exitPrice.toString()),
        side: 'sell',
        qty: parseFloat(trade.quantity.toString()),
        entryPrice: parseFloat(trade.entryPrice.toString()),
        exitPrice: parseFloat(trade.exitPrice.toString()),
        pnlUsd: parseFloat(trade.realizedPnlUsd.toString()),
        riskRewardRatio: trade.riskRewardRatio
          ? parseFloat(trade.riskRewardRatio.toString())
          : undefined,
        text: 'Exit',
      };
      exitMarker.tooltip = buildExecutionTooltip(exitMarker);
      markers.push(exitMarker);
    }

    markers.sort((a, b) => a.time - b.time);

    return NextResponse.json({ status: 'ok', data: markers });
  } catch (error) {
    console.error('Executions API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
