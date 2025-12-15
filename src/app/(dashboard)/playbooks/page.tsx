import { requireAuth } from '@/lib/auth';
import { getPlaybooks } from '@/app/actions/playbooks';
import { PlaybooksContent } from './playbooks-content';

export default async function PlaybooksPage() {
  const user = await requireAuth();
  const playbooks = await getPlaybooks();

  return <PlaybooksContent playbooks={playbooks} />;
}

