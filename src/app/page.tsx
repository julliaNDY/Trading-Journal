import { BetaAccessLanding } from '@/components/landing/beta-access-landing';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; type?: string }>;
}) {
  const params = await searchParams;
  
  // If a code is present in the URL (from Supabase email redirect), redirect to auth callback
  // This handles the case where Supabase uses the Site URL instead of the redirectTo parameter
  if (params.code) {
    // Preserve the type parameter if present, otherwise no type (signup confirmation)
    const typeParam = params.type ? `&type=${params.type}` : '';
    redirect(`/auth/callback?code=${params.code}${typeParam}`);
  }
  
  return <BetaAccessLanding />;
}

