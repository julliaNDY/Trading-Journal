'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  Target,
  BarChart3,
  Clock,
  Upload,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency, formatNumber, formatPercent, formatDurationWithSeconds } from '@/lib/utils';
import type { GlobalStats, EquityPoint, HourlyStats, FiveMinuteStats } from '@/services/stats-service';
import type { Trade } from '@prisma/client';
import { EquityChart } from '@/components/charts/equity-chart';
import { HourlyChart } from '@/components/charts/hourly-chart';
import { cn } from '@/lib/utils';

interface DashboardContentProps {
  stats: GlobalStats;
  equityCurve: EquityPoint[];
  hourlyStats: HourlyStats[];
  fiveMinuteStats: FiveMinuteStats[];
  trades: Trade[];
}

function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  subtitle,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  subtitle?: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p
              className={cn(
                'text-2xl font-bold',
                trend === 'up' && 'text-success',
                trend === 'down' && 'text-destructive'
              )}
            >
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div
            className={cn(
              'p-3 rounded-lg',
              trend === 'up' && 'bg-success/10 text-success',
              trend === 'down' && 'bg-destructive/10 text-destructive',
              (!trend || trend === 'neutral') && 'bg-muted text-muted-foreground'
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  const t = useTranslations('dashboard');

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
      <div className="p-6 rounded-full bg-muted">
        <BarChart3 className="h-12 w-12 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">{t('noTrades')}</h2>
        <p className="text-muted-foreground max-w-md">{t('importCta')}</p>
      </div>
      <Button asChild size="lg">
        <Link href="/importer">
          <Upload className="mr-2 h-5 w-5" />
          {t('importCta').split(' ')[0]}
        </Link>
      </Button>
    </div>
  );
}

export function DashboardContent({
  stats,
  equityCurve,
  hourlyStats,
  fiveMinuteStats,
  trades,
}: DashboardContentProps) {
  const t = useTranslations('dashboard');

  if (stats.totalTrades === 0) {
    return <EmptyState />;
  }

  const pnlTrend = stats.totalPnl >= 0 ? 'up' : 'down';

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('overview')}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/importer">
            <Upload className="mr-2 h-4 w-4" />
            {t('importCta').split(' ')[0]}
          </Link>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t('totalPnl')}
          value={formatCurrency(stats.totalPnl)}
          icon={pnlTrend === 'up' ? TrendingUp : TrendingDown}
          trend={pnlTrend}
          subtitle={`${stats.totalTrades} ${t('trades').toLowerCase()}`}
        />
        <StatCard
          title={t('profitFactor')}
          value={formatNumber(stats.profitFactor, 2)}
          icon={Target}
          trend={stats.profitFactor >= 1.5 ? 'up' : stats.profitFactor >= 1 ? 'neutral' : 'down'}
          subtitle={`${t('profitFactorIndex')}: ${formatNumber(stats.profitFactorIndex, 1)}`}
        />
        <StatCard
          title={t('winRate')}
          value={formatPercent(stats.winRate)}
          icon={BarChart3}
          trend={stats.winRate >= 50 ? 'up' : 'down'}
          subtitle={`${stats.winningTrades} TP / ${stats.losingTrades} SL${stats.breakevenTrades > 0 ? ` / ${stats.breakevenTrades} BE` : ''}`}
        />
        <StatCard
          title={t('averageRR')}
          value={stats.averageRR ? formatNumber(stats.averageRR, 2) : 'N/A'}
          icon={Clock}
          trend={stats.averageRR && stats.averageRR >= 1.5 ? 'up' : 'neutral'}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{t('averageWin')}</p>
              <p className="text-xl font-semibold text-success">
                +{formatCurrency(stats.averageWin)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{t('averageLoss')}</p>
              <p className="text-xl font-semibold text-destructive">
                -{formatCurrency(stats.averageLoss)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{t('totalTrades')}</p>
              <p className="text-xl font-semibold">{stats.totalTrades}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Equity Curve */}
      <Card>
        <CardHeader>
          <CardTitle>{t('equityCurve')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList>
              <TabsTrigger value="all">{t('allTime')}</TabsTrigger>
              <TabsTrigger value="monthly">{t('monthly')}</TabsTrigger>
              <TabsTrigger value="weekly">{t('weekly')}</TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="h-[400px]">
              <EquityChart data={equityCurve} />
            </TabsContent>
            <TabsContent value="monthly" className="h-[400px]">
              <EquityChart data={equityCurve} />
            </TabsContent>
            <TabsContent value="weekly" className="h-[400px]">
              <EquityChart data={equityCurve} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Time of Day Profitability */}
      <Card>
        <CardHeader>
          <CardTitle>{t('timeOfDayProfitability')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <HourlyChart data={hourlyStats} />
          </div>
        </CardContent>
      </Card>

      {/* 5-Minute Stats Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('timeOfDayProfitability')}</CardTitle>
        </CardHeader>
        <CardContent>
          {fiveMinuteStats.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {t('noTradesWithTimes')}
            </p>
          ) : (
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b">
                    <th className="text-left py-3 px-2">{t('hour')}</th>
                    <th className="text-right py-3 px-2">{t('trades')}</th>
                    <th className="text-right py-3 px-2">{t('pnl')}</th>
                    <th className="text-right py-3 px-2">{t('avgPnl')}</th>
                  </tr>
                </thead>
                <tbody>
                  {fiveMinuteStats.map((stat) => (
                    <tr key={stat.timeSlot} className="border-b border-border/50">
                      <td className="py-2 px-2 font-medium">
                        {stat.timeSlot}
                      </td>
                      <td className="text-right py-2 px-2">{stat.trades}</td>
                      <td
                        className={cn(
                          'text-right py-2 px-2',
                          stat.totalPnl >= 0 ? 'text-success' : 'text-destructive'
                        )}
                      >
                        {formatCurrency(stat.totalPnl)}
                      </td>
                      <td
                        className={cn(
                          'text-right py-2 px-2',
                          stat.avgPnl >= 0 ? 'text-success' : 'text-destructive'
                        )}
                      >
                        {formatCurrency(stat.avgPnl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Average Duration - only if available */}
      {stats.averageDurationSeconds !== null && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{t('avgDuration')}</p>
              <p className="text-xl font-semibold">
                {formatDurationWithSeconds(stats.averageDurationSeconds)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

