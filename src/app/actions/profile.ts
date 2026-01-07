'use server';

/**
 * Profile Server Actions
 * 
 * Epic 10: Gestion de Profil Avancée
 * - Avatar upload/delete
 * - Account deletion (RGPD)
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
      return { success: false, error: 'Non authentifié' };
    }

    const file = formData.get('avatar') as File;
    if (!file || file.size === 0) {
      return { success: false, error: 'Aucun fichier fourni' };
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return { success: false, error: 'Type de fichier non supporté (JPG, PNG, WebP, GIF uniquement)' };
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return { success: false, error: 'Fichier trop volumineux (max 2 Mo)' };
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
      return { success: false, error: 'Erreur lors de l\'upload' };
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
    return { success: false, error: 'Erreur lors de l\'upload de l\'avatar' };
  }
}

/**
 * Delete user avatar
 */
export async function deleteAvatar(): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, error: 'Non authentifié' };
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
    return { success: false, error: 'Erreur lors de la suppression de l\'avatar' };
  }
}

// ============================================================================
// ACCOUNT DELETION (Story 10.2 - RGPD)
// ============================================================================

/**
 * Delete user account and all associated data
 * RGPD compliant - removes all personal data
 */
export async function deleteAccount(confirmEmail: string): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, error: 'Non authentifié' };
    }

    // Get user to verify email
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, avatarUrl: true },
    });

    if (!user) {
      return { success: false, error: 'Utilisateur non trouvé' };
    }

    // Verify email confirmation
    if (user.email.toLowerCase() !== confirmEmail.toLowerCase()) {
      return { success: false, error: 'L\'email de confirmation ne correspond pas' };
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
    return { success: false, error: 'Erreur lors de la suppression du compte' };
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
      return { success: false, error: 'Non authentifié' };
    }

    // Verify ownership
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId },
    });

    if (!account) {
      return { success: false, error: 'Compte non trouvé' };
    }

    // Update account name to indicate archived status
    await prisma.account.update({
      where: { id: accountId },
      data: {
        name: `[ARCHIVED] ${account.name}`,
        description: `Archivé le ${new Date().toLocaleDateString('fr-FR')}. ${account.description || ''}`,
      },
    });

    revalidatePath('/comptes');
    return { success: true };
  } catch (error) {
    profileLogger.error('Error archiving account', error);
    return { success: false, error: 'Erreur lors de l\'archivage du compte' };
  }
}

/**
 * Restore an archived trading account
 */
export async function restoreAccount(accountId: string): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, error: 'Non authentifié' };
    }

    const account = await prisma.account.findFirst({
      where: { id: accountId, userId },
    });

    if (!account) {
      return { success: false, error: 'Compte non trouvé' };
    }

    // Remove [ARCHIVED] prefix
    const newName = account.name.replace('[ARCHIVED] ', '');
    
    await prisma.account.update({
      where: { id: accountId },
      data: {
        name: newName,
        description: account.description?.replace(/Archivé le .+?\. /, '') || null,
      },
    });

    revalidatePath('/comptes');
    return { success: true };
  } catch (error) {
    profileLogger.error('Error restoring account', error);
    return { success: false, error: 'Erreur lors de la restauration du compte' };
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
      return { success: false, error: 'Non authentifié' };
    }

    const supabase = await createClient();

    // Update email in Supabase Auth (sends confirmation email)
    const { error } = await supabase.auth.updateUser({
      email: newEmail,
    });

    if (error) {
      if (error.message.includes('already registered')) {
        return { success: false, error: 'Cet email est déjà utilisé' };
      }
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    profileLogger.error('Error updating email', error);
    return { success: false, error: 'Erreur lors de la mise à jour de l\'email' };
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
      return { success: false, error: 'Non authentifié' };
    }

    // Validate new password
    if (newPassword.length < 8) {
      return { success: false, error: 'Le mot de passe doit contenir au moins 8 caractères' };
    }

    const supabase = await createClient();

    // Get current user email
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return { success: false, error: 'Email non trouvé' };
    }

    // Verify current password by re-authenticating
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (signInError) {
      return { success: false, error: 'Mot de passe actuel incorrect' };
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
    return { success: false, error: 'Erreur lors de la mise à jour du mot de passe' };
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
      return { success: false, error: 'Non authentifié' };
    }

    // Validate locale
    const validLocales = ['fr', 'en'];
    if (!validLocales.includes(locale)) {
      return { success: false, error: 'Langue non supportée' };
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
    return { success: false, error: 'Erreur lors de la mise à jour de la langue' };
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

