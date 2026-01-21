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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ hasAccess: false, status: null });
  }

  // Get user from database to check if they exist
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
  });

  if (!dbUser) {
    return NextResponse.json({ hasAccess: false, status: null });
  }

  // FREE BETA MODE: Grant access to all authenticated users
  // Subscription checks are bypassed but code preserved for future use
  // Original logic remains below for reference:
  /*
  // Check early access first (users who created account before cutoff date)
  if (hasEarlyAccess(dbUser.createdAt)) {
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
    return NextResponse.json({ hasAccess: false, status: null });
  }

  const hasAccess = subscription.status === 'BETA_ACCESS' || isSubscriptionActive(subscription);

  return NextResponse.json({
    hasAccess,
    status: subscription.status,
  });
  */

  return NextResponse.json({
    hasAccess: true,
    status: 'FREE_BETA',
  });
}
