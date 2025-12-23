'use server';

import { randomBytes } from 'crypto';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { sendEmail } from '@/services/email-service';

const RESET_TOKEN_EXPIRY_HOURS = 1;

export async function requestPasswordReset(email: string): Promise<{ success: boolean; message?: string }> {
  try {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return { success: true };
    }

    // Check if user is blocked
    if (user.isBlocked) {
      return { success: true };
    }

    // Generate a secure token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    // Delete any existing reset tokens for this user
    await prisma.passwordReset.deleteMany({
      where: { userId: user.id },
    });

    // Create new reset token
    await prisma.passwordReset.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
    });

    // Send reset email
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
    
    await sendEmail({
      to: user.email,
      subject: 'Reset your Trading Journal password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Reset Your Password</h2>
          <p>You requested to reset your password for Trading Journal.</p>
          <p>Click the button below to set a new password. This link will expire in ${RESET_TOKEN_EXPIRY_HOURS} hour.</p>
          <div style="margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
          <p style="color: #666; font-size: 14px;">Or copy and paste this link in your browser:</p>
          <p style="color: #666; font-size: 12px; word-break: break-all;">${resetUrl}</p>
        </div>
      `,
    });

    return { success: true };
  } catch (error) {
    console.error('Password reset request error:', error);
    return { success: false, message: 'An error occurred' };
  }
}

export async function verifyResetToken(token: string): Promise<{ valid: boolean; userId?: string }> {
  try {
    const resetRecord = await prisma.passwordReset.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetRecord) {
      return { valid: false };
    }

    // Check if token is expired
    if (resetRecord.expiresAt < new Date()) {
      return { valid: false };
    }

    // Check if token was already used
    if (resetRecord.usedAt) {
      return { valid: false };
    }

    // Check if user is blocked
    if (resetRecord.user.isBlocked) {
      return { valid: false };
    }

    return { valid: true, userId: resetRecord.userId };
  } catch (error) {
    console.error('Token verification error:', error);
    return { valid: false };
  }
}

export async function resetPassword(
  token: string,
  newPassword: string
): Promise<{ success: boolean; message?: string }> {
  try {
    // Verify token first
    const verification = await verifyResetToken(token);
    
    if (!verification.valid || !verification.userId) {
      return { success: false, message: 'Invalid or expired reset token' };
    }

    // Validate password
    if (newPassword.length < 8) {
      return { success: false, message: 'Password must be at least 8 characters' };
    }

    // Hash the new password
    const passwordHash = await hashPassword(newPassword);

    // Update user's password
    await prisma.user.update({
      where: { id: verification.userId },
      data: { passwordHash },
    });

    // Mark token as used
    await prisma.passwordReset.update({
      where: { token },
      data: { usedAt: new Date() },
    });

    return { success: true };
  } catch (error) {
    console.error('Password reset error:', error);
    return { success: false, message: 'An error occurred' };
  }
}
