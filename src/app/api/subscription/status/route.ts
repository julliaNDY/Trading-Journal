import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { isSubscriptionActive } from '@/types/subscription';

// Date limite pour l'accès gratuit : 15/01/2026 7AM EST = 15/01/2026 12:00 UTC
const EARLY_ACCESS_CUTOFF_DATE = new Date('2026-01-15T12:00:00.000Z');

/**
 * Check if user has early access based on account creation date
 */
function hasEarlyAccess(createdAt: Date): boolean {
  return createdAt < EARLY_ACCESS_CUTOFF_DATE;
}

export async function GET() {
  // #region agent log
  const fs = await import('fs');const logEntry = JSON.stringify({location:'subscription-status-route.ts:entry',message:'Subscription status check',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3B',runId:'initial'})+'\n';try{fs.appendFileSync('/Users/l3j/Desktop/Trading/Useful Shit/Trading-Journal/cryptosite/.cursor/debug.log',logEntry)}catch(e){}
  // #endregion
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // #region agent log
    const fs2 = await import('fs');const logEntry2 = JSON.stringify({location:'subscription-status-route.ts:no-user',message:'No user - returning hasAccess false',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3B',runId:'initial'})+'\n';try{fs2.appendFileSync('/Users/l3j/Desktop/Trading/Useful Shit/Trading-Journal/cryptosite/.cursor/debug.log',logEntry2)}catch(e){}
    // #endregion
    return NextResponse.json({ hasAccess: false, status: null });
  }

  // Get user from database to check creation date
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
  });

  if (!dbUser) {
    // #region agent log
    const fs3 = await import('fs');const logEntry3 = JSON.stringify({location:'subscription-status-route.ts:no-db-user',message:'User not found in DB - returning hasAccess false',data:{userId:user.id},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3B',runId:'initial'})+'\n';try{fs3.appendFileSync('/Users/l3j/Desktop/Trading/Useful Shit/Trading-Journal/cryptosite/.cursor/debug.log',logEntry3)}catch(e){}
    // #endregion
    return NextResponse.json({ hasAccess: false, status: null });
  }

  // Check early access first (users who created account before cutoff date)
  if (hasEarlyAccess(dbUser.createdAt)) {
    // #region agent log
    const fs4 = await import('fs');const logEntry4 = JSON.stringify({location:'subscription-status-route.ts:early-access',message:'User has early access',data:{createdAt:dbUser.createdAt.toISOString()},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3B',runId:'initial'})+'\n';try{fs4.appendFileSync('/Users/l3j/Desktop/Trading/Useful Shit/Trading-Journal/cryptosite/.cursor/debug.log',logEntry4)}catch(e){}
    // #endregion
    return NextResponse.json({
      hasAccess: true,
      status: 'EARLY_ACCESS',
    });
  }

  // Otherwise, check subscription
  const subscription = await prisma.subscription.findUnique({
    where: { userId: user.id },
  });

  if (!subscription) {
    // #region agent log
    const fs5 = await import('fs');const logEntry5 = JSON.stringify({location:'subscription-status-route.ts:no-subscription',message:'No subscription found - returning hasAccess false',data:{userId:user.id},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3B',runId:'initial'})+'\n';try{fs5.appendFileSync('/Users/l3j/Desktop/Trading/Useful Shit/Trading-Journal/cryptosite/.cursor/debug.log',logEntry5)}catch(e){}
    // #endregion
    return NextResponse.json({ hasAccess: false, status: null });
  }

  const hasAccess = subscription.status === 'BETA_ACCESS' || isSubscriptionActive(subscription);

  // #region agent log
  const fs6 = await import('fs');const logEntry6 = JSON.stringify({location:'subscription-status-route.ts:result',message:'Subscription check result',data:{hasAccess,status:subscription.status,isActive:isSubscriptionActive(subscription)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3B',runId:'initial'})+'\n';try{fs6.appendFileSync('/Users/l3j/Desktop/Trading/Useful Shit/Trading-Journal/cryptosite/.cursor/debug.log',logEntry6)}catch(e){}
  // #endregion

  return NextResponse.json({
    hasAccess,
    status: subscription.status,
  });
}
