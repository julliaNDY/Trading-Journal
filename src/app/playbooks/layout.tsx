import { DonationBanner } from '@/components/layout/donation-banner';
import { Footer } from '@/components/layout/footer';

export default function PlaybooksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <DonationBanner />
      <main className="flex-1">
        {children}
      </main>
      <Footer variant="compact" />
    </div>
  );
}
