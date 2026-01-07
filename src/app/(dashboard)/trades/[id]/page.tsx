import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { TradeDetailContent } from './trade-detail-content';
import { getPlaybooksForSelection } from '@/app/actions/trades';
import { getVoiceNotes } from '@/app/actions/voice-notes';
import { serializeTrade } from '@/services/trade-service';

export const dynamic = 'force-dynamic';

interface TradeDetailPageProps {
  params: Promise<{ id: string }>;
}

async function getTrade(tradeId: string, userId: string) {
  const trade = await prisma.trade.findFirst({
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
      partialExits: {
        orderBy: { exitedAt: 'asc' },
      },
    },
  });

  if (!trade) return null;
  return serializeTrade(trade);
}

async function getBrokerConnection(accountId: string | null, userId: string) {
  if (!accountId) return null;
  
  const connection = await prisma.brokerConnection.findFirst({
    where: {
      userId,
      accountId,
      status: 'CONNECTED',
    },
    select: {
      brokerType: true,
    },
  });
  
  return connection;
}

export default async function TradeDetailPage({ params }: TradeDetailPageProps) {
  const { id } = await params;
  
  const user = await getUser();
  if (!user) {
    redirect('/login');
    return null;
  }

  const trade = await getTrade(id, user.id);
  if (!trade) {
    redirect('/trades');
    return null;
  }

  const [playbooks, voiceNotes, brokerConnection] = await Promise.all([
    getPlaybooksForSelection(),
    getVoiceNotes(id),
    getBrokerConnection(trade.accountId, user.id),
  ]);

  return (
    <TradeDetailContent 
      trade={trade} 
      playbooks={playbooks} 
      voiceNotes={voiceNotes}
      brokerConnection={brokerConnection ? {
        hasBrokerConnection: true,
        brokerType: brokerConnection.brokerType,
      } : undefined}
    />
  );
}

