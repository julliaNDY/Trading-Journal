'use client';

/**
 * Lazy-loaded Chart Components
 * 
 * These components are loaded dynamically to reduce initial bundle size.
 * Uses Next.js dynamic imports with SSR disabled since charts need client-side rendering.
 */

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

// Loading skeleton for charts
function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="w-full animate-pulse" style={{ height }}>
      <Skeleton className="w-full h-full rounded-lg" />
    </div>
  );
}

/**
 * Lazy-loaded Equity Chart (Recharts)
 * Bundle: ~150KB saved on initial load
 */
export const LazyEquityChart = dynamic(
  () => import('./equity-chart').then(mod => ({ default: mod.EquityChart })),
  {
    ssr: false,
    loading: () => <ChartSkeleton height={300} />,
  }
);

/**
 * Lazy-loaded Hourly Chart (Recharts)
 * Bundle: ~150KB saved on initial load (shared with EquityChart if loaded together)
 */
export const LazyHourlyChart = dynamic(
  () => import('./hourly-chart').then(mod => ({ default: mod.HourlyChart })),
  {
    ssr: false,
    loading: () => <ChartSkeleton height={350} />,
  }
);

/**
 * Lazy-loaded Distribution Chart (Recharts)
 * Bundle: ~150KB saved on initial load
 */
export const LazyDistributionChart = dynamic(
  () => import('./distribution-chart').then(mod => ({ default: mod.DistributionChart })),
  {
    ssr: false,
    loading: () => <ChartSkeleton height={300} />,
  }
);

/**
 * Lazy-loaded Trade Chart (Lightweight Charts)
 * Bundle: ~80KB saved on initial load
 */
export const LazyTradeChart = dynamic(
  () => import('./trade-chart').then(mod => ({ default: mod.TradeChart })),
  {
    ssr: false,
    loading: () => <ChartSkeleton height={400} />,
  }
);

