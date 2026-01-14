'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Star,
  Save,
  Loader2,
  Image as ImageIcon,
  Video,
  Upload,
  Download,
  X,
  ListChecks,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import { cn, formatCurrency, formatDurationWithSeconds, getDurationSeconds, calculateTradeFees, calculateGrossPnl } from '@/lib/utils';
import { ImageLightbox, ImageThumbnail } from '@/components/ui/image-lightbox';
import {
  updateTradeDetails,
  updateTradeNote,
  updateTradeYoutubeUrl,
  updateTradeRating,
  uploadTradeScreenshot,
  deleteScreenshot,
  updateTradeTimes,
} from '@/app/actions/trade-detail';
import {
  assignPlaybookToTrade,
  removePlaybookFromTrade,
} from '@/app/actions/playbooks';
import { toggleTradeReviewed } from '@/app/actions/trades';
import type { Trade, Account } from '@prisma/client';
import { CheckCircle, Circle } from 'lucide-react';
import { VoiceNotesSection } from '@/components/audio';
import { LazyTradeChart as TradeChart } from '@/components/charts/lazy';
import type { VoiceNoteData } from '@/app/actions/voice-notes';

interface PartialExit {
  id: string;
  exitPrice: number;
  quantity: number;
  exitedAt: Date;
  pnl: number;
}

interface TradeWithRelations extends Trade {
  account: { id: string; name: string; color: string } | null;
  tags: { tag: { id: string; name: string; color: string } }[];
  screenshots: { id: string; filePath: string; originalName: string }[];
  tradePlaybooks: {
    playbook: { id: string; name: string };
    checkedPrerequisites: { prerequisiteId: string; checked: boolean }[];
  }[];
  timesManuallySet: boolean;
  reviewed: boolean;
  hasPartialExits: boolean;
  partialExits: PartialExit[];
}

interface PlaybookForSelection {
  id: string;
  name: string;
  groups: {
    id: string;
    name: string;
    prerequisites: { id: string; text: string }[];
  }[];
}

interface TradeDetailContentProps {
  trade: TradeWithRelations;
  playbooks: PlaybookForSelection[];
  voiceNotes: VoiceNoteData[];
  brokerConnection?: {
    hasBrokerConnection: boolean;
    brokerType: string;
  };
}

