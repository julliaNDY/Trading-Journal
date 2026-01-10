import { Suspense } from 'react';
import { getUser } from '@/lib/auth';
import { getTrades, getUniqueSymbols, serializeTrades } from '@/services/trade-service';
import { getPlaybooksForSelection } from '@/app/actions/trades';
import prisma from '@/lib/prisma';
import { StatisticsContent } from './statistics-content';
import { Loader2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

async function StatisticsData() {
  const user = await getUser();
  if (!user) return null;

  const [trades, symbols, tags, accounts, playbooks] = await Promise.all([
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
    getPlaybooksForSelection(),
  ]);

  const serializedTrades = serializeTrades(trades);

  return (
    <StatisticsContent
      initialTrades={serializedTrades}
      symbols={symbols}
      tags={tags}
      accounts={accounts}
      playbooks={playbooks}
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






