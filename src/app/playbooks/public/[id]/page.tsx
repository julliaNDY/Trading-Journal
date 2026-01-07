import { notFound } from 'next/navigation';
import { getPublicPlaybook, canImportPlaybook } from '@/app/actions/playbooks';
import { SharedPlaybookContent } from '../../shared/[token]/shared-playbook-content';

export const dynamic = 'force-dynamic';

export default async function PublicPlaybookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const playbook = await getPublicPlaybook(id);

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

