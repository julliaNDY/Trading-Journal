'use server';

import prisma from '@/lib/prisma';
import { getUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

// List of admin emails - ONLY these users can access admin page
const ADMIN_EMAILS = [
  'j.bengueche@gmail.com',
  'carmor.ttp@gmail.com',
];

export async function getAdminEmails(): Promise<string[]> {
  return ADMIN_EMAILS;
}

export async function isAdmin(): Promise<boolean> {
  const user = await getUser();
  if (!user) return false;
  return ADMIN_EMAILS.includes(user.email);
}

export async function getAllUsers() {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');
  
  // Check if user is admin
  if (!ADMIN_EMAILS.includes(user.email)) {
    throw new Error('Forbidden: Admin access required');
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      discordUsername: true,
      createdAt: true,
      isBlocked: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return users;
}

export async function toggleUserBlock(userId: string): Promise<{ success: boolean; isBlocked: boolean }> {
  const currentUser = await getUser();
  if (!currentUser) throw new Error('Unauthorized');
  
  // Check if current user is admin
  if (!ADMIN_EMAILS.includes(currentUser.email)) {
    throw new Error('Forbidden: Admin access required');
  }

  // Get the target user
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, isBlocked: true },
  });

  if (!targetUser) {
    throw new Error('User not found');
  }

  // Prevent blocking admin users
  if (ADMIN_EMAILS.includes(targetUser.email)) {
    throw new Error('Cannot block admin users');
  }

  // Toggle the block status
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { isBlocked: !targetUser.isBlocked },
    select: { isBlocked: true },
  });

  revalidatePath('/admin');

  return { success: true, isBlocked: updatedUser.isBlocked };
}
