'use client';

import { useState, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Filter, X } from 'lucide-react';
import { cn, formatCurrency, formatNumber, formatDate, formatDurationWithSeconds } from '@/lib/utils';
import {
  calculateGlobalStats,
  calculateEquityCurve,
  calculateHourlyStats,
  getDistribution,
} from '@/services/stats-service';
import { EquityChart } from '@/components/charts/equity-chart';
import { HourlyChart } from '@/components/charts/hourly-chart';
import { DistributionChart } from '@/components/charts/distribution-chart';
import type { Trade, Tag } from '@prisma/client';

interface TradeWithTags extends Trade {
  tags: { tag: { id: string; name: string; color: string } }[];
}

interface StatisticsContentProps {
  initialTrades: TradeWithTags[];
  symbols: string[];
  tags: Tag[];
}

export function StatisticsContent({
  initialTrades,
  symbols,
  tags,
}: StatisticsContentProps) {
  const t = useTranslations('statistics');
  const locale = useLocale();
  const dateLocale = locale === 'en' ? 'en-GB' : 'fr-FR';

  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Filter trades based on criteria
  const filteredTrades = useMemo(() => {
    return initialTrades.filter((trade) => {
      // Date filter
      if (dateRange.from) {
        const closedAt = new Date(trade.closedAt);
        if (closedAt < dateRange.from) return false;
      }
      if (dateRange.to) {
        const closedAt = new Date(trade.closedAt);
        const endOfDay = new Date(dateRange.to);
        endOfDay.setHours(23, 59, 59, 999);
        if (closedAt > endOfDay) return false;
      }

      // Symbol filter
      if (selectedSymbol && trade.symbol !== selectedSymbol) return false;

      // Tags filter
      if (selectedTags.length > 0) {
        const tradeTagIds = trade.tags.map((t) => t.tag.id);
        if (!selectedTags.some((tagId) => tradeTagIds.includes(tagId))) {
          return false;
        }
      }

      return true;
    });
  }, [initialTrades, dateRange, selectedSymbol, selectedTags]);

  // Calculate stats
  const stats = useMemo(() => calculateGlobalStats(filteredTrades), [filteredTrades]);
  const equityCurve = useMemo(() => calculateEquityCurve(filteredTrades), [filteredTrades]);
  const hourlyStats = useMemo(() => calculateHourlyStats(filteredTrades), [filteredTrades]);
  const distribution = useMemo(() => getDistribution(filteredTrades), [filteredTrades]);

  const clearFilters = () => {
    setDateRange({});
    setSelectedSymbol('');
    setSelectedTags([]);
  };

  const hasFilters = dateRange.from || dateRange.to || selectedSymbol || selectedTags.length > 0;

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">
            {filteredTrades.length} trades analysés
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            {t('filters')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            {/* Date Range */}
            <div className="space-y-2">
              <Label>{t('dateRange')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-[240px] justify-start text-left font-normal',
                      !dateRange.from && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from ? (
                      dateRange.to ? (
                        <>
                          {formatDate(dateRange.from, dateLocale)} - {formatDate(dateRange.to, dateLocale)}
                        </>
                      ) : (
                        formatDate(dateRange.from, dateLocale)
                      )
                    ) : (
                      'Sélectionner'
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange.from}
                    selected={{ from: dateRange.from, to: dateRange.to }}
                    onSelect={(range) =>
                      setDateRange({ from: range?.from, to: range?.to })
                    }
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Symbol */}
            <div className="space-y-2">
              <Label>{t('symbol')}</Label>
              <Select 
                value={selectedSymbol || '__all__'} 
                onValueChange={(v) => setSelectedSymbol(v === '__all__' ? '' : v)}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tous</SelectItem>
                  {symbols.map((symbol) => (
                    <SelectItem key={symbol} value={symbol}>
                      {symbol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label>{t('tags')}</Label>
              <div className="flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant={selectedTags.includes(tag.id) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    style={
                      selectedTags.includes(tag.id)
                        ? { backgroundColor: tag.color }
                        : { borderColor: tag.color, color: tag.color }
                    }
                    onClick={() => toggleTag(tag.id)}
                  >
                    {tag.name}
                  </Badge>
                ))}
                {tags.length === 0 && (
                  <span className="text-sm text-muted-foreground">Aucun tag</span>
                )}
              </div>
            </div>

            {/* Clear Filters */}
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                {t('clearFilters')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t('profitFactor')}
          value={formatNumber(stats.profitFactor, 2)}
          subValue={`Index: ${formatNumber(stats.profitFactorIndex, 1)}/10`}
          trend={stats.profitFactor >= 1.5 ? 'up' : stats.profitFactor >= 1 ? 'neutral' : 'down'}
        />
        <StatCard
          label={t('averageWin')}
          value={formatCurrency(stats.averageWin)}
          subValue={`${stats.winningTrades} trades gagnants`}
          trend="up"
        />
        <StatCard
          label={t('averageLoss')}
          value={formatCurrency(stats.averageLoss)}
          subValue={`${stats.losingTrades} trades perdants`}
          trend="down"
        />
        <StatCard
          label={t('averageRR')}
          value={stats.averageRR ? formatNumber(stats.averageRR, 2) : 'N/A'}
          subValue="Risk/Reward moyen"
          trend={stats.averageRR && stats.averageRR >= 1.5 ? 'up' : 'neutral'}
        />
      </div>

      {/* Performance Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">{t('bestDay')}</p>
            {stats.bestDay ? (
              <>
                <p className="text-xl font-bold text-success">
                  +{formatCurrency(stats.bestDay.pnl)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(stats.bestDay.date, dateLocale)}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">-</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">{t('worstDay')}</p>
            {stats.worstDay ? (
              <>
                <p className="text-xl font-bold text-destructive">
                  {formatCurrency(stats.worstDay.pnl)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(stats.worstDay.date, dateLocale)}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">-</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">{t('avgDuration')}</p>
            <p className="text-xl font-bold">
              {formatDurationWithSeconds(stats.averageDurationSeconds)}
            </p>
            <p className="text-sm text-muted-foreground">par trade</p>
          </CardContent>
        </Card>
      </div>

      {/* Equity Curve */}
      <Card>
        <CardHeader>
          <CardTitle>{t('equityCurve')}</CardTitle>
        </CardHeader>
        <CardContent className="h-[400px]">
          <EquityChart data={equityCurve} />
        </CardContent>
      </Card>

      {/* Distribution & Hourly */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('distribution')}</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <DistributionChart data={distribution} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('profitByHour')}</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <HourlyChart data={hourlyStats} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  subValue,
  trend,
}: {
  label: string;
  value: string;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p
          className={cn(
            'text-2xl font-bold',
            trend === 'up' && 'text-success',
            trend === 'down' && 'text-destructive'
          )}
        >
          {value}
        </p>
        {subValue && (
          <p className="text-sm text-muted-foreground">{subValue}</p>
        )}
      </CardContent>
    </Card>
  );
}

