'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Check, Clock3, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LanguageSwitcher } from '@/components/layout/language-switcher';

export function BetaAccessLanding() {
  const t = useTranslations('landing');
  const router = useRouter();
  
  // Get features from translations
  const availableFeatures = Array.from({ length: 10 }, (_, i) => 
    t(`features.available.${i}`)
  );
  const upcomingFeatures = Array.from({ length: 13 }, (_, i) => 
    t(`features.upcoming.${i}`)
  );

  const handleJoinBeta = async () => {
    // FREE BETA MODE: Redirect directly to registration
    // Stripe integration preserved but bypassed for free beta period
    router.push('/register');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <img src="/cttp-logo.png" alt="Trading Path Journal" className="h-8 w-8" />
            <span className="hidden sm:inline">Trading Path Journal</span>
          </Link>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <Link
              href="/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              onClick={(e) => {
                e.preventDefault();
                router.push('/login');
              }}
            >
              {t('login')}
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto text-center">
          <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/10">
            <Sparkles className="h-4 w-4 mr-2" />
            {t('betaAccessBadge')}
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            {t('title')}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            {t('subtitle')}
          </p>

          <div className="mt-8 rounded-2xl border border-primary/20 bg-card/70 p-6 shadow-lg">
            <div className="flex flex-col items-center gap-2">
              <span className="text-sm uppercase tracking-wide text-muted-foreground">{t('betaAccess')}</span>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold">{t('perSemester')}</span>
              </div>
            </div>
            <Button
              size="lg"
              className="mt-6 w-full"
              onClick={handleJoinBeta}
            >
              {t('joinBeta')}
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">
              {t('securePayment')}
            </p>
          </div>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-2">
          <div className="rounded-2xl border bg-card/70 p-6">
            <h2 className="text-2xl font-semibold mb-4">{t('availableNow')}</h2>
            <ul className="space-y-3">
              {availableFeatures.map((feature, index) => (
                <li key={index} className="flex items-start gap-3 text-sm">
                  <Check className="h-4 w-4 text-primary mt-0.5" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border bg-card/70 p-6">
            <h2 className="text-2xl font-semibold mb-4">{t('comingSoon')}</h2>
            <ul className="space-y-3">
              {upcomingFeatures.map((feature, index) => (
                <li key={index} className="flex items-start gap-3 text-sm">
                  <Clock3 className="h-4 w-4 text-amber-400 mt-0.5" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-16 rounded-2xl border border-dashed bg-card/50 p-6 text-center">
          <h3 className="text-xl font-semibold mb-2">{t('whyJoin')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('whyJoinDescription')}
          </p>
        </div>
      </main>

      <footer className="border-t bg-card/50 py-8 mt-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <Link href="/" className="flex items-center gap-2 font-bold text-lg mb-2">
                <img src="/cttp-logo.png" alt="Trading Path Journal" className="h-6 w-6" />
                Trading Path Journal
              </Link>
              <p className="text-sm text-muted-foreground">
                {t('footerMadeWith')}
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-3">{t('legal')}</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/legal/cgv" className="text-muted-foreground hover:text-foreground transition-colors">
                    {t('cgv')}
                  </Link>
                </li>
                <li>
                  <Link href="/legal/cgu" className="text-muted-foreground hover:text-foreground transition-colors">
                    {t('cgu')}
                  </Link>
                </li>
                <li>
                  <Link href="/legal/mentions" className="text-muted-foreground hover:text-foreground transition-colors">
                    {t('mentions')}
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
                    {t('privacy')}
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">{t('contact')}</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/contact" className="text-muted-foreground hover:text-foreground transition-colors">
                    {t('contact')}
                  </Link>
                </li>
                <li>
                  <a 
                    href="mailto:contact@tradingpathjournal.com" 
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    contact@tradingpathjournal.com
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
            {t('copyright', { year: new Date().getFullYear() })}
          </div>
        </div>
      </footer>
    </div>
  );
}
