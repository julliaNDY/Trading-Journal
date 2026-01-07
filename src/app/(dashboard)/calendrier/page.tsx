import { Suspense } from 'react';
import { getUser } from '@/lib/auth';
import { getTrades, serializeTrades } from '@/services/trade-service';
import { calculateDailyPnl } from '@/services/stats-service';
import { CalendarContent } from './calendar-content';
import { Loader2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

async function CalendarData() {
  const user = await getUser();
  if (!user) return null;

  const trades = await getTrades({ userId: user.id });
  const serializedTrades = serializeTrades(trades);
  const dailyPnl = calculateDailyPnl(trades);

  return <CalendarContent dailyPnl={dailyPnl} trades={serializedTrades} />;
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export default function CalendrierPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <CalendarData />
    </Suspense>
  );
}






