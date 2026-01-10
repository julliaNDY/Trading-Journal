'use server';

/**
 * Profile Server Actions
 * 
 * Epic 10: Advanced Profile Management
 * - Avatar upload/delete
 * - Account deletion (GDPR)
 * - Email/password change
 * - Language preference
 * - Trading account archiving
 */

import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

const profileLogger = logger.child('Profile');

// ============================================================================
// TYPES
// ============================================================================

type ActionResult<T = void> = 
  | { success: true; data?: T }
  | { success: false; error: string };

// ============================================================================
// HELPERS
// ============================================================================

async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

// ============================================================================
// AVATAR MANAGEMENT (Story 10.1)
// ============================================================================

/**
 * Upload user avatar to Supabase Storage
 */
export async function uploadAvatar(formData: FormData): Promise<ActionResult<{ avatarUrl: string }>> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    const file = formData.get('avatar') as File;
    if (!file || file.size === 0) {
      return { success: false, error: 'No file provided' };
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return { success: false, error: 'Unsupported file type (JPG, PNG, WebP, GIF only)' };
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return { success: false, error: 'File too large (max 2 MB)' };
    }

    const supabase = await createClient();
    
    // Generate unique filename
    const ext = file.name.split('.').pop();
    const filename = `${userId}/avatar-${Date.now()}.${ext}`;

    // Delete old avatar if exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });
    
    if (user?.avatarUrl) {
      const oldPath = user.avatarUrl.split('/avatars/')[1];
      if (oldPath) {
        await supabase.storage.from('avatars').remove([oldPath]);
      }
    }

    // Upload new avatar
    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(filename, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (error) {
      profileLogger.error('Storage upload error', error);
      return { success: false, error: 'Upload failed' };
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(data.path);

    // Update user in database
    await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: publicUrl },
    });

    revalidatePath('/settings');
    return { success: true, data: { avatarUrl: publicUrl } };
  } catch (error) {
    profileLogger.error('Error uploading avatar', error);
    return { success: false, error: 'Failed to upload avatar' };
  }
}

/**
 * Delete user avatar
 */
export async function deleteAvatar(): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    if (user?.avatarUrl) {
      const supabase = await createClient();
      const path = user.avatarUrl.split('/avatars/')[1];
      if (path) {
        await supabase.storage.from('avatars').remove([path]);
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
    });

    revalidatePath('/settings');
    return { success: true };
  } catch (error) {
    profileLogger.error('Error deleting avatar', error);
    return { success: false, error: 'Failed to delete avatar' };
  }
}

// ============================================================================
// ACCOUNT DELETION (Story 10.2 - GDPR)
// ============================================================================

/**
 * Delete user account and all associated data
 * GDPR compliant - removes all personal data
 */
export async function deleteAccount(confirmEmail: string): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get user to verify email
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, avatarUrl: true },
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Verify email confirmation
    if (user.email.toLowerCase() !== confirmEmail.toLowerCase()) {
      return { success: false, error: 'Confirmation email does not match' };
    }

    const supabase = await createClient();

    // Delete avatar from storage if exists
    if (user.avatarUrl) {
      const path = user.avatarUrl.split('/avatars/')[1];
      if (path) {
        await supabase.storage.from('avatars').remove([path]);
      }
    }

    // Delete all user screenshots from storage
    const screenshots = await prisma.screenshot.findMany({
      where: { userId },
      select: { filePath: true },
    });
    
    if (screenshots.length > 0) {
      const paths = screenshots
        .map(s => s.filePath.split('/uploads/')[1])
        .filter(Boolean);
      if (paths.length > 0) {
        await supabase.storage.from('uploads').remove(paths);
      }
    }

    // Delete all voice notes from storage
    const voiceNotes = await prisma.voiceNote.findMany({
      where: { userId },
      select: { filePath: true },
    });
    
    const dayVoiceNotes = await prisma.dayVoiceNote.findMany({
      where: { userId },
      select: { filePath: true },
    });

    const allVoiceNotePaths = [...voiceNotes, ...dayVoiceNotes]
      .map(v => v.filePath.split('/voice-notes/')[1])
      .filter(Boolean);
    
    if (allVoiceNotePaths.length > 0) {
      await supabase.storage.from('voice-notes').remove(allVoiceNotePaths);
    }

    // Delete user from database (cascades to all related data)
    await prisma.user.delete({
      where: { id: userId },
    });

    // Delete user from Supabase Auth
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);
    
    // Sign out
    await supabase.auth.signOut();

    return { success: true };
  } catch (error) {
    profileLogger.error('Error deleting account', error);
    return { success: false, error: 'Failed to delete account' };
  }
}

