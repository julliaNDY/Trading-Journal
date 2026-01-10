'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

export function FooterClient() {
  const t = useTranslations('footer');
  const year = new Date().getFullYear();

  return (
    <footer className="border-t bg-card/30 py-4 mt-auto">
      <div className="container mx-auto px-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-1.5 hover:text-foreground transition-colors">
              <img src="/cttp-logo.png" alt="Trading Path Journal" className="h-4 w-4" />
              <span className="font-medium">Trading Path Journal</span>
            </Link>
            <span>•</span>
            <span>{t('copyright', { year })}</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/legal/cgv" className="hover:text-foreground transition-colors">
              {t('cgv')}
            </Link>
            <Link href="/legal/cgu" className="hover:text-foreground transition-colors">
              {t('cgu')}
            </Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              {t('privacy')}
            </Link>
            <Link href="/contact" className="hover:text-foreground transition-colors">
              {t('contact')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
