'use client';

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useLocale, useTranslations } from 'next-intl';
import type { EquityPoint } from '@/services/stats-service';
import { formatCurrency, formatDate } from '@/lib/utils';

interface EquityChartProps {
  data: EquityPoint[];
}

export function EquityChart({ data }: EquityChartProps) {
  const locale = useLocale();
  const t = useTranslations('dashboard');
  const dateLocale = locale === 'en' ? 'en-GB' : 'fr-FR';
  
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        {t('noTrades')}
      </div>
    );
  }

  const isPositive = data[data.length - 1]?.cumPnl >= 0;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorPositive" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorNegative" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          tickFormatter={(value) => formatDate(value, dateLocale)}
          minTickGap={50}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          tickFormatter={(value) => formatCurrency(value)}
          width={80}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const data = payload[0].payload as EquityPoint;
              return (
                <div className="rounded-lg border bg-background p-3 shadow-lg">
                  <p className="text-sm text-muted-foreground">
                    {formatDate(data.date, dateLocale)}
                  </p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(data.cumPnl)}
                  </p>
                  <p
                    className={`text-sm ${
                      data.pnl >= 0 ? 'text-success' : 'text-destructive'
                    }`}
                  >
                    {locale === 'en' ? 'Day' : 'Jour'}: {data.pnl >= 0 ? '+' : ''}
                    {formatCurrency(data.pnl)}
                  </p>
                </div>
              );
            }
            return null;
          }}
        />
        <Area
          type="monotone"
          dataKey="cumPnl"
          stroke={isPositive ? 'hsl(var(--success))' : 'hsl(var(--destructive))'}
          strokeWidth={2}
          fill={isPositive ? 'url(#colorPositive)' : 'url(#colorNegative)'}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

