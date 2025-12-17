'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Save,
  Loader2,
  Clock,
  Image as ImageIcon,
  Upload,
  ExternalLink,
} from 'lucide-react';
import { cn, formatCurrency, formatDurationWithSeconds, getDurationSeconds } from '@/lib/utils';
import { ImageLightbox, ImageThumbnail } from '@/components/ui/image-lightbox';
import type { Tag, Trade, Screenshot } from '@prisma/client';
import { 
  getTradesForDate, 
  getDayJournal, 
  saveDayNote, 
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
  timesManuallySet: boolean;
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
  const router = useRouter();

  const pnl = Number(trade.realizedPnlUsd);
  const isProfit = pnl >= 0;
  const hasManualTimes = trade.timesManuallySet === true;
  const displayDuration = getDurationSeconds(new Date(trade.openedAt), new Date(trade.closedAt));

  return (
    <div className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      <div className="flex items-center gap-4">
        {/* Trade Info */}
        <div className="flex-1 space-y-2">
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

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>
              {t('entryPrice')}: {Number(trade.entryPrice).toFixed(2)}
            </span>
            <span>
              {t('exitPrice')}: {Number(trade.exitPrice).toFixed(2)}
            </span>
            {hasManualTimes && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDurationWithSeconds(displayDuration)}
              </span>
            )}
            {trade.stopLossPriceInitial && trade.realizedRMultiple && (
              <span>
                R/R: {Number(trade.realizedRMultiple).toFixed(2)}
              </span>
            )}
          </div>

          {/* Tags */}
          {trade.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {trade.tags.map(({ tag }) => (
                <Badge
                  key={tag.id}
                  variant="outline"
                  style={{ borderColor: tag.color, color: tag.color }}
                  className="text-xs"
                >
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Button to trade page */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/trades/${trade.id}`)}
          className="shrink-0"
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          {tJournal('tradeDetails')}
        </Button>
      </div>
    </div>
  );
}
