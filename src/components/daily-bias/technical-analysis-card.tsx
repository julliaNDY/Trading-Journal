/**
 * Technical Analysis Card Component (Step 5/6)
 * Displays support/resistance levels and technical indicators
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, TrendingUp, TrendingDown } from 'lucide-react';
import { TechnicalChart } from '@/components/daily-bias/charts';
import type { TechnicalAnalysis } from '@/types/daily-bias';
import type { CandlestickData, Time } from 'lightweight-charts';

interface TechnicalAnalysisCardProps {
  analysis: TechnicalAnalysis;
  loading?: boolean;
  className?: string;
  priceData?: CandlestickData<Time>[]; // Optional OHLCV data for chart
}

export function TechnicalAnalysisCard({ analysis, loading = false, className = '', priceData }: TechnicalAnalysisCardProps) {
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Technical Structure
          </CardTitle>
          <CardDescription>Analyzing technical levels...</CardDescription>
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
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Technical Structure
          </span>
          <Badge variant="outline">
            Score: {analysis.technicalScore}/10
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
      
      <CardContent className="space-y-6">
        {/* Technical Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Technical Score</span>
            <span className="text-muted-foreground">{analysis.technicalScore}/10</span>
          </div>
          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="absolute inset-y-0 left-0 bg-primary transition-all"
              style={{ width: `${(analysis.technicalScore / 10) * 100}%` }}
            />
          </div>
        </div>
        
        {/* Trend */}
        {analysis.trend && (
          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Trend</span>
              <Badge variant="outline" className={
                analysis.trend.direction === 'UPTREND' ? 'bg-green-500/10 text-green-500' :
                analysis.trend.direction === 'DOWNTREND' ? 'bg-red-500/10 text-red-500' :
                'bg-gray-500/10 text-gray-500'
              }>
                {analysis.trend.direction}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Strength</span>
              <span>{(analysis.trend.strength * 100).toFixed(0)}%</span>
            </div>
            <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
              <div 
                className="absolute inset-y-0 left-0 bg-primary transition-all"
                style={{ width: `${analysis.trend.strength * 100}%` }}
              />
            </div>
          </div>
        )}
        
        {/* Support Levels */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-green-500" />
            Support Levels
          </h4>
          {analysis.supportLevels && analysis.supportLevels.length > 0 ? (
            <div className="space-y-1.5">
              {analysis.supportLevels.slice(0, 3).map((level, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-green-500/5 border border-green-500/20 rounded">
                  <span className="text-sm font-mono">${level.price.toFixed(2)}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{level.type}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {(level.strength * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No support levels detected</p>
          )}
        </div>
        
        {/* Resistance Levels */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-red-500" />
            Resistance Levels
          </h4>
          {analysis.resistanceLevels && analysis.resistanceLevels.length > 0 ? (
            <div className="space-y-1.5">
              {analysis.resistanceLevels.slice(0, 3).map((level, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-red-500/5 border border-red-500/20 rounded">
                  <span className="text-sm font-mono">${level.price.toFixed(2)}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{level.type}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {(level.strength * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No resistance levels detected</p>
          )}
        </div>
        
        {/* Key Drivers - Transparency Enhancement */}
        {(analysis as any).keyDrivers && (analysis as any).keyDrivers.length > 0 && (
          <div className="space-y-2 p-3 bg-muted/30 rounded-lg border border-muted">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Key Drivers
            </h4>
            <div className="space-y-1.5">
              {(analysis as any).keyDrivers.slice(0, 4).map((driver: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-background/50 rounded">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={
                      driver.signal === 'bullish' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                      driver.signal === 'bearish' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                      'bg-gray-500/10 text-gray-500 border-gray-500/20'
                    }>
                      {driver.signal.toUpperCase()}
                    </Badge>
                    <span className="text-sm font-medium">{driver.indicator}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{driver.value}</span>
                    <Badge variant="secondary" className="text-xs">
                      {driver.weight}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Indicators */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Indicators</h4>
          {analysis.indicators && analysis.indicators.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {analysis.indicators.slice(0, 5).map((indicator, idx) => (
                <Badge key={idx} variant="secondary" className={
                  indicator.signal === 'BULLISH_CROSS' ? 'bg-green-500/10 text-green-500' :
                  indicator.signal === 'BEARISH_CROSS' ? 'bg-red-500/10 text-red-500' :
                  ''
                }>
                  {indicator.name}: {indicator.value.toFixed(2)}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No indicator signals detected</p>
          )}
        </div>
        
        {/* Technical Chart - TradingView Lightweight Charts */}
        {priceData && priceData.length > 0 && (
          <div className="space-y-2 mt-6">
            <h4 className="text-sm font-medium">Price Chart with Support/Resistance</h4>
            <TechnicalChart 
              analysis={analysis} 
              priceData={priceData}
              height={300}
              className="w-full"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
