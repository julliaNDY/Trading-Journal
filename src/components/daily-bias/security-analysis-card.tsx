/**
 * Security Analysis Card Component
 * 
 * Displays Step 1 (Security Analysis) results in a card format
 * Shows volatility index, risk level, security score, and recommendations
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, ShieldAlert, ShieldCheck, TrendingDown, TrendingUp } from 'lucide-react';
import { BiasBadge } from '@/components/daily-bias/bias-badge';
import type { SecurityAnalysis, BiasDirection } from '@/types/daily-bias';

// ============================================================================
// TYPES
// ============================================================================

interface SecurityAnalysisCardProps {
  analysis: SecurityAnalysis;
  loading?: boolean;
  className?: string;
  sentiment?: BiasDirection; // NEW: Final bias sentiment from synthesis
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SecurityAnalysisCard({ 
  analysis, 
  loading = false,
  className = '',
  sentiment
}: SecurityAnalysisCardProps) {
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Security Analysis
          </CardTitle>
          <CardDescription>Analyzing volatility and risk factors...</CardDescription>
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
  
  const riskColors = {
    LOW: 'bg-green-500/10 text-green-500 border-green-500/20',
    MEDIUM: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    HIGH: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    CRITICAL: 'bg-red-500/10 text-red-500 border-red-500/20'
  };
  
  const riskIcons = {
    LOW: ShieldCheck,
    MEDIUM: AlertCircle,
    HIGH: ShieldAlert,
    CRITICAL: ShieldAlert
  };
  
  const RiskIcon = riskIcons[analysis.riskLevel];
  
  return (
    <div className="space-y-3">
      {/* Bias Badge */}
      {sentiment && (
        <div className="flex justify-start">
          <BiasBadge sentiment={sentiment} size="md" />
        </div>
      )}
      
      {/* Security Analysis Card */}
      <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Security Analysis
          </span>
          <Badge 
            variant="outline" 
            className={riskColors[analysis.riskLevel]}
          >
            <RiskIcon className="h-3 w-3 mr-1" />
            {analysis.riskLevel}
          </Badge>
        </CardTitle>
        <CardDescription>
          <span className="block">{analysis.instrument} • {new Date(analysis.timestamp).toLocaleString()}</span>
          {analysis.dataSources && analysis.dataSources.length > 0 && (
            <span className="block text-xs text-muted-foreground mt-1">
              <strong>Sources:</strong> {analysis.dataSources.join(', ')}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Volatility Index */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Volatility Index</span>
            <span className="text-muted-foreground">{analysis.volatilityIndex}/100</span>
          </div>
          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all"
              style={{ width: `${analysis.volatilityIndex}%` }}
            />
          </div>
        </div>
        
        {/* Security Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Security Score</span>
            <span className="text-muted-foreground">{analysis.securityScore}/10</span>
          </div>
          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="absolute inset-y-0 left-0 bg-primary transition-all"
              style={{ width: `${(analysis.securityScore / 10) * 100}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Higher score = safer, more predictable trading environment
          </p>
        </div>
        
        {/* Analysis Summary */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Summary</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {analysis.analysis.summary}
          </p>
        </div>
        
        {/* Key Risks */}
        {analysis.analysis.risks && analysis.analysis.risks.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              Key Risks
            </h4>
            <ul className="space-y-2">
              {analysis.analysis.risks.map((risk, idx) => (
                <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-destructive mt-0.5">•</span>
                  <span>
                    <strong>{risk.risk}</strong>
                    <span className="ml-2 text-xs">
                      (Probability: {(risk.probability * 100).toFixed(0)}%, Impact: {(risk.impact * 100).toFixed(0)}%)
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Volatility Factors */}
        {analysis.analysis.volatilityFactors && analysis.analysis.volatilityFactors.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Volatility Factors</h4>
            <div className="flex flex-wrap gap-2">
              {analysis.analysis.volatilityFactors.map((factor, idx) => (
                <Badge 
                  key={idx} 
                  variant="secondary"
                  className={
                    factor.impact === 'HIGH' ? 'bg-red-500/10 text-red-500' :
                    factor.impact === 'MEDIUM' ? 'bg-yellow-500/10 text-yellow-500' :
                    'bg-green-500/10 text-green-500'
                  }
                >
                  {factor.factor} ({factor.impact})
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {/* Recommendations */}
        {analysis.analysis.recommendations && analysis.analysis.recommendations.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Trading Recommendations</h4>
            <ul className="space-y-2">
              {analysis.analysis.recommendations.map((rec, idx) => (
                <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                  <TrendingUp className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  );
}
