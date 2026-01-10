import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

interface FooterProps {
  variant?: 'default' | 'compact';
}

export async function Footer({ variant = 'default' }: FooterProps) {
  const t = await getTranslations('footer');
  const year = new Date().getFullYear();

  if (variant === 'compact') {
    // Compact footer for dashboard pages
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

  // Default full footer for public pages
  return (
    <footer className="border-t bg-card/50 py-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center gap-2 font-bold text-lg mb-2">
              <img src="/cttp-logo.png" alt="Trading Path Journal" className="h-6 w-6" />
              Trading Path Journal
            </Link>
            <p className="text-sm text-muted-foreground">
              {t('madeWith')}
            </p>
          </div>

          {/* Legal links */}
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

          {/* Contact */}
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
          {t('copyright', { year })}
        </div>
      </div>
    </footer>
  );
}
