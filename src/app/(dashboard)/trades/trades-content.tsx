'use client';

import { useState, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search,
  Edit2,
  Trash2,
  FileText,
  Image as ImageIcon,
  Clock,
  Loader2,
  X,
  Upload,
  ListChecks,
  Video,
  Star,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn, formatCurrency, formatDurationWithSeconds, getDurationSeconds } from '@/lib/utils';
import { ImageLightbox, ImageThumbnail } from '@/components/ui/image-lightbox';
import {
  updateTradeStopLoss,
  updateTradeTimes,
  updateTradeNote,
  updateTradeYoutubeUrl,
  deleteTrade,
  deleteTrades,
  deleteAllTrades,
  uploadTradeScreenshot,
  deleteScreenshot,
} from '@/app/actions/journal';
import {
  assignPlaybookToTrade,
  removePlaybookFromTrade,
} from '@/app/actions/playbooks';
import type { Trade } from '@prisma/client';

interface TradeWithRelations extends Trade {
  tags: { tag: { id: string; name: string; color: string } }[];
  screenshots: { id: string; filePath: string; originalName: string }[];
  tradePlaybooks: {
    playbook: { id: string; name: string };
    checkedPrerequisites: { prerequisiteId: string; checked: boolean }[];
  }[];
  timesManuallySet: boolean;
}

interface Prerequisite {
  id: string;
  text: string;
}

interface PlaybookGroup {
  id: string;
  name: string;
  prerequisites: Prerequisite[];
}

interface PlaybookForSelection {
  id: string;
  name: string;
  groups: PlaybookGroup[];
}

interface TradesContentProps {
  trades: TradeWithRelations[];
  playbooks: PlaybookForSelection[];
}

