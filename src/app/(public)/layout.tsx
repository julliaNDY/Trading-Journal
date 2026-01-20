import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { DonationBanner } from '@/components/layout/donation-banner';
import { Footer } from '@/components/layout/footer';

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tNav = await getTranslations('nav');

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Donation Banner */}
      <DonationBanner />
      
      {/* Header */}
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
      <Footer />
    </div>
  );
}

