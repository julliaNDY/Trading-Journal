import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  if (user) {
    redirect('/dashboard');
  }

  return <>{children}</>;
}






