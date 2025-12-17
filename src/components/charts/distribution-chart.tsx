'use client';

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { useTranslations } from 'next-intl';

interface DistributionChartProps {
  data: {
    wins: number;
    losses: number;
    breakeven: number;
  };
}

export function DistributionChart({ data }: DistributionChartProps) {
  const t = useTranslations('statistics');
  const total = data.wins + data.losses + data.breakeven;

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        {t('noDataAvailable')}
      </div>
    );
  }

  const chartData = [
    { name: t('wins'), value: data.wins, color: 'hsl(var(--success))' },
    { name: t('losses'), value: data.losses, color: 'hsl(var(--destructive))' },
    { name: t('breakeven'), value: data.breakeven, color: 'hsl(var(--muted-foreground))' },
  ].filter((d) => d.value > 0);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const item = payload[0].payload;
              const percentage = ((item.value / total) * 100).toFixed(1);
              return (
                <div className="rounded-lg border bg-background p-3 shadow-lg">
                  <p className="font-medium">{item.name}</p>
                  <p className="text-lg font-semibold">
                    {item.value} ({percentage}%)
                  </p>
                </div>
              );
            }
            return null;
          }}
        />
        <Legend
          formatter={(value, entry) => {
            const item = chartData.find((d) => d.name === value);
            if (item) {
              return (
                <span style={{ color: 'hsl(var(--foreground))' }}>
                  {value}: {item.value}
                </span>
              );
            }
            return value;
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}






