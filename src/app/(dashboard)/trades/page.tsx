import { requireAuth } from '@/lib/auth';
import { getAllTrades, getPlaybooksForSelection } from '@/app/actions/trades';
import { TradesContent } from './trades-content';

export default async function TradesPage() {
  const user = await requireAuth();
  const [trades, playbooks] = await Promise.all([
    getAllTrades(),
    getPlaybooksForSelection(),
  ]);

  return <TradesContent trades={trades} playbooks={playbooks} />;
}

