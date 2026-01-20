'use client';

import { useTranslations } from 'next-intl';
import { Heart } from 'lucide-react';

export function DonationBanner() {
  const t = useTranslations('donation');

  return (
    <div className="w-full bg-gradient-to-r from-purple-600/10 via-orange-600/10 to-green-600/10 border-b border-border">
      <a
        href="https://buy.stripe.com/14AfZg1G946zaao25DgA804"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
      >
        <Heart className="h-4 w-4 text-red-500 fill-red-500" />
        <span>{t('header')}</span>
      </a>
    </div>
  );
}
