import { requireAuth } from '@/lib/auth';
import { getAccounts } from '@/app/actions/accounts';
import { AccountsContent } from './accounts-content';

export default async function AccountsPage() {
  const user = await requireAuth();
  const accounts = await getAccounts();

  return <AccountsContent accounts={accounts} />;
}

