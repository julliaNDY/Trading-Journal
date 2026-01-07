'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Download,
  User,
  ListChecks,
  Eye,
  Loader2,
  Check,
  Link as LinkIcon,
  Globe,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { importPlaybook } from '@/app/actions/playbooks';
import { useToast } from '@/hooks/use-toast';

interface PlaybookGroup {
  id: string;
  name: string;
  order: number;
  prerequisites: Array<{
    id: string;
    text: string;
    order: number;
  }>;
}

interface SharedPlaybook {
  id: string;
  name: string;
  description: string | null;
  visibility: string;
  author: {
    id: string;
    displayName: string;
  };
  groups: PlaybookGroup[];
  viewCount: number;
  importCount: number;
  createdAt: Date;
}

interface SharedPlaybookContentProps {
  playbook: SharedPlaybook;
  canImport: boolean;
  importReason?: string;
}

export function SharedPlaybookContent({
  playbook,
  canImport: initialCanImport,
  importReason,
}: SharedPlaybookContentProps) {
  const t = useTranslations('playbooks');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();

  const [isImporting, setIsImporting] = useState(false);
  const [hasImported, setHasImported] = useState(!initialCanImport && importReason === 'Already imported');

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const result = await importPlaybook(playbook.id);
      if (result.success) {
        toast({
          title: t('importSuccess'),
          description: playbook.name,
        });
        setHasImported(true);
        // Redirect to playbooks page after short delay
        setTimeout(() => router.push('/playbooks'), 1500);
      } else {
        toast({
          variant: 'destructive',
          title: t('importError'),
          description: result.error,
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: t('importError'),
      });
    } finally {
      setIsImporting(false);
    }
  };

  const totalPrerequisites = playbook.groups.reduce(
    (sum, g) => sum + g.prerequisites.length,
    0
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {tCommon('back')}
          </Button>
          <Badge variant={playbook.visibility === 'PUBLIC' ? 'default' : 'secondary'}>
            {playbook.visibility === 'PUBLIC' ? (
              <><Globe className="h-3 w-3 mr-1" />{t('visibilityPublic')}</>
            ) : (
              <><LinkIcon className="h-3 w-3 mr-1" />{t('visibilityUnlisted')}</>
            )}
          </Badge>
        </div>

        {/* Main Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">{playbook.name}</CardTitle>
                {playbook.description && (
                  <p className="text-muted-foreground mt-2">{playbook.description}</p>
                )}
                <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>{t('by')} {playbook.author.displayName}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {hasImported ? (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Check className="h-4 w-4" />
                    {t('alreadyImported')}
                  </Badge>
                ) : importReason === 'Cannot import your own playbook' ? (
                  <Badge variant="outline">{t('cannotImportOwn')}</Badge>
                ) : (
                  <Button onClick={handleImport} disabled={isImporting}>
                    {isImporting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    {t('import')}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Stats */}
            <div className="flex items-center gap-6 pb-4 border-b text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <ListChecks className="h-4 w-4" />
                {playbook.groups.length} {t('groupsCount', { count: playbook.groups.length })}
              </span>
              <span>{totalPrerequisites} {t('prerequisitesCount', { count: totalPrerequisites })}</span>
              <span className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                {playbook.viewCount} {t('views')}
              </span>
              <span className="flex items-center gap-1">
                <Download className="h-4 w-4" />
                {playbook.importCount} {t('imports')}
              </span>
            </div>

            {/* Groups */}
            <div className="mt-6 space-y-4">
              <h3 className="font-semibold">{t('groups')}</h3>
              {playbook.groups.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noGroups')}</p>
              ) : (
                <div className="space-y-4">
                  {playbook.groups.map((group) => (
                    <div key={group.id} className="rounded-lg border p-4">
                      <h4 className="font-medium mb-2">{group.name}</h4>
                      {group.prerequisites.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t('noPrerequisites')}</p>
                      ) : (
                        <ul className="space-y-1">
                          {group.prerequisites.map((prereq) => (
                            <li key={prereq.id} className="text-sm text-muted-foreground flex items-start gap-2">
                              <span className="text-primary">•</span>
                              {prereq.text}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Import CTA */}
        {!hasImported && importReason !== 'Cannot import your own playbook' && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="py-6">
              <div className="text-center space-y-4">
                <h3 className="font-semibold">{t('importConfirm')}</h3>
                <p className="text-sm text-muted-foreground">{t('importConfirmDesc')}</p>
                <Button onClick={handleImport} disabled={isImporting} size="lg">
                  {isImporting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  {t('importPlaybook')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

