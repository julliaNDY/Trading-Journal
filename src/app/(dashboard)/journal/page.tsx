import { Suspense } from 'react';
import { getUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getUniqueSymbols } from '@/services/trade-service';
import { JournalContent } from './journal-content';
import { Loader2 } from 'lucide-react';

async function JournalData() {
  const user = await getUser();
  if (!user) return null;

  // Get all tags, accounts, and symbols for the user
  const [tags, accounts, symbols] = await Promise.all([
    prisma.tag.findMany({
      where: { userId: user.id },
      orderBy: { name: 'asc' },
    }),
    prisma.account.findMany({
      where: { userId: user.id },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, color: true },
    }),
    getUniqueSymbols(user.id),
  ]);

  return <JournalContent userId={user.id} tags={tags} accounts={accounts} symbols={symbols} />;
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export default function JournalPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <JournalData />
    </Suspense>
  );
}






