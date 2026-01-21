import { BetaAccessLanding } from '@/components/landing/beta-access-landing';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; type?: string }>;
}) {
  const params = await searchParams;
  
  // #region agent log
  const fs = await import('fs');fs.appendFileSync('/Users/l3j/Desktop/Trading/Useful Shit/Trading-Journal/cryptosite/.cursor/debug.log',JSON.stringify({location:'page.tsx:11',message:'Landing page accessed',data:{hasCode:!!params.code,type:params.type,env:process.env.NODE_ENV},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1,H2',runId:'production'})+'\n');
  // #endregion
  
  // If a code is present in the URL (from Supabase email redirect), redirect to auth callback
  // This handles the case where Supabase uses the Site URL instead of the redirectTo parameter
  if (params.code) {
    // #region agent log
    const fs2 = await import('fs');fs2.appendFileSync('/Users/l3j/Desktop/Trading/Useful Shit/Trading-Journal/cryptosite/.cursor/debug.log',JSON.stringify({location:'page.tsx:18',message:'Redirecting to callback',data:{codePrefix:params.code.substring(0,8),type:params.type},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2',runId:'production'})+'\n');
    // #endregion
    // Preserve the type parameter if present, otherwise no type (signup confirmation)
    const typeParam = params.type ? `&type=${params.type}` : '';
    redirect(`/auth/callback?code=${params.code}${typeParam}`);
  }
  
  return <BetaAccessLanding />;
}

