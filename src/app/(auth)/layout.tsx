import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { Footer } from '@/components/layout/footer';

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  if (user) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 flex items-center justify-center">
        {children}
      </main>
      <Footer variant="compact" />
    </div>
  );
}






