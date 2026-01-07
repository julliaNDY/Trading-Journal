'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  Search,
  Loader2,
  Compass,
  ArrowLeft,
  Download,
  Eye,
  User,
  ListChecks,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  getPublicPlaybooks,
  importPlaybook,
  canImportPlaybook,
  type PublicPlaybook,
} from '@/app/actions/playbooks';
import { useToast } from '@/hooks/use-toast';

export function DiscoverContent() {
  const t = useTranslations('playbooks');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();

  // State
  const [playbooks, setPlaybooks] = useState<PublicPlaybook[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(12);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'imports'>('recent');
  
  // Import dialog state
  const [importingPlaybook, setImportingPlaybook] = useState<PublicPlaybook | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<Map<string, 'imported' | 'own'>>(new Map());

  // Fetch playbooks
  const fetchPlaybooks = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getPublicPlaybooks({
        search: search || undefined,
        page,
        limit,
        sortBy,
      });
      setPlaybooks(result.playbooks);
      setTotal(result.total);
      setHasMore(result.hasMore);

      // Check import status for each playbook
      const statusMap = new Map<string, 'imported' | 'own'>();
      for (const pb of result.playbooks) {
        const canImport = await canImportPlaybook(pb.id);
        if (!canImport.canImport) {
          if (canImport.reason === 'Already imported') {
            statusMap.set(pb.id, 'imported');
          } else if (canImport.reason === 'Cannot import your own playbook') {
            statusMap.set(pb.id, 'own');
          }
        }
      }
      setImportStatus(statusMap);
    } catch (error) {
      console.error('Error fetching playbooks:', error);
    } finally {
      setIsLoading(false);
    }
  }, [search, page, limit, sortBy]);

  useEffect(() => {
    fetchPlaybooks();
  }, [fetchPlaybooks]);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchPlaybooks();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Handle import
  const handleImport = async () => {
    if (!importingPlaybook) return;
    setIsImporting(true);
    try {
      const result = await importPlaybook(importingPlaybook.id);
      if (result.success) {
        toast({
          title: t('importSuccess'),
          description: importingPlaybook.name,
        });
        setImportStatus(prev => new Map(prev).set(importingPlaybook.id, 'imported'));
        setImportingPlaybook(null);
      } else {
        toast({
          variant: 'destructive',
          title: t('importError'),
          description: result.error,
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('importError'),
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/playbooks')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Compass className="h-8 w-8 text-primary" />
              {t('discoverTitle')}
            </h1>
            <p className="text-muted-foreground">{t('discoverSubtitle')}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">{t('sortByRecent')}</SelectItem>
            <SelectItem value="popular">{t('sortByPopular')}</SelectItem>
            <SelectItem value="imports">{t('sortByImports')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : playbooks.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <ListChecks className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">{t('noPublicPlaybooks')}</h3>
              <p className="text-muted-foreground mb-4">{t('noPublicPlaybooksDesc')}</p>
              <Button variant="outline" onClick={() => router.push('/playbooks')}>
                {t('backToDiscover')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {playbooks.map((playbook) => (
              <PlaybookCard
                key={playbook.id}
                playbook={playbook}
                status={importStatus.get(playbook.id)}
                onImport={() => setImportingPlaybook(playbook)}
              />
            ))}
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                {(page - 1) * limit + 1} - {Math.min(page * limit, total)} / {total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={!hasMore}
                  onClick={() => setPage(p => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Import Dialog */}
      <Dialog open={!!importingPlaybook} onOpenChange={() => setImportingPlaybook(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('importPlaybook')}</DialogTitle>
            <DialogDescription>
              {t('importConfirmDesc')}
            </DialogDescription>
          </DialogHeader>
          {importingPlaybook && (
            <div className="py-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{importingPlaybook.name}</CardTitle>
                  {importingPlaybook.description && (
                    <p className="text-sm text-muted-foreground">{importingPlaybook.description}</p>
                  )}
                </CardHeader>
                <CardContent className="pb-2">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{t('by')} {importingPlaybook.author.displayName}</span>
                    <span>{importingPlaybook.groupsCount} groupe(s)</span>
                    <span>{importingPlaybook.prerequisitesCount} prérequis</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportingPlaybook(null)} disabled={isImporting}>
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleImport} disabled={isImporting}>
              {isImporting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('import')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlaybookCard({
  playbook,
  status,
  onImport,
}: {
  playbook: PublicPlaybook;
  status?: 'imported' | 'own';
  onImport: () => void;
}) {
  const t = useTranslations('playbooks');

  return (
    <Card className="flex flex-col hover:border-primary/50 transition-colors">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg line-clamp-1">{playbook.name}</CardTitle>
        {playbook.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{playbook.description}</p>
        )}
      </CardHeader>
      <CardContent className="flex-1 pb-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User className="h-4 w-4" />
          <span>{playbook.author.displayName}</span>
        </div>
        <div className="flex items-center gap-3 mt-2 text-sm">
          <Badge variant="secondary">
            {playbook.groupsCount} groupe(s)
          </Badge>
          <Badge variant="outline">
            {playbook.prerequisitesCount} prérequis
          </Badge>
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between pt-2 border-t">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {playbook.importCount}
          </span>
        </div>
        {status === 'imported' ? (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Check className="h-3 w-3" />
            {t('alreadyImported')}
          </Badge>
        ) : status === 'own' ? (
          <Badge variant="outline">{t('cannotImportOwn')}</Badge>
        ) : (
          <Button size="sm" onClick={onImport}>
            <Download className="h-4 w-4 mr-1" />
            {t('import')}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

