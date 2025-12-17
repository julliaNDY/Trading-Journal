import { Suspense } from 'react';
import { getUser } from '@/lib/auth';
import { getTrades } from '@/services/trade-service';
import {
  calculateGlobalStats,
  calculateEquityCurve,
  calculateHourlyStats,
  calculateFiveMinuteStats,
} from '@/services/stats-service';
import { DashboardContent } from './dashboard-content';
import { Loader2 } from 'lucide-react';

async function DashboardData() {
  const user = await getUser();
  if (!user) return null;

  const trades = await getTrades({ userId: user.id });
  const stats = calculateGlobalStats(trades);
  const equityCurve = calculateEquityCurve(trades);
  const hourlyStats = calculateHourlyStats(trades);
  const fiveMinuteStats = calculateFiveMinuteStats(trades);

  return (
    <DashboardContent
      stats={stats}
      equityCurve={equityCurve}
      hourlyStats={hourlyStats}
      fiveMinuteStats={fiveMinuteStats}
      trades={trades}
    />
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <DashboardData />
    </Suspense>
  );
}






