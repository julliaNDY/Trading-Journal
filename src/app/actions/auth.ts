'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import prisma from '@/lib/prisma'
import { authLogger } from '@/lib/logger'

// Helper pour obtenir l'URL de l'app côté serveur (runtime, pas build-time)
function getAppUrl(): string {
  const appUrl = process.env.APP_URL
  const nextPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL
  
  // Priorité à APP_URL (variable serveur pure, lue à runtime)
  let url = appUrl || nextPublicAppUrl || 'http://localhost:3000'
  
  // Validation : rejeter les URLs invalides
  if (url.includes('0.0.0.0') || url.includes('localhost')) {
    authLogger.warn('Using localhost/0.0.0.0 URL - ensure APP_URL is set in production')
  }
  
  // S'assurer que l'URL a un protocole
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`
  }
  
  // Enlever le trailing slash
  url = url.replace(/\/$/, '')
  
  return url
}

const registerSchema = z
  .object({
    email: z.string().email('Email invalide'),
    discordUsername: z.string().optional(),
    password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  })

const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
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
    return { error: validatedData.error.errors[0].message }
  }

  const { email, password, discordUsername } = validatedData.data

  try {
    const supabase = await createClient()

    // Créer user dans Supabase Auth
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
      // Traduire les erreurs Supabase courantes
      if (error.message.includes('already registered')) {
        return { error: 'Cet email est déjà utilisé' }
      }
      if (error.message.includes('Password should be')) {
        return { error: 'Le mot de passe doit contenir au moins 6 caractères' }
      }
      return { error: error.message }
    }

    if (!data.user) {
      return { error: "Erreur lors de l'inscription" }
    }

    // Note: L'user sera créé dans public.users via le callback
    // après confirmation de l'email

    return {
      success: true,
      needsEmailConfirmation: true,
    }
  } catch (error) {
    authLogger.error('Register error', error)
    return { error: "Une erreur est survenue lors de l'inscription" }
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
    // Vérifier si user est bloqué avant auth
    const publicUser = await prisma.user.findFirst({
      where: { email },
      select: { isBlocked: true },
    })

    if (publicUser?.isBlocked) {
      return { error: 'Votre compte a été bloqué. Contactez un administrateur.' }
    }

    const supabase = await createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      // Traduire les erreurs Supabase courantes
      if (error.message.includes('Invalid login credentials')) {
        return { error: 'Email ou mot de passe incorrect' }
      }
      if (error.message.includes('Email not confirmed')) {
        return { error: 'Veuillez confirmer votre email avant de vous connecter' }
      }
      return { error: error.message }
    }
  } catch (error) {
    authLogger.error('Login error', error)
    return { error: 'Une erreur est survenue lors de la connexion' }
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
    // Utiliser le callback route pour que le code soit échangé côté serveur
    // où les cookies (code_verifier PKCE) sont accessibles
    const redirectUrl = `${getAppUrl()}/auth/callback?type=recovery`

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    })

    if (error) {
      authLogger.error('Password reset error', error)
    }

    // Toujours retourner success pour éviter l'énumération d'emails
    return { success: true }
  } catch (error) {
    authLogger.error('Password reset exception', error)
    return { success: true } // Ne pas révéler d'erreur
  }
}

export async function updatePassword(
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (newPassword.length < 8) {
      return { success: false, error: 'Le mot de passe doit contenir au moins 8 caractères' }
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
    return { success: false, error: 'Une erreur est survenue' }
  }
}
