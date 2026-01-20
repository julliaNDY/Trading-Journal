/**
 * Mag 7 Leaders Analysis Card Component (Step 4/6)
 * Displays correlation with 7 tech leaders
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Link } from 'lucide-react';
import { Mag7CorrelationChart } from '@/components/daily-bias/charts';
import type { Mag7Analysis } from '@/types/daily-bias';
import type { LineData, Time } from 'lightweight-charts';

interface Mag7AnalysisCardProps {
  analysis: Mag7Analysis;
  loading?: boolean;
  className?: string;
  correlationData?: Record<string, LineData<Time>[]>; // Optional correlation data for chart
}

export function Mag7AnalysisCard({ analysis, loading = false, className = '', correlationData }: Mag7AnalysisCardProps) {
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Mag 7 Leaders
          </CardTitle>
          <CardDescription>Analyzing tech leader correlations...</CardDescription>
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
            <Link className="h-5 w-5 text-primary" />
            Mag 7 Leaders
          </span>
          <Badge variant="outline">
            Score: {analysis.leaderScore}/10
          </Badge>
        </CardTitle>
        <CardDescription>
          <span>{analysis.instrument} • {new Date(analysis.timestamp).toLocaleString()}</span>
          {analysis.dataSources && analysis.dataSources.length > 0 && (
            <>
              <br />
              <span className="text-xs">
                <strong>Sources:</strong> {analysis.dataSources.join(', ')}
              </span>
            </>
          )}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Leader Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Leader Score</span>
            <span className="text-muted-foreground">{analysis.leaderScore}/10</span>
          </div>
          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="absolute inset-y-0 left-0 bg-primary transition-all"
              style={{ width: `${(analysis.leaderScore / 10) * 100}%` }}
            />
          </div>
        </div>
        
        {/* Overall Sentiment */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <span className="text-sm font-medium">Overall Sentiment</span>
          <Badge variant="outline" className={
            analysis.sentiment === 'VERY_BULLISH' ? 'bg-emerald-500/10 text-emerald-500' :
            analysis.sentiment === 'BULLISH' ? 'bg-green-500/10 text-green-500' :
            analysis.sentiment === 'NEUTRAL' ? 'bg-gray-500/10 text-gray-500' :
            analysis.sentiment === 'BEARISH' ? 'bg-orange-500/10 text-orange-500' :
            'bg-red-500/10 text-red-500'
          }>
            {analysis.sentiment?.replace('_', ' ') || 'N/A'}
          </Badge>
        </div>
        
        {/* Correlations */}
        {analysis.correlations && analysis.correlations.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Top Correlations</h4>
            <div className="space-y-2">
              {analysis.correlations.slice(0, 7).map((corr, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium w-16">{corr.symbol}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {corr.performancePercent !== undefined && (
                          <span className={`text-sm ${corr.performancePercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {corr.performancePercent >= 0 ? '+' : ''}{corr.performancePercent.toFixed(2)}%
                          </span>
                        )}
                        <Badge variant="outline" className={
                          corr.trend === 'BULLISH' ? 'bg-green-500/10 text-green-500' :
                          corr.trend === 'BEARISH' ? 'bg-red-500/10 text-red-500' :
                          'bg-gray-500/10 text-gray-500'
                        }>
                          {corr.trend || 'N/A'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    r={corr.correlation?.toFixed(2) || 'N/A'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Mag 7 Correlation Chart - TradingView Lightweight Charts */}
        {correlationData && Object.keys(correlationData).length > 0 && (
          <div className="space-y-2 mt-6">
            <h4 className="text-sm font-medium">Mag 7 Correlation Chart</h4>
            <Mag7CorrelationChart 
              analysis={analysis} 
              correlationData={correlationData}
              height={250}
              className="w-full"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
