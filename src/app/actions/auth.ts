'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import prisma from '@/lib/prisma'
import { authLogger } from '@/lib/logger'

// Helper to get the app URL server-side (runtime, not build-time)
function getAppUrl(): string {
  const appUrl = process.env.APP_URL
  const nextPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL
  
  // Priority to APP_URL (pure server variable, read at runtime)
  let url = appUrl || nextPublicAppUrl || 'http://localhost:3000'
  
  // Validation: reject invalid URLs
  if (url.includes('0.0.0.0') || url.includes('localhost')) {
    authLogger.warn('Using localhost/0.0.0.0 URL - ensure APP_URL is set in production')
  }
  
  // Ensure URL has a protocol
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`
  }
  
  // Remove trailing slash
  url = url.replace(/\/$/, '')
  
  return url
}

const registerSchema = z
  .object({
    email: z.string().email('Invalid email'),
    discordUsername: z.string().optional(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
})

export async function register(
  formData: FormData
): Promise<{ error?: string; success?: boolean; message?: string; needsEmailConfirmation?: boolean }> {
  const rawData = {
    email: formData.get('email') as string,
    discordUsername: (formData.get('discordUsername') as string) || undefined,
    password: formData.get('password') as string,
    confirmPassword: formData.get('confirmPassword') as string,
  }

  const validatedData = registerSchema.safeParse(rawData)

  if (!validatedData.success) {
    // Retourner des codes d'erreur pour traduction côté client
    const firstError = validatedData.error.errors[0];
    if (firstError.message.includes('Invalid email')) {
      return { error: 'INVALID_EMAIL' };
    }
    if (firstError.message.includes('at least 8 characters')) {
      return { error: 'PASSWORD_TOO_SHORT' };
    }
    if (firstError.message.includes('do not match')) {
      return { error: 'PASSWORD_MISMATCH' };
    }
    return { error: firstError.message };
  }

  const { email, password, discordUsername } = validatedData.data

  try {
    // Check if email exists in public.users
    const existingUserByEmail = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (existingUserByEmail) {
      // User exists in public.users - check if corresponding auth user exists
      const adminClient = createAdminClient()
      const { data: authUser } = await adminClient.auth.admin.getUserById(existingUserByEmail.id)
      
      if (!authUser?.user) {
        // Orphan record: exists in public.users but not in auth.users
        // Clean up the orphan and allow re-registration
        authLogger.info(`Cleaning up orphan user record for email: ${email}`)
        await prisma.user.delete({
          where: { id: existingUserByEmail.id },
        })
        // Continue with registration
      } else {
        // Auth user exists - truly duplicate
        return { error: 'EMAIL_ALREADY_EXISTS' }
      }
    }

    const supabase = await createClient()

    // Create user in Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${getAppUrl()}/auth/callback`,
        data: {
          discordUsername,
        },
      },
    })

    if (error) {
      // Translate common Supabase errors - retourner codes pour i18n côté client
      if (error.message.includes('already registered') || error.message.includes('User already registered') || error.message.includes('already exists')) {
        return { error: 'EMAIL_ALREADY_EXISTS' }
      }
      if (error.message.includes('Password should be') || error.message.includes('Password')) {
        return { error: 'PASSWORD_TOO_SHORT' }
      }
      // Retourner le message Supabase brut pour debugging
      return { error: error.message }
    }

    if (!data.user) {
      return { error: 'Registration failed' }
    }

    // Note: User will be created in public.users via the callback
    // after email confirmation

    return {
      success: true,
      needsEmailConfirmation: true,
    }
  } catch (error) {
    authLogger.error('Register error', error)
    return { error: 'An error occurred during registration' }
  }
}

export async function login(
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const rawData = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const validatedData = loginSchema.safeParse(rawData)

  if (!validatedData.success) {
    return { error: validatedData.error.errors[0].message }
  }

  const { email, password } = validatedData.data

  try {
    // Check if user is blocked before auth
    const publicUser = await prisma.user.findFirst({
      where: { email },
      select: { isBlocked: true },
    })

    if (publicUser?.isBlocked) {
      return { error: 'ACCOUNT_BLOCKED' }
    }

    const supabase = await createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      // Translate common Supabase errors
      if (error.message.includes('Invalid login credentials')) {
        return { error: 'Invalid email or password' }
      }
      if (error.message.includes('Email not confirmed')) {
        return { error: 'Please confirm your email before logging in' }
      }
      return { error: error.message }
    }
  } catch (error) {
    authLogger.error('Login error', error)
    return { error: 'LOGIN_ERROR' }
  }

  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function requestPasswordReset(
  email: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const supabase = await createClient()
    // Use the callback route so the code is exchanged server-side
    // where cookies (PKCE code_verifier) are accessible
    const redirectUrl = `${getAppUrl()}/auth/callback?type=recovery`

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    })

    if (error) {
      authLogger.error('Password reset error', error)
    }

    // Always return success to prevent email enumeration
    return { success: true }
  } catch (error) {
    authLogger.error('Password reset exception', error)
    return { success: true } // Don't reveal errors
  }
}

export async function updatePassword(
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (newPassword.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters' }
    }

    const supabase = await createClient()

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    authLogger.error('Update password error', error)
    return { success: false, error: 'An error occurred' }
  }
}

export async function resendConfirmationEmail(
  email: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    
    // Supabase doesn't have a direct "resend" method, but we can use signUp again
    // which will send a new confirmation email if the user exists but is not confirmed
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${getAppUrl()}/auth/callback`,
      },
    })

    if (error) {
      authLogger.error('Resend confirmation email error', error)
      // Don't reveal specific errors
    }

    // Always return success to prevent email enumeration
    return { success: true }
  } catch (error) {
    authLogger.error('Resend confirmation email exception', error)
    return { success: true } // Don't reveal errors
  }
}
