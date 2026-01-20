import { requireAuth } from '@/lib/auth';
import { AccountsContentV2 } from './accounts-content-v2';

export const dynamic = 'force-dynamic';

export default async function AccountsPage() {
  await requireAuth();

  return <AccountsContentV2 />;
}






