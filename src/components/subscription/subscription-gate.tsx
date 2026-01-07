'use client';

/**
 * Subscription Gate Component
 * 
 * Wraps premium features and shows upgrade prompt if user doesn't have subscription.
 */

import { ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

// ============================================================================
// TYPES
// ============================================================================

interface SubscriptionGateProps {
  children: ReactNode;
  hasAccess: boolean;
  feature?: string;
  showPreview?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SubscriptionGate({
  children,
  hasAccess,
  feature,
  showPreview = false,
}: SubscriptionGateProps) {
  const t = useTranslations('subscriptionGate');

  if (hasAccess) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      {/* Blurred preview if enabled */}
      {showPreview && (
        <div className="pointer-events-none select-none blur-sm opacity-50">
          {children}
        </div>
      )}

      {/* Upgrade prompt overlay */}
      <div className={`${showPreview ? 'absolute inset-0' : ''} flex items-center justify-center p-4`}>
        <Card className="max-w-md w-full bg-background/95 backdrop-blur-sm border-primary/20">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-2 p-3 rounded-full bg-primary/10 text-primary">
              <Lock className="h-6 w-6" />
            </div>
            <CardTitle className="text-lg">{t('title')}</CardTitle>
            <CardDescription>
              {feature ? t('featureDescription', { feature }) : t('description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-center justify-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                {t('feature1')}
              </li>
              <li className="flex items-center justify-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                {t('feature2')}
              </li>
              <li className="flex items-center justify-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                {t('feature3')}
              </li>
            </ul>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button asChild className="w-full">
              <Link href="/pricing">
                <Sparkles className="mr-2 h-4 w-4" />
                {t('upgrade')}
              </Link>
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              {t('trialInfo')}
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// INLINE GATE (for smaller elements)
// ============================================================================

interface InlineSubscriptionGateProps {
  hasAccess: boolean;
  children: ReactNode;
  fallback?: ReactNode;
}

export function InlineSubscriptionGate({
  hasAccess,
  children,
  fallback,
}: InlineSubscriptionGateProps) {
  const t = useTranslations('subscriptionGate');

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <Button variant="outline" size="sm" asChild className="gap-2">
      <Link href="/pricing">
        <Lock className="h-3 w-3" />
        {t('upgradeBadge')}
      </Link>
    </Button>
  );
}

