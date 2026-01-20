/**
 * Macro Analysis Card Component (Step 2/6)
 * 
 * Displays macroeconomic analysis results
 * Shows economic events, sentiment, and macro score
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, TrendingUp, AlertCircle } from 'lucide-react';
import type { MacroAnalysis } from '@/types/daily-bias';

interface MacroAnalysisCardProps {
  analysis: MacroAnalysis;
  loading?: boolean;
  className?: string;
}

export function MacroAnalysisCard({ analysis, loading = false, className = '' }: MacroAnalysisCardProps) {
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Macro Analysis
          </CardTitle>
          <CardDescription>Analyzing economic events...</CardDescription>
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
  
  const sentimentColors = {
    VERY_BEARISH: 'bg-red-500/10 text-red-500',
    BEARISH: 'bg-orange-500/10 text-orange-500',
    NEUTRAL: 'bg-gray-500/10 text-gray-500',
    BULLISH: 'bg-green-500/10 text-green-500',
    VERY_BULLISH: 'bg-emerald-500/10 text-emerald-500'
  };
  
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Macro Analysis
          </span>
          <Badge variant="outline" className={sentimentColors[analysis.sentiment]}>
            {analysis.sentiment.replace('_', ' ')}
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
        {/* Macro Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Macro Score</span>
            <span className="text-muted-foreground">{analysis.macroScore}/10</span>
          </div>
          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="absolute inset-y-0 left-0 bg-primary transition-all"
              style={{ width: `${(analysis.macroScore / 10) * 100}%` }}
            />
          </div>
        </div>
        
        {/* Economic Events */}
        {analysis.economicEvents && analysis.economicEvents.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Economic Events Today
            </h4>
            <div className="space-y-2">
              {analysis.economicEvents.slice(0, 5).map((event, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <Badge 
                    variant="outline"
                    className={
                      event.importance === 'CRITICAL' ? 'bg-red-500/10 text-red-500' :
                      event.importance === 'HIGH' ? 'bg-orange-500/10 text-orange-500' :
                      event.importance === 'MEDIUM' ? 'bg-yellow-500/10 text-yellow-500' :
                      'bg-gray-500/10 text-gray-500'
                    }
                  >
                    {event.importance}
                  </Badge>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{event.event}</span>
                      <span className="text-xs text-muted-foreground">{event.time}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {event.country}
                      {event.forecast && ` • Forecast: ${event.forecast}`}
                      {event.previous && ` • Previous: ${event.previous}`}
                    </div>
                    {event.impactOnInstrument && (
                      <p className="text-xs text-muted-foreground italic mt-1">
                        {event.impactOnInstrument}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Analysis Summary */}
        {analysis.analysis?.summary && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Summary</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {analysis.analysis.summary}
            </p>
          </div>
        )}
        
        {/* Key Themes */}
        {analysis.analysis?.keyThemes && analysis.analysis.keyThemes.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Key Themes</h4>
            <div className="flex flex-wrap gap-2">
              {analysis.analysis.keyThemes.map((theme, idx) => (
                <Badge key={idx} variant="secondary">
                  {theme}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
