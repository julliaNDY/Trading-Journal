/**
 * Synthesis Tab Component
 * 
 * Displays the AI-generated synthesis in a dedicated tab format.
 * Shows sentiment badge, confidence bar, and synthesis text with citation styling.
 * 
 * Story: 12.12 - Synthesis Tab UI (Frontend)
 */

'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { BiasDirection } from '@/types/daily-bias';

// ============================================================================
// TYPES
// ============================================================================

interface SynthesisTabProps {
  synthesisText: string;
  sentiment: BiasDirection; // 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  confidence: number; // 0-100 percentage
  loading?: boolean;
  error?: string | null;
  className?: string;
}

// ============================================================================
// SENTIMENT CONFIGURATION
// ============================================================================

const sentimentConfig = {
  BULLISH: {
    icon: TrendingUp,
    badgeClass: 'bg-green-500/10 text-green-500 border-green-500/20 text-lg px-6 py-2',
    barClass: 'bg-green-500',
    label: 'BULLISH'
  },
  BEARISH: {
    icon: TrendingDown,
    badgeClass: 'bg-red-500/10 text-red-500 border-red-500/20 text-lg px-6 py-2',
    barClass: 'bg-red-500',
    label: 'BEARISH'
  },
  NEUTRAL: {
    icon: Minus,
    badgeClass: 'bg-blue-500/10 text-blue-500 border-blue-500/20 text-lg px-6 py-2',
    barClass: 'bg-blue-500',
    label: 'NEUTRAL'
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract citation from synthesis text
 * Citations typically start with "By analyzing the data provided by..."
 */
function extractCitation(text: string): { citation: string; mainText: string } {
  // Pattern: "By analyzing the data provided by ... [sources]..."
  const citationPattern = /^By analyzing.*?\.\.\.\s*/i;
  const match = text.match(citationPattern);
  
  if (match) {
    const citation = match[0].trim();
    const mainText = text.slice(citation.length).trim();
    return { citation, mainText };
  }
  
  return { citation: '', mainText: text };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SynthesisTab({ synthesisText, sentiment, confidence, loading = false, error = null, className = '' }: SynthesisTabProps) {
  // Loading state
  if (loading) {
    return (
      <Card className={`border-2 ${className}`}>
        <CardContent className="pt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="h-10 w-32 bg-muted animate-pulse rounded" />
            <div className="h-6 w-24 bg-muted animate-pulse rounded" />
          </div>
          <div className="h-2 bg-muted animate-pulse rounded-full" />
          <div className="space-y-3 max-w-3xl mx-auto">
            <div className="h-4 bg-muted animate-pulse rounded w-full" />
            <div className="h-4 bg-muted animate-pulse rounded w-5/6" />
            <div className="h-4 bg-muted animate-pulse rounded w-4/5" />
            <div className="h-4 bg-muted animate-pulse rounded w-full" />
            <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Error state
  if (error) {
    return (
      <Card className={`border-2 border-destructive/20 ${className}`}>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <p className="text-sm text-destructive mb-2">Synthesis generation failed</p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const config = sentimentConfig[sentiment];
  const SentimentIcon = config.icon;
  const { citation, mainText } = extractCitation(synthesisText);
  
  return (
    <Card className={`border-2 ${className}`}>
      <CardContent className="pt-6 space-y-6">
        {/* Sentiment Badge & Confidence */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <Badge variant="outline" className={config.badgeClass}>
            <SentimentIcon className="mr-2 h-5 w-5" />
            {config.label}
          </Badge>
          <span className="text-sm text-muted-foreground font-medium">
            Confidence: <span className="font-bold">{confidence}%</span>
          </span>
        </div>
        
        {/* Confidence Bar */}
        <div className="space-y-2">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all ${config.barClass}`}
              style={{ width: `${confidence}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {confidence >= 80 ? 'High confidence - Strong signal' :
             confidence >= 60 ? 'Moderate confidence - Decent signal' :
             confidence >= 40 ? 'Low confidence - Weak signal' :
             'Very low confidence - Avoid trading'}
          </p>
        </div>
        
        {/* Synthesis Text */}
        <div className="space-y-4 max-w-3xl mx-auto">
          {/* Citation (if exists) */}
          {citation && (
            <div className="bg-muted/30 px-4 py-3 rounded-lg border border-muted">
              <p className="text-sm italic text-muted-foreground leading-relaxed">
                {citation}
              </p>
            </div>
          )}
          
          {/* Main Synthesis Text */}
          {mainText && (
            <p className="text-base leading-relaxed text-foreground">
              {mainText}
            </p>
          )}
          
          {/* Empty State */}
          {!synthesisText && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Synthesis not available
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
