import { requireAuth } from '@/lib/auth';
import { getAllTrades, getPlaybooksForSelection } from '@/app/actions/trades';
import { getUniqueSymbols } from '@/services/trade-service';
import prisma from '@/lib/prisma';
import { TradesContent } from './trades-content';

export const dynamic = 'force-dynamic';

export default async function TradesPage() {
  const user = await requireAuth();
  const [trades, playbooks, symbols, accounts] = await Promise.all([
    getAllTrades(),
    getPlaybooksForSelection(),
    getUniqueSymbols(user.id),
    prisma.account.findMany({
      where: { userId: user.id },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, color: true },
    }),
  ]);

  return <TradesContent trades={trades} playbooks={playbooks} symbols={symbols} accounts={accounts} />;
}






