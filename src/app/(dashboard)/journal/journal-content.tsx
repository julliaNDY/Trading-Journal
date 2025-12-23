'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Save,
  Loader2,
  Clock,
  Image as ImageIcon,
  Upload,
  ExternalLink,
  Filter,
  X,
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

interface Account {
  id: string;
  name: string;
  color: string;
}

interface JournalContentProps {
  userId: string;
  tags: Tag[];
  accounts: Account[];
  symbols: string[];
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

export function JournalContent({ userId, tags, accounts, symbols }: JournalContentProps) {
  const t = useTranslations('journal');
  const tCommon = useTranslations('common');
  const tStats = useTranslations('statistics');
  const locale = useLocale();
  const dateLocale = locale === 'en' ? 'en-GB' : 'fr-FR';
  const searchParams = useSearchParams();
  
  // Get today's date in user's local timezone (midnight)
  const getTodayLocal = () => {
    const now = new Date();
    // Create a new date with only year, month, day (no time component)
    // This ensures we get the correct local date
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  };
  
  // Initialize date from URL parameter or use today
  const getInitialDate = () => {
    const dateParam = searchParams.get('date');
    if (dateParam) {
      // Parse YYYY-MM-DD format explicitly to avoid timezone issues
      const [year, month, day] = dateParam.split('-').map(Number);
      if (year && month && day) {
        return new Date(year, month - 1, day);
      }
    }
    return getTodayLocal();
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
  
  // Today's date (client-side only to avoid hydration mismatch)
  const [today, setToday] = useState<Date | null>(null);
  
  // Filters
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  
  // Set today's date on client side
  useEffect(() => {
    setToday(getTodayLocal());
  }, []);

  // Load daily PnL map
  useEffect(() => {
    const loadPnlMap = async () => {
      const pnlMap = await getDailyPnlMap(getTimezoneOffset());
      setDailyPnl(pnlMap);
    };
    loadPnlMap();
  }, [trades]);

  // Helper to format date as YYYY-MM-DD (local timezone)
  const formatDateForServer = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Get user's timezone offset in minutes (e.g., UTC+1 = -60)
  const getTimezoneOffset = () => {
    return new Date().getTimezoneOffset();
  };

  // Load data when date changes
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Pass date and timezone offset to handle timezone correctly
        const dateStr = formatDateForServer(selectedDate);
        const timezoneOffset = getTimezoneOffset();
        const [tradesData, journalData] = await Promise.all([
          getTradesForDate(dateStr, timezoneOffset),
          getDayJournal(dateStr, timezoneOffset),
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
      await saveDayNote(formatDateForServer(selectedDate), note, getTimezoneOffset());
    } catch (error) {
      console.error('Error saving note:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Filter trades
  const filteredTrades = useMemo(() => {
    return trades.filter((trade) => {
      // Account filter
      if (selectedAccounts.length > 0) {
        if (!trade.accountId || !selectedAccounts.includes(trade.accountId)) {
          return false;
        }
      }

      // Symbol filter
      if (selectedSymbol && trade.symbol !== selectedSymbol) {
        return false;
      }

      return true;
    });
  }, [trades, selectedAccounts, selectedSymbol]);

  const dayPnl = filteredTrades.reduce((sum, t) => sum + Number(t.realizedPnlUsd), 0);

  const toggleAccount = (accountId: string) => {
    setSelectedAccounts((prev) =>
      prev.includes(accountId)
        ? prev.filter((id) => id !== accountId)
        : [...prev, accountId]
    );
  };

  const hasFilters = selectedAccounts.length > 0 || selectedSymbol;

  const clearFilters = () => {
    setSelectedAccounts([]);
    setSelectedSymbol('');
  };

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

      {/* Filters */}
      {(accounts.length > 0 || symbols.length > 0) && (
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* Filters Label */}
              <div className="flex items-center gap-2 mr-2">
                <Filter className="h-5 w-5" />
                <span className="font-semibold">{tStats('filters')}</span>
              </div>

              {/* Accounts */}
              {accounts.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {accounts.map((account) => (
                    <Badge
                      key={account.id}
                      variant={selectedAccounts.includes(account.id) ? 'default' : 'outline'}
                      className="cursor-pointer text-xs"
                      style={
                        selectedAccounts.includes(account.id)
                          ? { backgroundColor: account.color }
                          : { borderColor: account.color, color: account.color }
                      }
                      onClick={() => toggleAccount(account.id)}
                    >
                      {account.name}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Symbol */}
              {symbols.length > 0 && (
                <Select 
                  value={selectedSymbol || '__all__'} 
                  onValueChange={(v) => setSelectedSymbol(v === '__all__' ? '' : v)}
                >
                  <SelectTrigger className="w-[130px] h-9">
                    <SelectValue placeholder={tStats('symbol')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{tStats('allSymbols')}</SelectItem>
                    {symbols.map((symbol) => (
                      <SelectItem key={symbol} value={symbol}>
                        {symbol}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Clear filters */}
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  {tCommon('reset')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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
                const isToday = today ? today.toDateString() === day.toDateString() : false;
                
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
            dateStr={formatDateForServer(selectedDate)}
            timezoneOffset={getTimezoneOffset()}
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
            {t('tradesOfDay')} ({filteredTrades.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTrades.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {t('noTradesThisDay')}
            </p>
          ) : (
            <div className="space-y-3">
              {filteredTrades.map((trade) => (
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
  timezoneOffset,
  note,
  onNoteChange,
  screenshots,
  onScreenshotsChange,
  isSaving,
  onSave,
}: {
  dateStr: string;
  timezoneOffset: number;
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
      const newScreenshot = await uploadDayScreenshot(dateStr, formData, timezoneOffset);
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
