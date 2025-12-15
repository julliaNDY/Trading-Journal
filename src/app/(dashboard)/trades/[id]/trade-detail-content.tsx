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
import type { Trade, Account } from '@prisma/client';

interface TradeWithRelations extends Trade {
  account: { id: string; name: string; color: string } | null;
  tags: { tag: { id: string; name: string; color: string } }[];
  screenshots: { id: string; filePath: string; originalName: string }[];
  tradePlaybooks: {
    playbook: { id: string; name: string };
    checkedPrerequisites: { prerequisiteId: string; checked: boolean }[];
  }[];
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
}

export function TradeDetailContent({ trade: initialTrade, playbooks }: TradeDetailContentProps) {
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
  
  // Editable fields
  const [note, setNote] = useState(trade.note || '');
  const [youtubeUrl, setYoutubeUrl] = useState(trade.youtubeUrl || '');
  const [rating, setRating] = useState(trade.rating || 0);
  const [stopLoss, setStopLoss] = useState(trade.stopLossPriceInitial ? Number(trade.stopLossPriceInitial).toString() : '');
  const [profitTarget, setProfitTarget] = useState(trade.profitTarget ? Number(trade.profitTarget).toString() : '');
  
  // Time editing
  const formatTimeForInput = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };
  const [openTime, setOpenTime] = useState(formatTimeForInput(new Date(trade.openedAt)));
  const [closeTime, setCloseTime] = useState(formatTimeForInput(new Date(trade.closedAt)));
  const [isEditingTimes, setIsEditingTimes] = useState(false);
  
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
  const duration = getDurationSeconds(new Date(trade.openedAt), new Date(trade.closedAt));
  
  // Calculate fees based on symbol (use stored value or calculate)
  const calculatedFees = calculateTradeFees(trade.symbol, quantity);
  const fees = trade.fees ? Number(trade.fees) : calculatedFees;
  const grossPnl = trade.grossPnlUsd ? Number(trade.grossPnlUsd) : calculateGrossPnl(pnl, fees);
  
  // R Multiples
  const plannedRMultiple = trade.plannedRMultiple ? Number(trade.plannedRMultiple) : null;
  const realizedRMultiple = trade.realizedRMultiple ? Number(trade.realizedRMultiple) : null;
  
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
      await updateTradeDetails(trade.id, {
        stopLossPriceInitial: stopLoss ? parseFloat(stopLoss) : null,
        profitTarget: profitTarget ? parseFloat(profitTarget) : null,
      });
      router.refresh();
    } catch (error) {
      console.error('Error saving details:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveTimes = async () => {
    setIsSaving(true);
    try {
      const [openHours, openMinutes] = openTime.split(':').map(Number);
      const [closeHours, closeMinutes] = closeTime.split(':').map(Number);
      
      const newOpenedAt = new Date(trade.openedAt);
      newOpenedAt.setHours(openHours, openMinutes, 0, 0);
      
      const newClosedAt = new Date(trade.closedAt);
      newClosedAt.setHours(closeHours, closeMinutes, 0, 0);
      
      await updateTradeTimes(trade.id, newOpenedAt, newClosedAt);
      setIsEditingTimes(false);
      router.refresh();
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

                {/* Ticks per Contract */}
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">{t('ticksPerContract')}</p>
                  <p className="font-semibold">{ticksPerContract ? ticksPerContract.toFixed(2) : '-'}</p>
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
              {trade.tradePlaybooks.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t('noPlaybook')}</p>
              ) : (
                <div className="space-y-2">
                  {trade.tradePlaybooks.map((tp) => {
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
                  <p className="font-semibold">{exitPrice.toFixed(2)}</p>
                </div>
              </div>

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
                        value={openTime}
                        onChange={(e) => setOpenTime(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('closeTime')}</Label>
                      <Input
                        type="time"
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
                    {screenshots.map((screenshot, index) => (
                      <div key={screenshot.id} className="relative group">
                        <img
                          src={`/uploads/${screenshot.filePath}`}
                          alt={screenshot.originalName}
                          className="w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setLightboxIndex(index)}
                        />
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <a
                            href={`/uploads/${screenshot.filePath}`}
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
                    ))}
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

