'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Save,
  Edit2,
  Loader2,
  Clock,
  Image as ImageIcon,
  FileText,
  Upload,
} from 'lucide-react';
import { cn, formatCurrency, formatDurationWithSeconds, getDurationSeconds } from '@/lib/utils';
import { ImageLightbox, ImageThumbnail } from '@/components/ui/image-lightbox';
import type { Tag, Trade, Screenshot } from '@prisma/client';
import { 
  getTradesForDate, 
  getDayJournal, 
  saveDayNote, 
  updateTradeStopLoss,
  updateTradeTimes,
  updateTradeNote,
  uploadTradeScreenshot,
  uploadDayScreenshot,
  deleteScreenshot,
  getDailyPnlMap,
} from '@/app/actions/journal';

interface JournalContentProps {
  userId: string;
  tags: Tag[];
}

interface TradeWithTags extends Trade {
  tags: { tag: { id: string; name: string; color: string } }[];
  screenshots: { id: string; filePath: string; originalName: string }[];
}

interface DayJournalData {
  id: string;
  note: string | null;
  tags: { tag: { id: string; name: string; color: string } }[];
  screenshots: { id: string; filePath: string; originalName: string }[];
}

function capitalizeFirst(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function JournalContent({ userId, tags }: JournalContentProps) {
  const t = useTranslations('journal');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const dateLocale = locale === 'en' ? 'en-GB' : 'fr-FR';
  const searchParams = useSearchParams();
  
  // Initialize date from URL parameter or use today
  const getInitialDate = () => {
    const dateParam = searchParams.get('date');
    if (dateParam) {
      const parsed = new Date(dateParam);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    return new Date();
  };
  
  const [selectedDate, setSelectedDate] = useState<Date>(getInitialDate);
  const [currentMonth, setCurrentMonth] = useState<Date>(getInitialDate);
  const [trades, setTrades] = useState<TradeWithTags[]>([]);
  const [dayJournal, setDayJournal] = useState<DayJournalData | null>(null);
  const [dayScreenshots, setDayScreenshots] = useState<{ id: string; filePath: string; originalName: string }[]>([]);
  const [note, setNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [dailyPnl, setDailyPnl] = useState<Record<string, number>>({});

  // Load daily PnL map
  useEffect(() => {
    const loadPnlMap = async () => {
      const pnlMap = await getDailyPnlMap();
      setDailyPnl(pnlMap);
    };
    loadPnlMap();
  }, [trades]);

  // Load data when date changes
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [tradesData, journalData] = await Promise.all([
          getTradesForDate(selectedDate.toISOString()),
          getDayJournal(selectedDate.toISOString()),
        ]);
        setTrades(tradesData as TradeWithTags[]);
        setDayJournal(journalData as DayJournalData | null);
        setNote(journalData?.note || '');
        setDayScreenshots(journalData?.screenshots || []);
      } catch (error) {
        console.error('Error loading journal data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [selectedDate]);

  const handleSaveNote = async () => {
    setIsSaving(true);
    try {
      await saveDayNote(selectedDate.toISOString(), note);
    } catch (error) {
      console.error('Error saving note:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const dayPnl = trades.reduce((sum, t) => sum + Number(t.realizedPnlUsd), 0);

  // Calendar generation
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek < 0) startDayOfWeek = 6;
    
    const days: (Date | null)[] = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }
    return days;
  };

  const calendarDays = generateCalendarDays();
  const weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  const formattedDate = capitalizeFirst(
    selectedDate.toLocaleDateString(dateLocale, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  );

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
      </div>

      {/* Top section: Calendar + Day Note side by side */}
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Calendar with PnL */}
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {capitalizeFirst(currentMonth.toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' }))}
              </CardTitle>
              <div className="flex gap-1">
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                >
                  ←
                </Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                >
                  →
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3">
            <div className="grid grid-cols-7 gap-1 mb-1">
              {weekDays.map(day => (
                <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, index) => {
                if (!day) {
                  return <div key={`empty-${index}`} className="aspect-square" />;
                }
                
                // Use local date format to match the server-side format
                const year = day.getFullYear();
                const month = String(day.getMonth() + 1).padStart(2, '0');
                const dayNum = String(day.getDate()).padStart(2, '0');
                const dateKey = `${year}-${month}-${dayNum}`;
                const pnl = dailyPnl[dateKey];
                const isSelected = selectedDate.toDateString() === day.toDateString();
                const isToday = new Date().toDateString() === day.toDateString();
                
                return (
                  <button
                    key={dateKey}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      'aspect-square p-0.5 rounded text-xs transition-colors flex flex-col items-center justify-center',
                      isSelected && 'ring-2 ring-primary',
                      isToday && !isSelected && 'ring-1 ring-muted-foreground',
                      pnl !== undefined && pnl > 0 && 'bg-success/20',
                      pnl !== undefined && pnl < 0 && 'bg-destructive/20',
                      'hover:bg-accent'
                    )}
                  >
                    <span className={cn(isToday && 'font-bold')}>{day.getDate()}</span>
                    {pnl !== undefined && (
                      <span className={cn(
                        'text-[9px] font-medium truncate w-full text-center',
                        pnl >= 0 ? 'text-success' : 'text-destructive'
                      )}>
                        {pnl >= 0 ? '+' : ''}{pnl.toFixed(0)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Day Summary + Note */}
        <div className="space-y-6">
          {/* Day Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <span>{formattedDate}</span>
                {trades.length > 0 && (
                  <span
                    className={cn(
                      'text-2xl font-bold',
                      dayPnl >= 0 ? 'text-success' : 'text-destructive'
                    )}
                  >
                    {dayPnl >= 0 ? '+' : ''}
                    {formatCurrency(dayPnl)}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
          </Card>

          {/* Day Note with integrated photos */}
          <DayNoteCard
            dateStr={selectedDate.toISOString()}
            note={note}
            onNoteChange={setNote}
            screenshots={dayScreenshots}
            onScreenshotsChange={setDayScreenshots}
            isSaving={isSaving}
            onSave={handleSaveNote}
          />
        </div>
      </div>

      {/* Trades List - Full width below */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {t('tradesOfDay')} ({trades.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : trades.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {t('noTradesThisDay')}
            </p>
          ) : (
            <div className="space-y-3">
              {trades.map((trade) => (
                <TradeCard 
                  key={trade.id} 
                  trade={trade}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Day Note with integrated photos component
function DayNoteCard({
  dateStr,
  note,
  onNoteChange,
  screenshots,
  onScreenshotsChange,
  isSaving,
  onSave,
}: {
  dateStr: string;
  note: string;
  onNoteChange: (note: string) => void;
  screenshots: { id: string; filePath: string; originalName: string }[];
  onScreenshotsChange: (screenshots: { id: string; filePath: string; originalName: string }[]) => void;
  isSaving: boolean;
  onSave: () => void;
}) {
  const t = useTranslations('journal');
  const tCommon = useTranslations('common');
  const [isUploading, setIsUploading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const newScreenshot = await uploadDayScreenshot(dateStr, formData);
      onScreenshotsChange([...screenshots, newScreenshot]);
    } catch (error) {
      console.error('Error uploading screenshot:', error);
    } finally {
      setIsUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleDeleteScreenshot = async (screenshotId: string) => {
    try {
      await deleteScreenshot(screenshotId);
      onScreenshotsChange(screenshots.filter((s) => s.id !== screenshotId));
    } catch (error) {
      console.error('Error deleting screenshot:', error);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('dayNote')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder={t('dayNotePlaceholder')}
            className="min-h-[120px]"
          />

          {/* Action buttons with thumbnails */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={onSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {tCommon('save')}
            </Button>
            
            <input
              type="file"
              id="day-photo-input"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button 
              variant="outline" 
              onClick={() => document.getElementById('day-photo-input')?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ImageIcon className="mr-2 h-4 w-4" />
              )}
              {t('addDayScreenshot')}
            </Button>
            
            {/* Small thumbnails next to button */}
            {screenshots.length > 0 && (
              <div className="flex items-center gap-1.5 ml-2">
                {screenshots.map((screenshot, index) => (
                  <ImageThumbnail
                    key={screenshot.id}
                    screenshot={screenshot}
                    size="sm"
                    onView={() => setLightboxIndex(index)}
                    onDelete={() => handleDeleteScreenshot(screenshot.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lightbox */}
      <ImageLightbox
        screenshots={screenshots}
        initialIndex={lightboxIndex ?? 0}
        isOpen={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
      />
    </>
  );
}

function TradeCard({ 
  trade, 
}: { 
  trade: TradeWithTags;
}) {
  const t = useTranslations('trade');
  const tJournal = useTranslations('journal');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [isEditingTrade, setIsEditingTrade] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [stopLoss, setStopLoss] = useState(
    trade.stopLossPriceInitial ? Number(trade.stopLossPriceInitial).toString() : ''
  );
  
  // Time state - format HH:MM for input fields
  const formatTimeForInput = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };
  
  const [openTime, setOpenTime] = useState(formatTimeForInput(new Date(trade.openedAt)));
  const [closeTime, setCloseTime] = useState(formatTimeForInput(new Date(trade.closedAt)));
  
  const [tradeNote, setTradeNote] = useState(trade.note || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [screenshots, setScreenshots] = useState(trade.screenshots);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const pnl = Number(trade.realizedPnlUsd);
  const isProfit = pnl >= 0;
  const displayDuration = getDurationSeconds(new Date(trade.openedAt), new Date(trade.closedAt));

  const handleSaveTradeDetails = async () => {
    setIsSaving(true);
    try {
      // Save stop loss
      const price = stopLoss ? parseFloat(stopLoss) : null;
      await updateTradeStopLoss(trade.id, price);
      
      // Save times - update the time part of openedAt and closedAt
      const [openHours, openMinutes] = openTime.split(':').map(Number);
      const [closeHours, closeMinutes] = closeTime.split(':').map(Number);
      
      const newOpenedAt = new Date(trade.openedAt);
      newOpenedAt.setHours(openHours, openMinutes, 0, 0);
      
      const newClosedAt = new Date(trade.closedAt);
      newClosedAt.setHours(closeHours, closeMinutes, 0, 0);
      
      await updateTradeTimes(trade.id, newOpenedAt, newClosedAt);
      
      setIsEditingTrade(false);
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
    } catch (error) {
      console.error('Error saving note:', error);
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
      setScreenshots(screenshots.filter(s => s.id !== screenshotId));
    } catch (error) {
      console.error('Error deleting screenshot:', error);
    }
  };

  const inputId = `trade-photo-${trade.id}`;

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('textarea') ||
      target.closest('[role="dialog"]') ||
      target.closest('[data-no-navigate]')
    ) {
      return;
    }
    router.push(`/trades/${trade.id}`);
  };

  return (
    <>
      <div 
        className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
        onClick={handleCardClick}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-semibold">{trade.symbol}</span>
                <Badge
                  variant={trade.direction === 'LONG' ? 'success' : 'destructive'}
                  className="text-xs"
                >
                  {trade.direction}
                </Badge>
                <span
                  className={cn(
                    'font-semibold',
                    isProfit ? 'text-success' : 'text-destructive'
                  )}
                >
                  {isProfit ? '+' : ''}
                  {formatCurrency(pnl)}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                {/* Note button */}
                <Dialog open={isEditingNote} onOpenChange={setIsEditingNote}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <FileText className={cn("h-4 w-4", trade.note && "text-primary")} />
                    </Button>
                  </DialogTrigger>
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

                {/* Screenshot button */}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <ImageIcon className={cn("h-4 w-4", screenshots.length > 0 && "text-primary")} />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>{tJournal('screenshots')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      {/* Upload button */}
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

                      {/* Screenshots list with thumbnails */}
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

              {/* Edit trade details (stop loss + times) */}
              <Dialog open={isEditingTrade} onOpenChange={setIsEditingTrade}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{tJournal('tradeDetails')}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6 py-4">
                    {/* Stop Loss */}
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
                    
                    {/* Trade Times */}
                    <div className="space-y-4">
                      <Label>{tJournal('editTimes')}</Label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">{tJournal('openTime')}</Label>
                          <Input
                            type="time"
                            value={openTime}
                            onChange={(e) => setOpenTime(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">{tJournal('closeTime')}</Label>
                          <Input
                            type="time"
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
            </div>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>
              {t('entryPrice')}: {Number(trade.entryPrice).toFixed(2)}
            </span>
            <span>
              {t('exitPrice')}: {Number(trade.exitPrice).toFixed(2)}
            </span>
            <span>
              {t('quantity')}: {Number(trade.quantity)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDurationWithSeconds(displayDuration)}
            </span>
          </div>

          {/* Stop Loss & RR */}
          <div className="flex items-center gap-4 text-sm">
            {trade.stopLossPriceInitial ? (
              <>
                <span className="text-muted-foreground">
                  SL: {Number(trade.stopLossPriceInitial).toFixed(2)}
                </span>
                {trade.riskRewardRatio && (
                  <span className="text-muted-foreground">
                    R/R: {Number(trade.riskRewardRatio).toFixed(2)}
                  </span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground italic">
                Stop loss non défini
              </span>
            )}
          </div>

          {/* Note preview */}
          {trade.note && (
            <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
              {trade.note.length > 100 ? trade.note.substring(0, 100) + '...' : trade.note}
            </p>
          )}

          {/* Tags */}
          {trade.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
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
          )}

          {/* Screenshots indicator */}
          {screenshots.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <ImageIcon className="h-3 w-3" />
              {screenshots.length} screenshot(s)
            </div>
          )}
        </div>
      </div>
    </div>

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
