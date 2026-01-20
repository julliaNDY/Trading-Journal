import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { getVotingOptions } from '@/app/actions/voting';
import { BetaContent } from './beta-content';

export const dynamic = 'force-dynamic';

export default async function BetaPage() {
  const user = await getUser();
  if (!user) {
    redirect('/login');
    return null;
  }

  const votingResult = await getVotingOptions();
  const options = votingResult.success ? votingResult.options : [];

  return <BetaContent options={options} />;
}
