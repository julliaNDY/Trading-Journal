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
  const debugLog = async (msg: string, data: object) => {
    const logEntry = JSON.stringify({location:'page.tsx',message:msg,data,timestamp:Date.now()});
    console.log('[DEBUG]', logEntry);
    try {
      const fs = await import('fs');
      const path = await import('path');
      const logPath = path.join(process.cwd(), '.cursor', 'debug.log');
      fs.mkdirSync(path.dirname(logPath), { recursive: true });
      fs.appendFileSync(logPath, logEntry + '\n');
    } catch (e) { /* ignore */ }
  };
  await debugLog('Landing page accessed', {hasCode:!!params.code,type:params.type,env:process.env.NODE_ENV});
  // #endregion
  
  // If a code is present in the URL (from Supabase email redirect), redirect to auth callback
  // This handles the case where Supabase uses the Site URL instead of the redirectTo parameter
  if (params.code) {
    // #region agent log
    await debugLog('Redirecting to callback', {codePrefix:params.code.substring(0,8),type:params.type});
    // #endregion
    // Preserve the type parameter if present, otherwise no type (signup confirmation)
    const typeParam = params.type ? `&type=${params.type}` : '';
    redirect(`/auth/callback?code=${params.code}${typeParam}`);
  }
  
  return <BetaAccessLanding />;
}

