import { requireAuth } from '@/lib/auth';
import { SettingsContent } from './settings-content';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const user = await requireAuth();
  
  // Get user profile data with subscription and counts
  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      discordUsername: true,
      avatarUrl: true,
      preferredLocale: true,
      createdAt: true,
      subscription: {
        select: {
          status: true,
          plan: {
            select: {
              displayName: true,
            },
          },
        },
      },
      _count: {
        select: {
          trades: true,
          accounts: true,
        },
      },
    },
  });

  return <SettingsContent profile={profile} />;
}

