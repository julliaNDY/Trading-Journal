'use server';

import prisma from '@/lib/prisma';
import { getUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { authLogger } from '@/lib/logger';

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

/**
 * Clean up orphaned users - users that exist in public.users but not in auth.users
 * This can happen when users are manually deleted from Supabase Auth dashboard
 */
export async function cleanupOrphanedUsers(): Promise<{
  success: boolean;
  deletedCount: number;
  orphanedIds: string[];
  error?: string;
}> {
  const currentUser = await getUser();
  if (!currentUser) throw new Error('Unauthorized');
  
  // Check if current user is admin
  if (!ADMIN_EMAILS.includes(currentUser.email)) {
    throw new Error('Forbidden: Admin access required');
  }

  try {
    // Get all user IDs from public.users (Prisma)
    const prismaUsers = await prisma.user.findMany({
      select: { id: true, email: true },
    });
    
    // Get all user IDs from auth.users (Supabase)
    const supabaseAdmin = createAdminClient();
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (authError) {
      authLogger.error('Error fetching auth users:', authError);
      return {
        success: false,
        deletedCount: 0,
        orphanedIds: [],
        error: `Failed to fetch auth users: ${authError.message}`,
      };
    }
    
    // Create a Set of auth user IDs for fast lookup
    const authUserIds = new Set(authUsers.users.map(u => u.id));
    
    // Find orphaned users (exist in public.users but not in auth.users)
    const orphanedUsers = prismaUsers.filter(u => !authUserIds.has(u.id));
    
    if (orphanedUsers.length === 0) {
      return {
        success: true,
        deletedCount: 0,
        orphanedIds: [],
      };
    }
    
    authLogger.debug(`Found ${orphanedUsers.length} orphaned users`, { emails: orphanedUsers.map(u => u.email) });
    
    // Delete orphaned users from public.users
    // This will cascade to all child tables via Prisma's onDelete: Cascade
    const deleteResult = await prisma.user.deleteMany({
      where: {
        id: {
          in: orphanedUsers.map(u => u.id),
        },
      },
    });
    
    authLogger.debug(`Deleted ${deleteResult.count} orphaned users`);
    
    revalidatePath('/admin');
    
    return {
      success: true,
      deletedCount: deleteResult.count,
      orphanedIds: orphanedUsers.map(u => u.id),
    };
    
  } catch (error) {
    authLogger.error('Error cleaning up orphaned users:', error);
    return {
      success: false,
      deletedCount: 0,
      orphanedIds: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete a user completely (from both auth.users and public.users)
 * This is a proper way to delete users that cleans up everything
 */
export async function deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
  const currentUser = await getUser();
  if (!currentUser) throw new Error('Unauthorized');
  
  // Check if current user is admin
  if (!ADMIN_EMAILS.includes(currentUser.email)) {
    throw new Error('Forbidden: Admin access required');
  }

  try {
    // Get the target user
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!targetUser) {
      return { success: false, error: 'User not found' };
    }

    // Prevent deleting admin users
    if (ADMIN_EMAILS.includes(targetUser.email)) {
      return { success: false, error: 'Cannot delete admin users' };
    }

    // Delete from Supabase Auth first
    const supabaseAdmin = createAdminClient();
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (authError) {
      authLogger.error('Error deleting from auth.users:', authError);
      // Continue anyway - the user might already be deleted from auth
    }

    // Delete from public.users (this will cascade to all child tables)
    await prisma.user.delete({
      where: { id: userId },
    });

    revalidatePath('/admin');
    
    return { success: true };
    
  } catch (error) {
    authLogger.error('Error deleting user:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
