import { Suspense } from 'react';
import { getUser } from '@/lib/auth';
import { getTrades, getUniqueSymbols } from '@/services/trade-service';
import prisma from '@/lib/prisma';
import { StatisticsContent } from './statistics-content';
import { Loader2 } from 'lucide-react';

async function StatisticsData() {
  const user = await getUser();
  if (!user) return null;

  const [trades, symbols, tags, accounts] = await Promise.all([
    getTrades({ userId: user.id }),
    getUniqueSymbols(user.id),
    prisma.tag.findMany({
      where: { userId: user.id },
      orderBy: { name: 'asc' },
    }),
    prisma.account.findMany({
      where: { userId: user.id },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, color: true },
    }),
  ]);

  return (
    <StatisticsContent
      initialTrades={trades}
      symbols={symbols}
      tags={tags}
      accounts={accounts}
    />
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export default function StatistiquesPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <StatisticsData />
    </Suspense>
  );
}






