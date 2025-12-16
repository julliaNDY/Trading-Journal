import { Suspense } from 'react';
import { getUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { JournalContent } from './journal-content';
import { Loader2 } from 'lucide-react';

async function JournalData() {
  const user = await getUser();
  if (!user) return null;

  // Get all tags for the user
  const tags = await prisma.tag.findMany({
    where: { userId: user.id },
    orderBy: { name: 'asc' },
  });

  return <JournalContent userId={user.id} tags={tags} />;
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