// ============================================================================
// TRADING ACCOUNT ARCHIVING (Story 10.3)
// ============================================================================

/**
 * Archive a trading account (soft delete)
 */
export async function archiveAccount(accountId: string): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    // Verify ownership
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId },
    });

    if (!account) {
      return { success: false, error: 'Account not found' };
    }

    // Update account name to indicate archived status
    await prisma.account.update({
      where: { id: accountId },
      data: {
        name: `[ARCHIVED] ${account.name}`,
        description: `Archived on ${new Date().toLocaleDateString('en-US')}. ${account.description || ''}`,
      },
    });

    revalidatePath('/comptes');
    return { success: true };
  } catch (error) {
    profileLogger.error('Error archiving account', error);
    return { success: false, error: 'Failed to archive account' };
  }
}

/**
 * Restore an archived trading account
 */
export async function restoreAccount(accountId: string): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    const account = await prisma.account.findFirst({
      where: { id: accountId, userId },
    });

    if (!account) {
      return { success: false, error: 'Account not found' };
    }

    // Remove [ARCHIVED] prefix
    const newName = account.name.replace('[ARCHIVED] ', '');
    
    await prisma.account.update({
      where: { id: accountId },
      data: {
        name: newName,
        description: account.description?.replace(/Archived on .+?\. /, '') || null,
      },
    });

    revalidatePath('/comptes');
    return { success: true };
  } catch (error) {
    profileLogger.error('Error restoring account', error);
    return { success: false, error: 'Failed to restore account' };
  }
}

// ============================================================================
// EMAIL/PASSWORD CHANGE (Story 10.5)
// ============================================================================

/**
 * Update user email
 */
export async function updateEmail(newEmail: string): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    const supabase = await createClient();

    // Update email in Supabase Auth (sends confirmation email)
    const { error } = await supabase.auth.updateUser({
      email: newEmail,
    });

    if (error) {
      if (error.message.includes('already registered')) {
        return { success: false, error: 'This email is already in use' };
      }
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    profileLogger.error('Error updating email', error);
    return { success: false, error: 'Failed to update email' };
  }
}

/**
 * Update user password
 */
export async function updatePassword(
  currentPassword: string,
  newPassword: string
): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    // Validate new password
    if (newPassword.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters' };
    }

    const supabase = await createClient();

    // Get current user email
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return { success: false, error: 'Email not found' };
    }

    // Verify current password by re-authenticating
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (signInError) {
      return { success: false, error: 'Current password is incorrect' };
    }

    // Update password
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    profileLogger.error('Error updating password', error);
    return { success: false, error: 'Failed to update password' };
  }
}

// ============================================================================
// NICKNAME (Public display name for playbook sharing)
// ============================================================================

/**
 * Update user nickname (public display name)
 */
export async function updateNickname(nickname: string): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    // Validate nickname
    const trimmedNickname = nickname.trim();
    if (trimmedNickname.length > 30) {
      return { success: false, error: 'Nickname must be 30 characters or less' };
    }

    // Update in database (allow empty string to clear nickname)
    await prisma.user.update({
      where: { id: userId },
      data: { nickname: trimmedNickname || null },
    });

    revalidatePath('/settings');
    revalidatePath('/playbooks/discover');
    return { success: true };
  } catch (error) {
    profileLogger.error('Error updating nickname', error);
    return { success: false, error: 'Failed to update nickname' };
  }
}

// ============================================================================
// LANGUAGE PREFERENCE (Story 10.6)
// ============================================================================

/**
 * Update user language preference
 */
export async function updateLanguagePreference(locale: string): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    // Validate locale
    const validLocales = ['fr', 'en'];
    if (!validLocales.includes(locale)) {
      return { success: false, error: 'Unsupported language' };
    }

    // Update in database
    await prisma.user.update({
      where: { id: userId },
      data: { preferredLocale: locale },
    });

    // Update cookie
    const cookieStore = await cookies();
    cookieStore.set('locale', locale, {
      path: '/',
      maxAge: 365 * 24 * 60 * 60, // 1 year
    });

    revalidatePath('/', 'layout');
    return { success: true };
  } catch (error) {
    profileLogger.error('Error updating language preference', error);
    return { success: false, error: 'Failed to update language' };
  }
}

// ============================================================================
// GET PROFILE
// ============================================================================

/**
 * Get current user profile with all settings
 */
export async function getProfile() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        discordUsername: true,
        nickname: true,
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

    return user;
  } catch (error) {
    profileLogger.error('Error getting profile', error);
    return null;
  }
}