export function TradeDetailContent({ trade: initialTrade, playbooks, voiceNotes: initialVoiceNotes, brokerConnection }: TradeDetailContentProps) {
  const t = useTranslations('tradeDetail');
  const tTrade = useTranslations('trade');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const dateLocale = locale === 'en' ? 'en-GB' : 'fr-FR';
  const tPlaybooks = useTranslations('playbooks');
  const router = useRouter();

  const [trade, setTrade] = useState(initialTrade);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [screenshots, setScreenshots] = useState(initialTrade.screenshots);
  const [isReviewed, setIsReviewed] = useState(initialTrade.reviewed ?? false);
  const tTrades = useTranslations('trades');
  
  // Local state for playbooks (to update UI immediately)
  const [tradePlaybooks, setTradePlaybooks] = useState(initialTrade.tradePlaybooks);
  
  // Editable fields
  const [note, setNote] = useState(trade.note || '');
  const [youtubeUrl, setYoutubeUrl] = useState(trade.youtubeUrl || '');
  const [rating, setRating] = useState(trade.rating || 0);
  const [stopLoss, setStopLoss] = useState(trade.stopLossPriceInitial ? Number(trade.stopLossPriceInitial).toString() : '');
  const [profitTarget, setProfitTarget] = useState(trade.profitTarget ? Number(trade.profitTarget).toString() : '');
  const [drawdown, setDrawdown] = useState(trade.floatingDrawdownUsd ? Number(trade.floatingDrawdownUsd).toString() : '');
  const [runup, setRunup] = useState(trade.floatingRunupUsd ? Number(trade.floatingRunupUsd).toString() : '');
  
  // Local state for R multiples (to update immediately after save)
  const [localRealizedRMultiple, setLocalRealizedRMultiple] = useState<number | null>(
    trade.realizedRMultiple ? Number(trade.realizedRMultiple) : null
  );
  const [localPlannedRMultiple, setLocalPlannedRMultiple] = useState<number | null>(
    trade.plannedRMultiple ? Number(trade.plannedRMultiple) : null
  );
  
  // Local state for times manually set
  const [localTimesManuallySet, setLocalTimesManuallySet] = useState(
    trade.timesManuallySet === true
  );
  
  // Time editing with seconds support
  const formatTimeForInputWithSeconds = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };
  
  // Local state for dates (to update duration immediately after save)
  const [localOpenedAt, setLocalOpenedAt] = useState(new Date(trade.openedAt));
  const [localClosedAt, setLocalClosedAt] = useState(new Date(trade.closedAt));
  
  const [openTime, setOpenTime] = useState(formatTimeForInputWithSeconds(new Date(trade.openedAt)));
  const [closeTime, setCloseTime] = useState(formatTimeForInputWithSeconds(new Date(trade.closedAt)));
  const [isEditingTimes, setIsEditingTimes] = useState(false);
  
  // Check if times were manually set for duration display
  const hasManualTimes = localTimesManuallySet;
  
  // Playbook dialog
  const [isAssigningPlaybook, setIsAssigningPlaybook] = useState(false);
  const [selectedPlaybookId, setSelectedPlaybookId] = useState('');
  const [checkedPrereqs, setCheckedPrereqs] = useState<Set<string>>(new Set());

  // Calculated values
  const pnl = Number(trade.realizedPnlUsd);
  const isProfit = pnl >= 0;
  const quantity = Number(trade.quantity);
  const entryPrice = Number(trade.entryPrice);
  const exitPrice = Number(trade.exitPrice);
  const pointValue = Number(trade.pointValue);
  const points = trade.points ? Number(trade.points) : Math.abs(exitPrice - entryPrice);
  const ticksPerContract = trade.ticksPerContract ? Number(trade.ticksPerContract) : null;
  
  // Use local dates for duration calculation (updates immediately after save)
  const duration = getDurationSeconds(localOpenedAt, localClosedAt);
  
  // Calculate fees based on symbol (use stored value or calculate)
  const calculatedFees = calculateTradeFees(trade.symbol, quantity);
  const fees = trade.fees ? Number(trade.fees) : calculatedFees;
  const grossPnl = trade.grossPnlUsd ? Number(trade.grossPnlUsd) : calculateGrossPnl(pnl, fees);
  
  // R Multiples - use local state for immediate updates
  const plannedRMultiple = localPlannedRMultiple;
  const realizedRMultiple = localRealizedRMultiple;
  
  // Net ROI calculation (simplified)
  const netRoi = entryPrice > 0 ? ((exitPrice - entryPrice) / entryPrice) * 100 * (trade.direction === 'LONG' ? 1 : -1) : 0;

  // Extract YouTube video ID
  function getYoutubeVideoId(url: string): string | null {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  }

  const youtubeVideoId = youtubeUrl ? getYoutubeVideoId(youtubeUrl) : null;

  const handleSaveNote = async () => {
    setIsSaving(true);
    try {
      await updateTradeNote(trade.id, note);
    } catch (error) {
      console.error('Error saving note:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDetails = async () => {
    setIsSaving(true);
    try {
      const stopLossValue = stopLoss ? parseFloat(stopLoss) : null;
      const profitTargetValue = profitTarget ? parseFloat(profitTarget) : null;
      const drawdownValue = drawdown ? parseFloat(drawdown) : null;
      const runupValue = runup ? parseFloat(runup) : null;
      
      await updateTradeDetails(trade.id, {
        stopLossPriceInitial: stopLossValue,
        profitTarget: profitTargetValue,
        floatingDrawdownUsd: drawdownValue,
        floatingRunupUsd: runupValue,
      });
      
      // Calculate R multiples locally for immediate UI update
      if (stopLossValue && profitTargetValue) {
        const risk = Math.abs(entryPrice - stopLossValue);
        const reward = Math.abs(profitTargetValue - entryPrice);
        if (risk > 0) {
          setLocalPlannedRMultiple(reward / risk);
        }
      } else {
        setLocalPlannedRMultiple(null);
      }
      
      if (stopLossValue) {
        const risk = Math.abs(entryPrice - stopLossValue);
        const actualMove = trade.direction === 'LONG' 
          ? exitPrice - entryPrice 
          : entryPrice - exitPrice;
        if (risk > 0) {
          setLocalRealizedRMultiple(actualMove / risk);
        }
      } else {
        setLocalRealizedRMultiple(null);
      }
      
    } catch (error) {
      console.error('Error saving details:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveTimes = async () => {
    setIsSaving(true);
    try {
      const openParts = openTime.split(':').map(Number);
      const closeParts = closeTime.split(':').map(Number);
      const openHours = openParts[0] || 0;
      const openMinutes = openParts[1] || 0;
      const openSeconds = openParts[2] || 0;
      const closeHours = closeParts[0] || 0;
      const closeMinutes = closeParts[1] || 0;
      const closeSeconds = closeParts[2] || 0;
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/5b880551-a79c-4cdc-a97b-e6cdfcf52409',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'src/app/(dashboard)/trades/[id]/trade-detail-content.tsx:272',message:'handleSaveTimes - before date manipulation',data:{originalOpenedAt:trade.openedAt,originalClosedAt:trade.closedAt,openTime,closeTime,openHours,openMinutes,openSeconds,closeHours,closeMinutes,closeSeconds},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      const newOpenedAt = new Date(trade.openedAt);
      newOpenedAt.setHours(openHours, openMinutes, openSeconds, 0);
      
      const newClosedAt = new Date(trade.closedAt);
      newClosedAt.setHours(closeHours, closeMinutes, closeSeconds, 0);
      
      // #region agent log
      let durationMs = newClosedAt.getTime() - newOpenedAt.getTime();
      let durationSeconds = Math.round(durationMs / 1000);
      fetch('http://127.0.0.1:7242/ingest/5b880551-a79c-4cdc-a97b-e6cdfcf52409',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'src/app/(dashboard)/trades/[id]/trade-detail-content.tsx:277',message:'handleSaveTimes - after date manipulation (before fix)',data:{newOpenedAt:newOpenedAt.toISOString(),newClosedAt:newClosedAt.toISOString(),durationMs,durationSeconds,isNegative:durationMs<0,isZero:durationMs===0,tradeId:trade.id,realizedPnlUsd:trade.realizedPnlUsd},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      // Fix: Ensure closedAt is always after openedAt with at least 1 second duration
      if (newClosedAt.getTime() <= newOpenedAt.getTime()) {
        // Check if times are exactly the same (same hour, minute, second)
        const sameTime = newClosedAt.getTime() === newOpenedAt.getTime();
        
        if (sameTime) {
          // Same exact time - just add 1 second (don't move to next day)
          newClosedAt.setSeconds(newClosedAt.getSeconds() + 1);
        } else {
          // Close time is before open time - need to adjust
          // Check if it's the same date (both dates normalized to midnight)
          const openedAtDate = new Date(newOpenedAt);
          openedAtDate.setHours(0, 0, 0, 0);
          const closedAtDate = new Date(newClosedAt);
          closedAtDate.setHours(0, 0, 0, 0);
          
          if (openedAtDate.getTime() === closedAtDate.getTime()) {
            // Same day but close time is before open time - move close to next day
            newClosedAt.setDate(newClosedAt.getDate() + 1);
          } else {
            // Different dates but close is still before open - swap to ensure close >= open
            const temp = new Date(newOpenedAt);
            newOpenedAt.setTime(newClosedAt.getTime());
            newClosedAt.setTime(temp.getTime());
            // Then add a day to closedAt to ensure positive duration
            newClosedAt.setDate(newClosedAt.getDate() + 1);
          }
        }
      }
      
      // #region agent log
      durationMs = newClosedAt.getTime() - newOpenedAt.getTime();
      durationSeconds = Math.round(durationMs / 1000);
      fetch('http://127.0.0.1:7242/ingest/5b880551-a79c-4cdc-a97b-e6cdfcf52409',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'src/app/(dashboard)/trades/[id]/trade-detail-content.tsx:298',message:'handleSaveTimes - after fix applied',data:{newOpenedAt:newOpenedAt.toISOString(),newClosedAt:newClosedAt.toISOString(),durationMs,durationSeconds,isNegative:durationMs<0,isZero:durationMs===0},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      const result = await updateTradeTimes(trade.id, newOpenedAt, newClosedAt);
      
      // Update local state immediately for UI
      setLocalOpenedAt(newOpenedAt);
      setLocalClosedAt(newClosedAt);
      setLocalTimesManuallySet(true);
      
      // Update the time input fields to reflect saved values
      setOpenTime(formatTimeForInputWithSeconds(newOpenedAt));
      setCloseTime(formatTimeForInputWithSeconds(newClosedAt));
      
      setIsEditingTimes(false);
    } catch (error) {
      console.error('Error saving times:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveYoutubeUrl = async () => {
    setIsSaving(true);
    try {
      await updateTradeYoutubeUrl(trade.id, youtubeUrl || null);
    } catch (error) {
      console.error('Error saving youtube URL:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRatingChange = async (newRating: number) => {
    const finalRating = newRating === rating ? 0 : newRating;
    setRating(finalRating);
    try {
      await updateTradeRating(trade.id, finalRating || null);
    } catch (error) {
      console.error('Error saving rating:', error);
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
      setScreenshots(screenshots.filter(s => s.id !== screenshotId));
    } catch (error) {
      console.error('Error deleting screenshot:', error);
    }
  };

  const handleAssignPlaybook = async () => {
    if (!selectedPlaybookId) return;
    setIsSaving(true);
    try {
      await assignPlaybookToTrade(trade.id, selectedPlaybookId, Array.from(checkedPrereqs));
      
      // Update local state immediately
      const playbook = playbooks.find(p => p.id === selectedPlaybookId);
      if (playbook) {
        const allPrereqIds = playbook.groups.flatMap(g => g.prerequisites.map(p => p.id));
        const newTradePlaybook = {
          playbook: { id: playbook.id, name: playbook.name },
          checkedPrerequisites: allPrereqIds.map(prereqId => ({
            prerequisiteId: prereqId,
            checked: checkedPrereqs.has(prereqId),
          })),
        };
        setTradePlaybooks(prev => [...prev, newTradePlaybook]);
      }
      
      setIsAssigningPlaybook(false);
      setSelectedPlaybookId('');
      setCheckedPrereqs(new Set());
    } catch (error) {
      console.error('Error assigning playbook:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemovePlaybook = async (playbookId: string) => {
    try {
      await removePlaybookFromTrade(trade.id, playbookId);
      // Update local state immediately
      setTradePlaybooks(prev => prev.filter(tp => tp.playbook.id !== playbookId));
    } catch (error) {
      console.error('Error removing playbook:', error);
    }
  };

  const handleToggleReviewed = async () => {
    try {
      const result = await toggleTradeReviewed(trade.id);
      setIsReviewed(result.reviewed);
    } catch (error) {
      console.error('Error toggling reviewed status:', error);
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/trades">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{trade.symbol}</h1>
            <Badge variant={trade.direction === 'LONG' ? 'success' : 'destructive'} className="text-sm">
              {trade.direction}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {new Date(trade.closedAt).toLocaleDateString(dateLocale, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      </div>

      {/* Trade Chart */}
      <TradeChart
        symbol={trade.symbol}
        direction={trade.direction as 'LONG' | 'SHORT'}
        entryPrice={entryPrice}
        exitPrice={exitPrice}
        stopLoss={trade.stopLossPriceInitial ? Number(trade.stopLossPriceInitial) : null}
        profitTarget={trade.profitTarget ? Number(trade.profitTarget) : null}
        openedAt={new Date(trade.openedAt)}
        closedAt={new Date(trade.closedAt)}
        partialExits={trade.partialExits?.map(exit => ({
          exitPrice: Number(exit.exitPrice),
          exitedAt: new Date(exit.exitedAt),
        }))}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column - Trade Info */}
        <div className="space-y-6">
          {/* Main PnL Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="text-center mb-6">
                <p className="text-sm text-muted-foreground mb-1">{t('netPnl')}</p>
                <p className={cn(
                  'text-5xl font-bold',
                  isProfit ? 'text-success' : 'text-destructive'
                )}>
                  {isProfit ? '+' : ''}{formatCurrency(pnl)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Side */}
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">{t('side')}</p>
                  <Badge variant={trade.direction === 'LONG' ? 'success' : 'destructive'}>
                    {trade.direction}
                  </Badge>
                </div>

                {/* Contracts */}
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">{t('contracts')}</p>
                  <p className="font-semibold">{quantity}</p>
                </div>

                {/* Points */}
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">{t('points')}</p>
                  <p className="font-semibold">{points.toFixed(2)}</p>
                </div>

                {/* Trade Duration */}
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">{t('tradeDuration')}</p>
                  <p className="font-semibold">{hasManualTimes ? formatDurationWithSeconds(duration) : 'N/A'}</p>
                </div>

                {/* Fees */}
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">{t('fees')}</p>
                  <p className="font-semibold text-destructive">{formatCurrency(fees)}</p>
                </div>

                {/* Net ROI */}
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">{t('netRoi')}</p>
                  <p className={cn('font-semibold', netRoi >= 0 ? 'text-success' : 'text-destructive')}>
                    {netRoi >= 0 ? '+' : ''}{netRoi.toFixed(2)}%
                  </p>
                </div>

                {/* Gross P&L */}
                <div className="p-3 rounded-lg bg-muted/50 col-span-2">
                  <p className="text-xs text-muted-foreground mb-1">{t('grossPnl')}</p>
                  <p className={cn('font-semibold', grossPnl >= 0 ? 'text-success' : 'text-destructive')}>
                    {grossPnl >= 0 ? '+' : ''}{formatCurrency(grossPnl)}
                  </p>
                </div>

                {/* Drawdown */}
                {trade.floatingDrawdownUsd !== null && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">{t('drawdown')}</p>
                    <p className="font-semibold text-destructive">
                      {formatCurrency(Number(trade.floatingDrawdownUsd))}
                    </p>
                  </div>
                )}

                {/* Runup */}
                {trade.floatingRunupUsd !== null && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">{t('runup')}</p>
                    <p className="font-semibold text-success">
                      {formatCurrency(Number(trade.floatingRunupUsd))}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Playbook Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center justify-between">
                <span>{t('playbook')}</span>
                <Button variant="outline" size="sm" onClick={() => setIsAssigningPlaybook(true)}>
                  <ListChecks className="h-4 w-4 mr-2" />
                  {t('assignPlaybook')}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tradePlaybooks.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t('noPlaybook')}</p>
              ) : (
                <div className="space-y-2">
                  {tradePlaybooks.map((tp) => {
                    const checkedCount = tp.checkedPrerequisites.filter((cp) => cp.checked).length;
                    const totalCount = tp.checkedPrerequisites.length;
                    return (
                      <div key={tp.playbook.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2">
                          <ListChecks className="h-4 w-4 text-primary" />
                          <span className="font-medium">{tp.playbook.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({checkedCount}/{totalCount})
                          </span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemovePlaybook(tp.playbook.id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rating Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{t('tradeRating')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => handleRatingChange(star)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star
                      className={cn(
                        'h-8 w-8 transition-colors',
                        star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
                      )}
                    />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Targets & Prices Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{t('targetsAndPrices')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('profitTarget')}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={profitTarget}
                    onChange={(e) => setProfitTarget(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('stopLoss')}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">{t('plannedRMultiple')}</p>
                  <p className="font-semibold">{plannedRMultiple ? plannedRMultiple.toFixed(2) : '-'}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">{t('realizedRMultiple')}</p>
                  <p className={cn('font-semibold', realizedRMultiple && realizedRMultiple >= 0 ? 'text-success' : 'text-destructive')}>
                    {realizedRMultiple ? realizedRMultiple.toFixed(2) : '-'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">{t('entryPrice')}</p>
                  <p className="font-semibold">{entryPrice.toFixed(2)}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">{t('exitPrice')}</p>
                  <p className="font-semibold">
                    {exitPrice.toFixed(2)}
                    {trade.hasPartialExits && (
                      <span className="text-xs text-muted-foreground ml-1">({t('avgPrice')})</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Drawdown & Runup */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    {t('drawdown')}
                    <span className="text-xs text-muted-foreground" title={t('drawdownTooltip')}>($)</span>
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={drawdown}
                    onChange={(e) => setDrawdown(e.target.value)}
                    placeholder="0.00"
                    className="text-red-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    {t('runup')}
                    <span className="text-xs text-muted-foreground" title={t('runupTooltip')}>($)</span>
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={runup}
                    onChange={(e) => setRunup(e.target.value)}
                    placeholder="0.00"
                    className="text-green-400"
                  />
                </div>
              </div>

              {/* Partial Exits Section */}
              {trade.hasPartialExits && trade.partialExits && trade.partialExits.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{t('partialExits')}</p>
                  <div className="space-y-2">
                    {trade.partialExits.map((exit, index) => (
                      <div key={exit.id} className="p-3 rounded-lg bg-muted/30 border border-border/50">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              #{index + 1}
                            </Badge>
                            <span className="font-medium">{Number(exit.exitPrice).toFixed(2)}</span>
                            <span className="text-xs text-muted-foreground">
                              × {Number(exit.quantity)} {t('contracts')}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className={cn(
                              "font-semibold",
                              Number(exit.pnl) >= 0 ? "text-green-500" : "text-red-500"
                            )}>
                              {formatCurrency(Number(exit.pnl))}
                            </span>
                            <p className="text-xs text-muted-foreground">
                              {new Date(exit.exitedAt).toLocaleTimeString(dateLocale)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button onClick={handleSaveDetails} disabled={isSaving} className="w-full">
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                {tCommon('save')}
              </Button>
            </CardContent>
          </Card>

          {/* Duration */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center justify-between">
                <span>{t('duration')}</span>
                <span className="font-semibold text-base">{formatDurationWithSeconds(duration)}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditingTimes ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('openTime')}</Label>
                      <Input
                        type="time"
                        step="1"
                        value={openTime}
                        onChange={(e) => setOpenTime(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('closeTime')}</Label>
                      <Input
                        type="time"
                        step="1"
                        value={closeTime}
                        onChange={(e) => setCloseTime(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSaveTimes} disabled={isSaving} className="flex-1">
                      {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <Save className="mr-2 h-4 w-4" />
                      {tCommon('save')}
                    </Button>
                    <Button variant="outline" onClick={() => setIsEditingTimes(false)}>
                      {tCommon('cancel')}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-1">{t('openTime')}</p>
                      <p className="font-semibold">{openTime}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-1">{t('closeTime')}</p>
                      <p className="font-semibold">{closeTime}</p>
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => setIsEditingTimes(true)} className="w-full">
                    {t('editTimes')}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Notes & Media */}
        <div className="space-y-6">
          {/* Trade Note Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{t('tradeNote')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('notePlaceholder')}
                className="min-h-[150px]"
              />
              
              <div className="flex items-center gap-2">
                <Button onClick={handleSaveNote} disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" />
                  {tCommon('save')}
                </Button>
                
                <input
                  type="file"
                  id={inputId}
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => document.getElementById(inputId)?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ImageIcon className="mr-2 h-4 w-4" />
                  )}
                  {t('addScreenshot')}
                </Button>
              </div>

              {/* Screenshots Gallery */}
              {screenshots.length > 0 && (
                <div className="space-y-4 pt-4 border-t">
                  <p className="text-sm font-medium">{t('screenshots')}</p>
                  <div className="space-y-4">
                    {screenshots.map((screenshot, index) => {
                      // Use API route to handle special characters in filenames
                      const segments = screenshot.filePath.split('/');
                      const encodedSegments = segments.map(segment => encodeURIComponent(segment));
                      const imageUrl = `/api/uploads/${encodedSegments.join('/')}`;
                      return (
                        <div key={screenshot.id} className="relative group">
                          <img
                            src={imageUrl}
                            alt={screenshot.originalName}
                            className="w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setLightboxIndex(index)}
                          />
                          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <a
                              href={imageUrl}
                              download={screenshot.originalName}
                              className="p-2 rounded-full bg-black/50 hover:bg-black/70 text-white"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Download className="h-4 w-4" />
                            </a>
                            <button
                              onClick={() => handleDeleteScreenshot(screenshot.id)}
                              className="p-2 rounded-full bg-destructive/80 hover:bg-destructive text-white"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* YouTube Video Section */}
              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Input
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder={t('youtubeUrlPlaceholder')}
                    className="flex-1"
                  />
                  <Button variant="outline" onClick={handleSaveYoutubeUrl} disabled={isSaving}>
                    <Video className="mr-2 h-4 w-4" />
                    {youtubeUrl ? t('updateVideo') : t('addVideo')}
                  </Button>
                </div>

                {youtubeVideoId && (
                  <div className="relative w-full aspect-video rounded-lg overflow-hidden border">
                    <iframe
                      src={`https://www.youtube.com/embed/${youtubeVideoId}`}
                      title="YouTube video"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="absolute inset-0 w-full h-full"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Voice Notes */}
          <VoiceNotesSection tradeId={trade.id} initialVoiceNotes={initialVoiceNotes} />

          {/* Tags */}
          {trade.tags.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{t('tags')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {trade.tags.map(({ tag }) => (
                    <Badge
                      key={tag.id}
                      variant="outline"
                      style={{ borderColor: tag.color, color: tag.color }}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Account */}
          {trade.account && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{t('account')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: trade.account.color }}
                  />
                  <span className="font-medium">{trade.account.name}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Mark as Reviewed Button */}
      <Card className="mt-6">
        <CardContent className="py-4">
          <Button 
            onClick={handleToggleReviewed}
            variant={isReviewed ? "default" : "outline"}
            className={cn(
              "w-full",
              isReviewed && "bg-success hover:bg-success/90 text-success-foreground"
            )}
          >
            {isReviewed ? (
              <>
                <CheckCircle className="mr-2 h-5 w-5" />
                {tTrades('reviewed')}
              </>
            ) : (
              <>
                <Circle className="mr-2 h-5 w-5" />
                {tTrades('markAsReviewed')}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

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

      {/* Lightbox */}
      <ImageLightbox
        screenshots={screenshots}
        initialIndex={lightboxIndex ?? 0}
        isOpen={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
      />
    </div>
  );
}

