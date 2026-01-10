'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Check, Sparkles, Zap, Crown, Loader2, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { getPlans, createCheckoutSessionAction } from '@/app/actions/subscription';
import { PlanInterval } from '@prisma/client';

// Stripe donation link (pay what you want)
const DONATION_LINK = 'https://buy.stripe.com/14AfZg1G946zaao25DgA804';

// ============================================================================
// TYPES
// ============================================================================

interface Plan {
  id: string;
  name: string;
  displayName: string | null;
  description: string | null;
  price: number;
  interval: PlanInterval;
  trialDays: number;
  savings: string | null;
  features: string[];
}

// ============================================================================
// PLAN ICONS
// ============================================================================

const PLAN_ICONS: Record<PlanInterval, React.ReactNode> = {
  MONTHLY: <Zap className="h-6 w-6" />,
  QUARTERLY: <Sparkles className="h-6 w-6" />,
  BIANNUAL: <Crown className="h-6 w-6" />,
  ANNUAL: <Crown className="h-6 w-6 text-amber-500" />,
};

// ============================================================================
// COMPONENT
// ============================================================================

export function PricingContent() {
  const t = useTranslations('pricing');
  const router = useRouter();
  
  // Dynamic interval labels based on locale
  const getIntervalLabel = (interval: PlanInterval): string => {
    return t(`interval.${interval.toLowerCase()}`);
  };
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribingPlan, setSubscribingPlan] = useState<string | null>(null);

  // Check for canceled subscription
  useEffect(() => {
    if (searchParams.get('subscription') === 'canceled') {
      toast({
        title: t('canceled'),
        description: t('canceledDescription'),
        variant: 'default',
      });
    }
  }, [searchParams, toast, t]);

  // Load plans
  useEffect(() => {
    async function loadPlans() {
      try {
        const data = await getPlans();
        setPlans(data);
      } catch (error) {
        console.error('Error loading plans:', error);
        toast({
          title: t('error'),
          description: t('errorLoadingPlans'),
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }
    loadPlans();
  }, [toast, t]);

  const handleSubscribe = async (planInterval: PlanInterval) => {
    setSubscribingPlan(planInterval);
    
    try {
      const result = await createCheckoutSessionAction(planInterval);
      
      if (result.success) {
        if (result.data?.url) {
          window.location.href = result.data.url;
        } else {
          toast({
            variant: 'destructive',
            title: t('errorCreatingCheckout'),
          });
        }
      } else {
        const errorMessage = result.error || t('errorCreatingCheckout');
        toast({
          title: t('error'),
          description: errorMessage,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast({
        title: t('error'),
        description: t('errorCreatingCheckout'),
        variant: 'destructive',
      });
    } finally {
      setSubscribingPlan(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <div className="py-16 px-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          {t('title')}
        </h1>
        <p className="mt-4 text-xl text-muted-foreground max-w-2xl mx-auto">
          {t('subtitle')}
        </p>
        <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-4 w-4" />
          <span className="text-sm font-medium">{t('trialBadge')}</span>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="max-w-6xl mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => {
            const isPopular = plan.interval === 'ANNUAL';
            const isSubscribing = subscribingPlan === plan.interval;

            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col ${
                  isPopular
                    ? 'border-primary shadow-lg shadow-primary/20 scale-105'
                    : 'border-border'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">
                      {t('mostPopular')}
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-4">
                  <div className="mx-auto mb-2 p-3 rounded-full bg-primary/10 text-primary">
                    {PLAN_ICONS[plan.interval]}
                  </div>
                  <CardTitle className="text-lg">
                    {plan.displayName || plan.name}
                  </CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>

                <CardContent className="flex-1">
                  {/* Price */}
                  <div className="text-center mb-6">
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-bold">${plan.price}</span>
                      <span className="text-muted-foreground">
                        {getIntervalLabel(plan.interval)}
                      </span>
                    </div>
                    {plan.savings && (
                      <Badge variant="secondary" className="mt-2">
                        {t('save')} {plan.savings}
                      </Badge>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-3">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter>
                  <Button
                    className="w-full"
                    variant={isPopular ? 'default' : 'outline'}
                    onClick={() => handleSubscribe(plan.interval)}
                    disabled={isSubscribing}
                  >
                    {isSubscribing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('processing')}
                      </>
                    ) : (
                      t('startTrial')
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* Trial info */}
        <div className="mt-12 text-center">
          <p className="text-muted-foreground">
            {t('trialInfo')}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('pricesMayChange')}
          </p>
        </div>

        {/* Donation Section */}
        <div className="mt-16 max-w-xl mx-auto text-center">
          <div className="p-8 rounded-2xl bg-gradient-to-br from-pink-500/10 to-purple-500/10 border border-pink-500/20">
            <Heart className="h-10 w-10 mx-auto mb-4 text-pink-500" />
            <h2 className="text-2xl font-bold mb-2">{t('donationTitle')}</h2>
            <p className="text-muted-foreground mb-6">{t('donationDescription')}</p>
            <Button
              size="lg"
              variant="outline"
              className="border-pink-500/50 hover:bg-pink-500/10 hover:border-pink-500"
              onClick={() => window.open(DONATION_LINK, '_blank')}
            >
              <Heart className="mr-2 h-4 w-4 text-pink-500" />
              {t('donationButton')}
            </Button>
          </div>
        </div>

        {/* FAQ or additional info */}
        <div className="mt-16 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">{t('faqTitle')}</h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">{t('faq1Question')}</h3>
              <p className="text-muted-foreground text-sm">{t('faq1Answer')}</p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">{t('faq2Question')}</h3>
              <p className="text-muted-foreground text-sm">{t('faq2Answer')}</p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">{t('faq3Question')}</h3>
              <p className="text-muted-foreground text-sm">{t('faq3Answer')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

