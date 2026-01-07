import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { LanguageSwitcher } from '@/components/layout/language-switcher';

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations('footer');
  const tNav = await getTranslations('nav');
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <img src="/cttp-logo.png" alt="Trading Journal" className="h-8 w-8" />
            <span className="hidden sm:inline">Trading Journal</span>
          </Link>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <Link
              href="/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {tNav('dashboard')}
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t bg-card/50 py-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Brand */}
            <div>
              <Link href="/" className="flex items-center gap-2 font-bold text-lg mb-2">
                <img src="/cttp-logo.png" alt="Trading Journal" className="h-6 w-6" />
                Trading Journal
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
    </div>
  );
}

