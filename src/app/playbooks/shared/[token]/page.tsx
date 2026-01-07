import { notFound } from 'next/navigation';
import { getPlaybookByShareToken, canImportPlaybook } from '@/app/actions/playbooks';
import { SharedPlaybookContent } from './shared-playbook-content';

export const dynamic = 'force-dynamic';

export default async function SharedPlaybookPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const playbook = await getPlaybookByShareToken(token);

  if (!playbook) {
    notFound();
  }

  const importCheck = await canImportPlaybook(playbook.id);

  return (
    <SharedPlaybookContent 
      playbook={playbook} 
      canImport={importCheck.canImport}
      importReason={importCheck.reason}
    />
  );
}

