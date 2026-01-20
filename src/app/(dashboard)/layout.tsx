import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { DonationBanner } from '@/components/layout/donation-banner';
import { AICoachButton } from '@/components/coach';
import { Footer } from '@/components/layout/footer';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Sidebar />
      <div className="lg:pl-64 flex flex-col flex-1">
        <DonationBanner />
        <Topbar email={user.email} avatarUrl={user.avatarUrl} />
        <main className="p-6 lg:p-8 flex-1">{children}</main>
        <Footer variant="compact" />
      </div>
      <AICoachButton />
    </div>
  );
}






