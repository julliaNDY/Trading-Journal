'use client';

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from 'recharts';
import { useTranslations } from 'next-intl';
import type { HourlyStats } from '@/services/stats-service';
import { formatCurrency } from '@/lib/utils';

interface HourlyChartProps {
  data: HourlyStats[];
}

export function HourlyChart({ data }: HourlyChartProps) {
  const t = useTranslations('statistics');
  
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        {t('noDataAvailable')}
      </div>
    );
  }

  const filteredData = data.filter((d) => d.trades > 0);

  if (filteredData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        {t('noDataAvailable')}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={filteredData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <XAxis
          dataKey="hour"
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          tickFormatter={(value) => `${value}h`}
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
              const data = payload[0].payload as HourlyStats;
              return (
                <div className="rounded-lg border bg-background p-3 shadow-lg">
                  <p className="text-sm font-medium">
                    {data.hour.toString().padStart(2, '0')}:00 -{' '}
                    {(data.hour + 1).toString().padStart(2, '0')}:00
                  </p>
                  <p
                    className={`text-lg font-semibold ${
                      data.totalPnl >= 0 ? 'text-success' : 'text-destructive'
                    }`}
                  >
                    {formatCurrency(data.totalPnl)}
                  </p>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>{t('trades')}: {data.trades}</p>
                    <p>{t('avg')}: {formatCurrency(data.avgPnl)}</p>
                    <p>{t('winRate')}: {data.winRate.toFixed(0)}%</p>
                  </div>
                </div>
              );
            }
            return null;
          }}
        />
        <Bar dataKey="totalPnl" radius={[4, 4, 0, 0]}>
          {filteredData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={
                entry.totalPnl >= 0
                  ? 'hsl(var(--success))'
                  : 'hsl(var(--destructive))'
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}






