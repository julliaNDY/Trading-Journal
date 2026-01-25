/**
 * Institutional Flux Card Component (Step 3/6)
 * Displays volume profile and order flow analysis
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, TrendingUp, BarChart3 } from 'lucide-react';
import { VolumeChart } from '@/components/daily-bias/charts';
import { BiasBadge } from '@/components/daily-bias/bias-badge';
import type { InstitutionalFlux, BiasDirection } from '@/types/daily-bias';
import type { BarData, LineData, Time } from 'lightweight-charts';

interface InstitutionalFluxCardProps {
  analysis: InstitutionalFlux;
  loading?: boolean;
  className?: string;
  volumeData?: BarData<Time>[]; // Optional volume bars data for chart
  priceData?: LineData<Time>[]; // Optional price overlay
  sentiment?: BiasDirection; // NEW: Final bias sentiment from synthesis
}

export function InstitutionalFluxCard({ analysis, loading = false, className = '', volumeData, priceData, sentiment }: InstitutionalFluxCardProps) {
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Institutional Flux
          </CardTitle>
          <CardDescription>Analyzing volume and order flow...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-4 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-3">
      {/* Bias Badge */}
      {sentiment && (
        <div className="flex justify-start">
          <BiasBadge sentiment={sentiment} size="md" />
        </div>
      )}
      
      {/* Institutional Flux Card */}
      <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Institutional Flux
          </span>
          <Badge variant="outline">
            Score: {analysis.fluxScore}/10
          </Badge>
        </CardTitle>
        <CardDescription>
          <span>{analysis.instrument} • {new Date(analysis.timestamp).toLocaleString()}</span>
          {(analysis as any).dataSources && (analysis as any).dataSources.length > 0 && (
            <>
              <br />
              <span className="text-xs">
                <strong>Sources:</strong> {(analysis as any).dataSources.join(', ')}
              </span>
            </>
          )}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-8 flex flex-col h-full">
        {/* Flux Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Institutional Flux Score</span>
            <span className="text-muted-foreground">{analysis.fluxScore}/10</span>
          </div>
          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="absolute inset-y-0 left-0 bg-primary transition-all"
              style={{ width: `${(analysis.fluxScore / 10) * 100}%` }}
            />
          </div>
        </div>
        
        {/* Volume Profile */}
        {analysis.volumeProfile && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Volume Profile
            </h4>
            <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground">Total Volume</p>
                <p className="text-sm font-medium">{((analysis.volumeProfile.totalVolume || 0) / 1e9).toFixed(2)}B</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Volume Level</p>
                <Badge variant="outline" className={
                  (analysis.volumeProfile.volumeLevel || (analysis.volumeProfile.volumeRatio > 1.5 ? 'HIGH' : analysis.volumeProfile.volumeRatio > 1.2 ? 'ABOVE_AVERAGE' : 'NORMAL')) === 'EXTREMELY_HIGH' ? 'bg-red-500/10 text-red-500' :
                  (analysis.volumeProfile.volumeLevel || (analysis.volumeProfile.volumeRatio > 1.5 ? 'HIGH' : analysis.volumeProfile.volumeRatio > 1.2 ? 'ABOVE_AVERAGE' : 'NORMAL')) === 'HIGH' ? 'bg-orange-500/10 text-orange-500' :
                  (analysis.volumeProfile.volumeLevel || (analysis.volumeProfile.volumeRatio > 1.5 ? 'HIGH' : analysis.volumeProfile.volumeRatio > 1.2 ? 'ABOVE_AVERAGE' : 'NORMAL')) === 'NORMAL' ? 'bg-green-500/10 text-green-500' :
                  'bg-gray-500/10 text-gray-500'
                }>
                  {analysis.volumeProfile.volumeLevel || (analysis.volumeProfile.volumeRatio > 1.5 ? 'HIGH' : analysis.volumeProfile.volumeRatio > 1.2 ? 'ABOVE_AVERAGE' : 'NORMAL')}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Volume Trend</p>
                <Badge variant="secondary">{analysis.volumeProfile.trend || analysis.volumeProfile.volumeTrend || 'N/A'}</Badge>
              </div>
            </div>
          </div>
        )}
        
        {/* Order Flow */}
        {analysis.orderFlow && (
          <div className="space-y-3 flex-grow">
            {(() => {
              // Map API field names to expected field names
              const netFlow = analysis.orderFlow.netFlow ?? analysis.orderFlow.netOrderFlow ?? 0;
              const totalVolume = (analysis.orderFlow.buyVolume || 0) + (analysis.orderFlow.sellVolume || 0);
              const buyPressure = analysis.orderFlow.buyPressure ?? (totalVolume > 0 ? (analysis.orderFlow.buyVolume / totalVolume) * 100 : 0);
              const sellPressure = analysis.orderFlow.sellPressure ?? (totalVolume > 0 ? (analysis.orderFlow.sellVolume / totalVolume) * 100 : 0);
              const confirmation = analysis.orderFlow.confirmation || analysis.orderFlow.orderFlowTrend || 'NEUTRAL';
              
              return (
                <>
                  <h4 className="text-sm font-medium">Order Flow</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Net Flow</span>
                      <span className={`text-sm font-medium ${netFlow > 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {netFlow > 0 ? '+' : ''}{(netFlow / 1e6).toFixed(2)}M
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 bg-green-500/10 rounded">
                        <p className="text-xs text-green-500">Buy Pressure</p>
                        <p className="text-sm font-medium">{buyPressure.toFixed(0)}%</p>
                      </div>
                      <div className="p-2 bg-red-500/10 rounded">
                        <p className="text-xs text-red-500">Sell Pressure</p>
                        <p className="text-sm font-medium">{sellPressure.toFixed(0)}%</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={
                      confirmation === 'BULLISH' ? 'bg-green-500/10 text-green-500' : 
                      confirmation === 'BEARISH' ? 'bg-red-500/10 text-red-500' :
                      'bg-gray-500/10 text-gray-500'
                    }>
                      {confirmation}
                    </Badge>
                  </div>
                </>
              );
            })()}
          </div>
        )}
        
        {/* Volume Chart - TradingView Lightweight Charts */}
        {(volumeData && volumeData.length > 0) && (
          <div className="space-y-2 mt-6">
            <h4 className="text-sm font-medium">Volume Profile Chart</h4>
            <VolumeChart 
              analysis={analysis} 
              volumeData={volumeData}
              priceData={priceData}
              height={250}
              className="w-full"
            />
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  );
}
