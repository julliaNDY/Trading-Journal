import { Suspense } from 'react';
import { getUser } from '@/lib/auth';
import { ImportContent } from './import-content';
import { getAccountsForSelection } from '@/app/actions/accounts';
import { Loader2 } from 'lucide-react';

async function ImportData() {
  const user = await getUser();
  if (!user) return null;

  const accounts = await getAccountsForSelection();

  return <ImportContent userId={user.id} accounts={accounts} />;
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export default function ImporterPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ImportData />
    </Suspense>
  );
}
