import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { TradeDetailContent } from './trade-detail-content';
import { getPlaybooksForSelection } from '@/app/actions/trades';

interface TradeDetailPageProps {
  params: { id: string };
}

async function getTrade(tradeId: string, userId: string) {
  return prisma.trade.findFirst({
    where: { id: tradeId, userId },
    include: {
      account: {
        select: { id: true, name: true, color: true },
      },
      tags: {
        include: {
          tag: { select: { id: true, name: true, color: true } },
        },
      },
      screenshots: {
        select: { id: true, filePath: true, originalName: true },
        orderBy: { createdAt: 'asc' },
      },
      tradePlaybooks: {
        include: {
          playbook: { select: { id: true, name: true } },
          checkedPrerequisites: true,
        },
      },
    },
  });
}

export default async function TradeDetailPage({ params }: TradeDetailPageProps) {
  const user = await getUser();
  if (!user) {
    redirect('/login');
    return null;
  }

  const trade = await getTrade(params.id, user.id);
  if (!trade) {
    redirect('/trades');
    return null;
  }

  const playbooks = await getPlaybooksForSelection();

  return <TradeDetailContent trade={trade} playbooks={playbooks} />;
}

