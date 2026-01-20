/**
 * Bias Badge Component
 * 
 * Displays sentiment badge (BULLISH/BEARISH/NEUTRAL) above analysis sections
 * Provides visual indication of market bias with icons and colors
 */

'use client';

import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BiasDirection } from '@/types/daily-bias';

// ============================================================================
// TYPES
// ============================================================================

interface BiasBadgeProps {
  sentiment: BiasDirection;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BiasBadge({ sentiment, size = 'md', className = '' }: BiasBadgeProps) {
  const config = {
    BULLISH: {
      icon: TrendingUp,
      color: 'bg-green-500 text-white border-green-500',
      label: 'BIAIS : BULLISH',
    },
    BEARISH: {
      icon: TrendingDown,
      color: 'bg-red-500 text-white border-red-500',
      label: 'BIAIS : BEARISH',
    },
    NEUTRAL: {
      icon: Minus,
      color: 'bg-blue-500 text-white border-blue-500',
      label: 'BIAIS : NEUTRAL',
    },
  };
  
  const { icon: Icon, color, label } = config[sentiment];
  
  const sizeClasses = {
    sm: 'text-xs px-3 py-1',
    md: 'text-sm px-4 py-1.5',
    lg: 'text-base px-6 py-2',
  };
  
  return (
    <Badge 
      variant="default" 
      className={cn(
        color,
        sizeClasses[size],
        'font-bold inline-flex items-center gap-2',
        className
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Badge>
  );
}
