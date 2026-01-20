'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { randomUUID } from 'crypto'
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

/**
 * Create account from Stripe checkout session and send password creation email
 */
export async function createAccountFromStripe(
  sessionId: string
): Promise<{ success: boolean; error?: string; email?: string }> {
  try {
    authLogger.info('createAccountFromStripe called', { sessionId });
    
    // Import Stripe dynamically to avoid loading it in all auth contexts
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      typescript: true,
    })

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['customer'],
    })

    authLogger.info('Stripe session retrieved', { 
      sessionId: session.id, 
      hasCustomer: !!session.customer,
      customerEmail: session.customer_details?.email 
    });

    if (!session) {
      authLogger.error('Checkout session not found', { sessionId });
      return { success: false, error: 'Checkout session not found' }
    }

    // Get customer email from session
    let customerEmail: string | null = null

    if (typeof session.customer === 'string') {
      // Customer is just an ID, need to retrieve it
      const customer = await stripe.customers.retrieve(session.customer)
      if (!customer.deleted && customer.email) {
        customerEmail = customer.email
      }
    } else if (session.customer && 'email' in session.customer) {
      // Customer is already expanded
      customerEmail = session.customer.email || null
    } else if (session.customer_details?.email) {
      // Email in customer_details
      customerEmail = session.customer_details.email
    }

    if (!customerEmail) {
      authLogger.error('No email found in checkout session', { 
        sessionId,
        customerType: typeof session.customer,
        customerDetails: session.customer_details 
      });
      return { success: false, error: 'No email found in checkout session' }
    }

    authLogger.info('Customer email extracted', { email: customerEmail });

    const supabase = await createClient()

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: customerEmail },
      select: { id: true },
    })
    
    authLogger.info('User lookup result', { 
      email: customerEmail,
      exists: !!existingUser,
      userId: existingUser?.id 
    });

    if (existingUser) {
      // User already exists, send password reset email instead
      const { error } = await supabase.auth.resetPasswordForEmail(customerEmail, {
        redirectTo: `${getAppUrl()}/auth/callback?type=recovery`,
      })

      if (error) {
        authLogger.error('Password reset email error for existing user', error)
        return { success: false, error: 'Failed to send password creation email' }
      }

      return { success: true, email: customerEmail }
    }

    // Create new user in Supabase Auth using admin client to bypass email confirmation
    // This allows us to send a password reset email immediately
    const adminClient = createAdminClient()
    const tempPassword = randomUUID() + randomUUID()

    const { data: adminUserData, error: adminUserError } = await adminClient.auth.admin.createUser({
      email: customerEmail,
      password: tempPassword,
      email_confirm: true, // Mark email as confirmed so we can send reset password email
    })

    authLogger.info('Supabase admin createUser result', { 
      email: customerEmail,
      hasUser: !!adminUserData?.user,
      userId: adminUserData?.user?.id,
      hasError: !!adminUserError,
      errorMessage: adminUserError?.message 
    });

    if (adminUserError) {
      authLogger.error('Admin create user error for Stripe checkout', adminUserError)
      
      // If user already exists in Auth but not in our DB (edge case)
      if (adminUserError.message.includes('already registered') || adminUserError.message.includes('already been registered')) {
        // Try to send password reset email instead
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(customerEmail, {
          redirectTo: `${getAppUrl()}/auth/callback?type=recovery`,
        })

        if (resetError) {
          authLogger.error('Password reset email error for existing user', resetError)
          return { success: false, error: 'Account exists but failed to send password email' }
        }

        authLogger.info('Password reset email sent to existing user', { email: customerEmail })
        return { success: true, email: customerEmail }
      }

      return { success: false, error: adminUserError.message }
    }

    if (!adminUserData?.user) {
      return { success: false, error: 'Failed to create account' }
    }

    // Create user in our database
    try {
      const user = await prisma.user.upsert({
        where: { id: adminUserData.user.id },
        create: {
          id: adminUserData.user.id,
          email: customerEmail,
        },
        update: {
          email: customerEmail,
        },
      });
      authLogger.info('User created/updated in database', { 
        userId: user.id,
        email: user.email 
      });
    } catch (e: any) {
      // Ignore if user already exists (race condition)
      if (e?.code !== 'P2002') {
        authLogger.error('Error creating user in database', { 
          error: e,
          userId: adminUserData.user.id,
          email: customerEmail 
        });
      } else {
        authLogger.debug('User already exists in database (race condition)', { 
          userId: adminUserData.user.id 
        });
      }
    }

    // Send password reset email so user can set their password
    authLogger.info('Sending password reset email', { 
      email: customerEmail,
      redirectTo: `${getAppUrl()}/auth/callback?type=recovery` 
    });
    
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(customerEmail, {
      redirectTo: `${getAppUrl()}/auth/callback?type=recovery`,
    })

    if (resetError) {
      authLogger.error('Password reset email error', { 
        error: resetError,
        email: customerEmail 
      });
      return { success: false, error: 'Account created but failed to send password email' }
    }
    
    authLogger.info('Password reset email sent successfully', { email: customerEmail });

    return { success: true, email: customerEmail }
  } catch (error) {
    authLogger.error('Create account from Stripe error', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'An error occurred' 
    }
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
