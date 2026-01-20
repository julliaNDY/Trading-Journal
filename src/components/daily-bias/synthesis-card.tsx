/**
 * Synthesis Card Component (Step 6/6)
 * 
 * Displays final bias synthesis with confidence and opening confirmation
 * This is the culmination of all 6 analysis steps
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, Target, AlertTriangle } from 'lucide-react';
import type { Synthesis } from '@/types/daily-bias';

interface SynthesisCardProps {
  synthesis: Synthesis;
  loading?: boolean;
  className?: string;
}

export function SynthesisCard({ synthesis, loading = false, className = '' }: SynthesisCardProps) {
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Final Bias Synthesis
          </CardTitle>
          <CardDescription>Computing final bias...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-4 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const biasConfig = {
    BULLISH: {
      icon: TrendingUp,
      color: 'bg-green-500/10 text-green-500 border-green-500/20',
      gradient: 'from-green-500/20 to-green-500/5'
    },
    BEARISH: {
      icon: TrendingDown,
      color: 'bg-red-500/10 text-red-500 border-red-500/20',
      gradient: 'from-red-500/20 to-red-500/5'
    },
    NEUTRAL: {
      icon: Minus,
      color: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
      gradient: 'from-gray-500/20 to-gray-500/5'
    }
  };
  
  const config = biasConfig[synthesis.finalBias];
  const BiasIcon = config.icon;
  
  return (
    <Card className={`${className} border-2`}>
      <CardHeader className={`bg-gradient-to-r ${config.gradient}`}>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Final Bias Synthesis
          </span>
          <Badge variant="outline" className={`${config.color} text-lg px-4 py-1`}>
            <BiasIcon className="h-4 w-4 mr-2" />
            {synthesis.finalBias}
          </Badge>
        </CardTitle>
        <CardDescription>
          {synthesis.instrument} • {new Date(synthesis.timestamp).toLocaleString()}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6 mt-4">
        {/* Confidence Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Confidence</span>
            <span className="text-muted-foreground font-bold">{synthesis.confidence}%</span>
          </div>
          <div className="relative h-3 bg-muted rounded-full overflow-hidden">
            <div 
              className={`absolute inset-y-0 left-0 bg-gradient-to-r ${config.gradient} transition-all`}
              style={{ width: `${synthesis.confidence}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {synthesis.confidence >= 80 ? 'High confidence - Strong signal' :
             synthesis.confidence >= 60 ? 'Moderate confidence - Decent signal' :
             synthesis.confidence >= 40 ? 'Low confidence - Weak signal' :
             'Very low confidence - Avoid trading'}
          </p>
        </div>
        
        {/* Summary */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Analysis Summary</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {synthesis.summary}
          </p>
        </div>
        
        {/* Opening Confirmation */}
        {synthesis.openingConfirmation && (
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-primary" />
              Opening Confirmation Checklist
            </h4>
            
            {/* Key Levels */}
            {synthesis.openingConfirmation.keyLevels && synthesis.openingConfirmation.keyLevels.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Key Price Levels to Watch</p>
                <div className="flex flex-wrap gap-2">
                  {synthesis.openingConfirmation.keyLevels.map((level, idx) => (
                    <Badge key={idx} variant="outline" className="font-mono">
                      ${typeof level === 'number' ? level.toFixed(2) : level}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {/* Conditions */}
            {synthesis.openingConfirmation.conditions && synthesis.openingConfirmation.conditions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Entry Conditions</p>
                <ul className="space-y-1.5">
                  {synthesis.openingConfirmation.conditions.map((condition, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{condition}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Timeframe */}
            {synthesis.openingConfirmation.timeframe && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs text-muted-foreground">
                  <strong>Timeframe:</strong> {synthesis.openingConfirmation.timeframe}
                </p>
              </div>
            )}
          </div>
        )}
        
        {/* Risk/Reward */}
        {synthesis.riskReward && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Risk Management</h4>
            <div className="grid grid-cols-2 gap-4">
              {synthesis.riskReward.expectedMove && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Expected Move</p>
                  <p className="text-sm font-medium">±${synthesis.riskReward.expectedMove}</p>
                </div>
              )}
              {synthesis.riskReward.riskLevel && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Risk Level</p>
                  <Badge variant="outline" className={
                    synthesis.riskReward.riskLevel === 'LOW' ? 'bg-green-500/10 text-green-500' :
                    synthesis.riskReward.riskLevel === 'MEDIUM' ? 'bg-yellow-500/10 text-yellow-500' :
                    'bg-red-500/10 text-red-500'
                  }>
                    {synthesis.riskReward.riskLevel}
                  </Badge>
                </div>
              )}
              {synthesis.riskReward.positionSizing && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Position Sizing</p>
                  <p className="text-sm font-medium">{synthesis.riskReward.positionSizing}</p>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Warning for low confidence */}
        {synthesis.confidence < 40 && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-destructive">Low Confidence Signal</p>
              <p className="text-xs text-muted-foreground">
                This analysis has low confidence. Consider waiting for clearer signals or reducing position size significantly.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
