import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { AICoachButton } from '@/components/coach';

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
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="lg:pl-64">
        <Topbar email={user.email} />
        <main className="p-6 lg:p-8">{children}</main>
      </div>
      <AICoachButton />
    </div>
  );
}






