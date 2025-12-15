'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn, formatCurrency } from '@/lib/utils';
import type { DailyPnl } from '@/services/stats-service';
import type { Trade } from '@prisma/client';

interface CalendarContentProps {
  dailyPnl: DailyPnl[];
  trades: Trade[];
}

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export function CalendarContent({ dailyPnl, trades }: CalendarContentProps) {
  const t = useTranslations('calendar');
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());

  // Create a map of date -> pnl for quick lookup
  const pnlMap = useMemo(() => {
    const map = new Map<string, DailyPnl>();
    dailyPnl.forEach((d) => map.set(d.date, d));
    return map;
  }, [dailyPnl]);

  // Get calendar days for current month
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Get the day of week for the first day (0 = Sunday, convert to Monday = 0)
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek < 0) startDayOfWeek = 6;

    const days: (Date | null)[] = [];

    // Add empty slots for days before the first of the month
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }

    return days;
  }, [currentDate]);

  // Calculate monthly totals
  const monthlyStats = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthStr = `${year}-${(month + 1).toString().padStart(2, '0')}`;

    const monthDays = dailyPnl.filter((d) => d.date.startsWith(monthStr));
    const totalPnl = monthDays.reduce((sum, d) => sum + d.pnl, 0);
    const totalTrades = monthDays.reduce((sum, d) => sum + d.tradesCount, 0);
    const winDays = monthDays.filter((d) => d.pnl > 0).length;
    const lossDays = monthDays.filter((d) => d.pnl < 0).length;

    return { totalPnl, totalTrades, winDays, lossDays, tradingDays: monthDays.length };
  }, [currentDate, dailyPnl]);

  const goToPrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleDayClick = (day: Date) => {
    // Navigate to journal with the selected date
    const year = day.getFullYear();
    const month = String(day.getMonth() + 1).padStart(2, '0');
    const dayNum = String(day.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${dayNum}`;
    router.push(`/journal?date=${dateStr}`);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('dailyPnl')}</p>
      </div>

      {/* Monthly Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t('monthlyPnl')}</p>
            <p
              className={cn(
                'text-2xl font-bold',
                monthlyStats.totalPnl >= 0 ? 'text-success' : 'text-destructive'
              )}
            >
              {monthlyStats.totalPnl >= 0 ? '+' : ''}
              {formatCurrency(monthlyStats.totalPnl)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Trades</p>
            <p className="text-2xl font-bold">{monthlyStats.totalTrades}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Jours gagnants</p>
            <p className="text-2xl font-bold text-success">{monthlyStats.winDays}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Jours perdants</p>
            <p className="text-2xl font-bold text-destructive">{monthlyStats.lossDays}</p>
          </CardContent>
        </Card>
      </div>

      {/* Calendar */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle>
              {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToToday}>
                Aujourd'hui
              </Button>
              <Button variant="outline" size="icon" onClick={goToPrevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={goToNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="text-center text-sm font-medium text-muted-foreground py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => {
              if (!day) {
                return <div key={`empty-${index}`} className="aspect-square" />;
              }

              // Use local date format
              const year = day.getFullYear();
              const month = String(day.getMonth() + 1).padStart(2, '0');
              const dayNum = String(day.getDate()).padStart(2, '0');
              const dateStr = `${year}-${month}-${dayNum}`;
              const dayData = pnlMap.get(dateStr);
              
              const today = new Date();
              const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
              const isToday = dateStr === todayStr;

              return (
                <button
                  key={dateStr}
                  onClick={() => handleDayClick(day)}
                  className={cn(
                    'aspect-square p-1 rounded-lg transition-colors relative',
                    'hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-primary',
                    dayData && dayData.pnl > 0 && 'bg-success/20 hover:bg-success/30',
                    dayData && dayData.pnl < 0 && 'bg-destructive/20 hover:bg-destructive/30',
                    dayData && dayData.pnl === 0 && 'bg-muted hover:bg-muted/80',
                    isToday && 'ring-2 ring-primary'
                  )}
                >
                  <div className="flex flex-col items-center justify-center h-full gap-0.5">
                    <span
                      className={cn(
                        'text-sm',
                        isToday && 'font-bold text-primary'
                      )}
                    >
                      {day.getDate()}
                    </span>
                    {dayData && (
                      <>
                        <span
                          className={cn(
                            'text-xs font-medium',
                            dayData.pnl >= 0 ? 'text-success' : 'text-destructive'
                          )}
                        >
                          {dayData.pnl >= 0 ? '+' : ''}{dayData.pnl.toFixed(0)}$
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {dayData.tradesCount} trade{dayData.tradesCount > 1 ? 's' : ''}
                        </span>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