export function TradesContent({ trades: initialTrades, playbooks }: TradesContentProps) {
  const t = useTranslations('trades');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();

  const [trades, setTrades] = useState(initialTrades);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'pnl' | 'symbol'>('date');
  const [filterPlaybook, setFilterPlaybook] = useState(searchParams.get('playbook') || '');
  const [selectedTrades, setSelectedTrades] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Double confirmation states
  const [showDeleteSelectedDialog, setShowDeleteSelectedDialog] = useState(false);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [confirmDeleteSelected, setConfirmDeleteSelected] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  // Filter and sort trades
  const filteredTrades = useMemo(() => {
    let result = [...trades];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.symbol.toLowerCase().includes(query) ||
          t.note?.toLowerCase().includes(query)
      );
    }

    // Playbook filter
    if (filterPlaybook && filterPlaybook !== '__all__') {
      result = result.filter((t) =>
        t.tradePlaybooks.some((tp) => tp.playbook.id === filterPlaybook)
      );
    }

    // Sort
    switch (sortBy) {
      case 'date':
        result.sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime());
        break;
      case 'pnl':
        result.sort((a, b) => Number(b.realizedPnlUsd) - Number(a.realizedPnlUsd));
        break;
      case 'symbol':
        result.sort((a, b) => a.symbol.localeCompare(b.symbol));
        break;
    }

    return result;
  }, [trades, searchQuery, filterPlaybook, sortBy]);

  const handleSelectTrade = (tradeId: string, checked: boolean) => {
    const newSelected = new Set(selectedTrades);
    if (checked) {
      newSelected.add(tradeId);
    } else {
      newSelected.delete(tradeId);
    }
    setSelectedTrades(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedTrades.size === filteredTrades.length) {
      setSelectedTrades(new Set());
    } else {
      setSelectedTrades(new Set(filteredTrades.map(t => t.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedTrades.size === 0) return;
    setIsDeleting(true);
    try {
      await deleteTrades(Array.from(selectedTrades));
      setTrades(trades.filter(t => !selectedTrades.has(t.id)));
      setSelectedTrades(new Set());
      setShowDeleteSelectedDialog(false);
      setConfirmDeleteSelected(false);
      router.refresh();
    } catch (error) {
      console.error('Error deleting trades:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAll = async () => {
    setIsDeleting(true);
    try {
      await deleteAllTrades();
      setTrades([]);
      setSelectedTrades(new Set());
      setShowDeleteAllDialog(false);
      setConfirmDeleteAll(false);
      router.refresh();
    } catch (error) {
      console.error('Error deleting all trades:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const resetDeleteSelectedDialog = () => {
    setShowDeleteSelectedDialog(false);
    setConfirmDeleteSelected(false);
  };

  const resetDeleteAllDialog = () => {
    setShowDeleteAllDialog(false);
    setConfirmDeleteAll(false);
  };

  const handleDeleteTrade = async (tradeId: string) => {
    try {
      await deleteTrade(tradeId);
      setTrades(trades.filter(t => t.id !== tradeId));
      router.refresh();
    } catch (error) {
      console.error('Error deleting trade:', error);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        
        {/* Delete actions */}
        {trades.length > 0 && (
          <div className="flex items-center gap-2">
            {selectedTrades.size > 0 && (
              <Button 
                variant="destructive" 
                size="sm" 
                disabled={isDeleting}
                onClick={() => setShowDeleteSelectedDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {tCommon('deleteSelected')} ({selectedTrades.size})
              </Button>
            )}
            
            <Button 
              variant="outline" 
              size="sm" 
              disabled={isDeleting}
              onClick={() => setShowDeleteAllDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {tCommon('deleteAll')}
            </Button>
          </div>
        )}
      </div>

      {/* Delete Selected Dialog - Double confirmation */}
      <AlertDialog open={showDeleteSelectedDialog} onOpenChange={resetDeleteSelectedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tCommon('confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>{t('deleteSelectedConfirm', { count: selectedTrades.size })}</p>
              <div className="flex items-center gap-2 pt-2">
                <Checkbox 
                  id="confirm-delete-selected"
                  checked={confirmDeleteSelected}
                  onCheckedChange={(checked) => setConfirmDeleteSelected(checked === true)}
                />
                <label 
                  htmlFor="confirm-delete-selected" 
                  className="text-sm font-medium text-foreground cursor-pointer"
                >
                  {t('confirmCheckbox')}
                </label>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteSelected}
              disabled={!confirmDeleteSelected || isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Dialog - Double confirmation */}
      <AlertDialog open={showDeleteAllDialog} onOpenChange={resetDeleteAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tCommon('confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>{t('deleteAllConfirm')}</p>
              <div className="flex items-center gap-2 pt-2">
                <Checkbox 
                  id="confirm-delete-all"
                  checked={confirmDeleteAll}
                  onCheckedChange={(checked) => setConfirmDeleteAll(checked === true)}
                />
                <label 
                  htmlFor="confirm-delete-all" 
                  className="text-sm font-medium text-foreground cursor-pointer"
                >
                  {t('confirmCheckbox')}
                </label>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteAll}
              disabled={!confirmDeleteAll || isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={tCommon('search')}
                  className="pl-9"
                />
              </div>
            </div>

            <Select value={filterPlaybook} onValueChange={setFilterPlaybook}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={t('filterByPlaybook')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{tCommon('all')}</SelectItem>
                {playbooks.map((pb) => (
                  <SelectItem key={pb.id} value={pb.id}>
                    {pb.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder={t('sortBy')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">{t('sortByDate')}</SelectItem>
                <SelectItem value="pnl">{t('sortByPnl')}</SelectItem>
                <SelectItem value="symbol">{t('sortBySymbol')}</SelectItem>
              </SelectContent>
            </Select>
            
            {filteredTrades.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                {selectedTrades.size === filteredTrades.length ? tCommon('deselectAll') : tCommon('selectAll')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Trades List */}
      {filteredTrades.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">{t('noTrades')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTrades.map((trade) => (
            <TradeRow 
              key={trade.id} 
              trade={trade} 
              playbooks={playbooks}
              isSelected={selectedTrades.has(trade.id)}
              onSelect={(checked) => handleSelectTrade(trade.id, checked)}
              onDelete={() => handleDeleteTrade(trade.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TradeRow({
  trade,
  playbooks,
  isSelected,
  onSelect,
  onDelete,
}: {
  trade: TradeWithRelations;
  playbooks: PlaybookForSelection[];
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
  onDelete: () => void;
}) {
  const t = useTranslations('trades');
  const tTrade = useTranslations('trade');
  const tJournal = useTranslations('journal');
  const tPlaybooks = useTranslations('playbooks');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const locale = useLocale();

  const [isEditingTrade, setIsEditingTrade] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [isViewingScreenshots, setIsViewingScreenshots] = useState(false);
  const [isEditingVideo, setIsEditingVideo] = useState(false);
  const [isAssigningPlaybook, setIsAssigningPlaybook] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [stopLoss, setStopLoss] = useState(
    trade.stopLossPriceInitial ? Number(trade.stopLossPriceInitial).toString() : ''
  );
  
  // Local state for dates (to update duration immediately after save)
  const [localOpenedAt, setLocalOpenedAt] = useState(new Date(trade.openedAt));
  const [localClosedAt, setLocalClosedAt] = useState(new Date(trade.closedAt));
  
  const [openTime, setOpenTime] = useState(formatTimeForInputWithSeconds(new Date(trade.openedAt)));
  const [closeTime, setCloseTime] = useState(formatTimeForInputWithSeconds(new Date(trade.closedAt)));
  const [tradeNote, setTradeNote] = useState(trade.note || '');
  const [localYoutubeUrl, setLocalYoutubeUrl] = useState(trade.youtubeUrl || '');
  const [screenshots, setScreenshots] = useState(trade.screenshots);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  
  // Local state for immediate UI updates
  const [localTimesManuallySet, setLocalTimesManuallySet] = useState(trade.timesManuallySet === true);

  // Playbook assignment state
  const [selectedPlaybookId, setSelectedPlaybookId] = useState('');
  const [checkedPrereqs, setCheckedPrereqs] = useState<Set<string>>(new Set());

  const pnl = Number(trade.realizedPnlUsd);
  const isProfit = pnl >= 0;
  
  // Use local dates for duration calculation (updates immediately after save)
  const duration = getDurationSeconds(localOpenedAt, localClosedAt);
  const dateLocale = locale === 'en' ? 'en-GB' : 'fr-FR';
  const dateStr = new Date(trade.closedAt).toLocaleDateString(dateLocale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeStr = new Date(trade.closedAt).toLocaleTimeString(dateLocale, {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Check if stop loss is set for RR display
  const hasStopLoss = trade.stopLossPriceInitial !== null;
  // Check if times were manually set for duration display (use local state)
  const hasManualTimes = localTimesManuallySet;

  function formatTimeForInputWithSeconds(date: Date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }
  
  // Extract YouTube video ID from URL
  function getYoutubeVideoId(url: string): string | null {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  }

  const handleSaveTradeDetails = async () => {
    setIsSaving(true);
    try {
      const price = stopLoss ? parseFloat(stopLoss) : null;
      await updateTradeStopLoss(trade.id, price);

      const openParts = openTime.split(':').map(Number);
      const closeParts = closeTime.split(':').map(Number);
      const openHours = openParts[0] || 0;
      const openMinutes = openParts[1] || 0;
      const openSeconds = openParts[2] || 0;
      const closeHours = closeParts[0] || 0;
      const closeMinutes = closeParts[1] || 0;
      const closeSeconds = closeParts[2] || 0;

      const newOpenedAt = new Date(trade.openedAt);
      newOpenedAt.setHours(openHours, openMinutes, openSeconds, 0);

      const newClosedAt = new Date(trade.closedAt);
      newClosedAt.setHours(closeHours, closeMinutes, closeSeconds, 0);

      await updateTradeTimes(trade.id, newOpenedAt, newClosedAt);
      
      // Update local state immediately for UI
      setLocalOpenedAt(newOpenedAt);
      setLocalClosedAt(newClosedAt);
      setLocalTimesManuallySet(true);
      
      setIsEditingTrade(false);
      router.refresh();
    } catch (error) {
      console.error('Error saving trade details:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNote = async () => {
    setIsSaving(true);
    try {
      await updateTradeNote(trade.id, tradeNote);
      setIsEditingNote(false);
      router.refresh();
    } catch (error) {
      console.error('Error saving note:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveYoutubeUrl = async () => {
    setIsSaving(true);
    try {
      await updateTradeYoutubeUrl(trade.id, localYoutubeUrl || null);
      setIsEditingVideo(false);
      router.refresh();
    } catch (error) {
      console.error('Error saving youtube URL:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveVideo = async () => {
    setIsSaving(true);
    try {
      await updateTradeYoutubeUrl(trade.id, null);
      setLocalYoutubeUrl('');
      router.refresh();
    } catch (error) {
      console.error('Error removing youtube URL:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const newScreenshot = await uploadTradeScreenshot(trade.id, formData);
      setScreenshots((prev) => [...prev, newScreenshot]);
    } catch (error) {
      console.error('Error uploading screenshot:', error);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteScreenshot = async (screenshotId: string) => {
    try {
      await deleteScreenshot(screenshotId);
      setScreenshots((prev) => prev.filter((s) => s.id !== screenshotId));
    } catch (error) {
      console.error('Error deleting screenshot:', error);
    }
  };

  const handleAssignPlaybook = async () => {
    if (!selectedPlaybookId) return;
    setIsSaving(true);
    try {
      await assignPlaybookToTrade(trade.id, selectedPlaybookId, Array.from(checkedPrereqs));
      setIsAssigningPlaybook(false);
      setSelectedPlaybookId('');
      setCheckedPrereqs(new Set());
      router.refresh();
    } catch (error) {
      console.error('Error assigning playbook:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemovePlaybook = async (playbookId: string) => {
    try {
      await removePlaybookFromTrade(trade.id, playbookId);
      router.refresh();
    } catch (error) {
      console.error('Error removing playbook:', error);
    }
  };

  const selectedPlaybook = playbooks.find((p) => p.id === selectedPlaybookId);

  const togglePrereq = (prereqId: string) => {
    const newChecked = new Set(checkedPrereqs);
    if (newChecked.has(prereqId)) {
      newChecked.delete(prereqId);
    } else {
      newChecked.add(prereqId);
    }
    setCheckedPrereqs(newChecked);
  };

  const inputId = `trade-photo-${trade.id}`;
  const youtubeVideoId = localYoutubeUrl ? getYoutubeVideoId(localYoutubeUrl) : null;

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('[role="checkbox"]') ||
      target.closest('[data-no-navigate]')
    ) {
      return;
    }
    router.push(`/trades/${trade.id}`);
  };

  return (
    <>
      <Card 
        className="hover:bg-accent/30 transition-colors cursor-pointer"
        onClick={handleCardClick}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {/* Checkbox */}
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelect}
              className="mt-1"
            />
            
            {/* Main Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-semibold text-lg">{trade.symbol}</span>
                <Badge variant={trade.direction === 'LONG' ? 'success' : 'destructive'}>
                  {trade.direction}
                </Badge>
                <span
                  className={cn(
                    'font-bold text-lg',
                    isProfit ? 'text-success' : 'text-destructive'
                  )}
                >
                  {isProfit ? '+' : ''}
                  {formatCurrency(pnl)}
                </span>
                {trade.rating && trade.rating > 0 && (
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={cn(
                          'h-3 w-3',
                          star <= trade.rating! ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'
                        )}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>{dateStr} {timeStr}</span>
                {hasManualTimes && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-primary" />
                    {formatDurationWithSeconds(duration)}
                  </span>
                )}
                <span>
                  {tTrade('entryPrice')}: {Number(trade.entryPrice).toFixed(2)}
                </span>
                <span>
                  {tTrade('exitPrice')}: {Number(trade.exitPrice).toFixed(2)}
                  {hasStopLoss && trade.realizedRMultiple && (
                    <span className="ml-2 text-primary font-medium">
                      (R/R: {Number(trade.realizedRMultiple).toFixed(2)})
                    </span>
                  )}
                </span>
              </div>

              {/* Playbooks */}
              {trade.tradePlaybooks.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {trade.tradePlaybooks.map((tp) => {
                    const checkedCount = tp.checkedPrerequisites.filter((cp) => cp.checked).length;
                    const totalCount = tp.checkedPrerequisites.length;
                    return (
                      <Badge
                        key={tp.playbook.id}
                        variant="outline"
                        className="flex items-center gap-1"
                      >
                        <ListChecks className="h-3 w-3" />
                        {tp.playbook.name}
                        <span className="text-xs opacity-70">
                          ({checkedCount}/{totalCount})
                        </span>
                        <button
                          onClick={() => handleRemovePlaybook(tp.playbook.id)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}

            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsAssigningPlaybook(true)}
                title={tTrade('assignPlaybook')}
              >
                <ListChecks className={cn("h-4 w-4", trade.tradePlaybooks.length > 0 && "text-success")} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsEditingNote(true)}
                title={tJournal('tradeNote')}
              >
                <FileText className={cn("h-4 w-4", trade.note && "text-success")} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsViewingScreenshots(true)}
                title={tJournal('screenshots')}
              >
                <ImageIcon className={cn("h-4 w-4", screenshots.length > 0 && "text-success")} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsEditingVideo(true)}
                title={t('youtubeUrl')}
              >
                <Video className={cn("h-4 w-4", localYoutubeUrl && "text-success")} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsEditingTrade(true)}
                title={tJournal('tradeDetails')}
              >
                <Clock className={cn("h-4 w-4", hasManualTimes && "text-success")} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => setIsDeleting(true)}
                title={tCommon('delete')}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Trade Dialog */}
      <Dialog open={isEditingTrade} onOpenChange={setIsEditingTrade}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tJournal('tradeDetails')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>{tJournal('stopLossInitial')}</Label>
              <Input
                type="number"
                step="0.01"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                placeholder={tJournal('stopLossPlaceholder')}
              />
            </div>
            <div className="space-y-4">
              <Label>{tJournal('editTimes')}</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">{tJournal('openTime')}</Label>
                  <Input 
                    type="time" 
                    step="1"
                    value={openTime} 
                    onChange={(e) => setOpenTime(e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">{tJournal('closeTime')}</Label>
                  <Input 
                    type="time" 
                    step="1"
                    value={closeTime} 
                    onChange={(e) => setCloseTime(e.target.value)} 
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditingTrade(false)}>
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleSaveTradeDetails} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tCommon('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Note Dialog */}
      <Dialog open={isEditingNote} onOpenChange={setIsEditingNote}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tJournal('tradeNote')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              value={tradeNote}
              onChange={(e) => setTradeNote(e.target.value)}
              placeholder={tJournal('tradeNotePlaceholder')}
              className="min-h-[150px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditingNote(false)}>
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleSaveNote} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tCommon('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Screenshots Dialog */}
      <Dialog open={isViewingScreenshots} onOpenChange={setIsViewingScreenshots}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{tJournal('screenshots')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <input
              type="file"
              id={inputId}
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => document.getElementById(inputId)?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {tJournal('addTradeScreenshot')}
            </Button>
            {screenshots.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {screenshots.map((screenshot, index) => (
                  <ImageThumbnail
                    key={screenshot.id}
                    screenshot={screenshot}
                    size="lg"
                    onView={() => setLightboxIndex(index)}
                    onDelete={() => handleDeleteScreenshot(screenshot.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Dialog */}
      <Dialog open={isEditingVideo} onOpenChange={setIsEditingVideo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('youtubeUrl')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              value={localYoutubeUrl}
              onChange={(e) => setLocalYoutubeUrl(e.target.value)}
              placeholder={t('youtubeUrlPlaceholder')}
            />
            {localYoutubeUrl && getYoutubeVideoId(localYoutubeUrl) && (
              <div className="relative w-full aspect-video rounded-lg overflow-hidden border">
                <iframe
                  src={`https://www.youtube.com/embed/${getYoutubeVideoId(localYoutubeUrl)}`}
                  title="YouTube video preview"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            {localYoutubeUrl && (
              <Button variant="destructive" onClick={handleRemoveVideo} disabled={isSaving}>
                {t('removeVideo')}
              </Button>
            )}
            <Button variant="outline" onClick={() => setIsEditingVideo(false)}>
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleSaveYoutubeUrl} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tCommon('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Playbook Dialog */}
      <Dialog open={isAssigningPlaybook} onOpenChange={setIsAssigningPlaybook}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{tTrade('assignPlaybook')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={selectedPlaybookId} onValueChange={(v) => {
              setSelectedPlaybookId(v);
              setCheckedPrereqs(new Set());
            }}>
              <SelectTrigger>
                <SelectValue placeholder={tTrade('assignPlaybook')} />
              </SelectTrigger>
              <SelectContent>
                {playbooks.map((pb) => (
                  <SelectItem key={pb.id} value={pb.id}>
                    {pb.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedPlaybook && (
              <div className="space-y-4 max-h-[300px] overflow-y-auto">
                <p className="text-sm font-medium">{tPlaybooks('checkedPrerequisites')}</p>
                {selectedPlaybook.groups.map((group) => (
                  <div key={group.id} className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">{group.name}</p>
                    {group.prerequisites.map((prereq) => (
                      <div key={prereq.id} className="flex items-center gap-2">
                        <Checkbox
                          id={prereq.id}
                          checked={checkedPrereqs.has(prereq.id)}
                          onCheckedChange={() => togglePrereq(prereq.id)}
                        />
                        <label htmlFor={prereq.id} className="text-sm cursor-pointer">
                          {prereq.text}
                        </label>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssigningPlaybook(false)}>
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleAssignPlaybook} disabled={isSaving || !selectedPlaybookId}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tCommon('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleting} onOpenChange={setIsDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tCommon('confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteTradeConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>
              {tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Lightbox for trade screenshots */}
      <ImageLightbox
        screenshots={screenshots}
        initialIndex={lightboxIndex ?? 0}
        isOpen={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
      />
    </>
  );
}

