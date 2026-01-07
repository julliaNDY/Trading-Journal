import { getTranslations } from 'next-intl/server';
import { BrokersContent } from './brokers-content';
import { getUserBrokerConnections } from '@/app/actions/broker';
import prisma from '@/lib/prisma';
import { getUser } from '@/lib/auth';

// Force dynamic rendering (required for next-intl in server components)
export const dynamic = 'force-dynamic';

export default async function BrokersPage() {
  const t = await getTranslations('brokers');
  const user = await getUser();
  
  if (!user) {
    return null;
  }
  
  const [connections, accounts] = await Promise.all([
    getUserBrokerConnections(),
    prisma.account.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, color: true },
      orderBy: { name: 'asc' },
    }),
  ]);
  
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>
      
      <BrokersContent 
        initialConnections={connections} 
        accounts={accounts}
      />
    </div>
  );
}

