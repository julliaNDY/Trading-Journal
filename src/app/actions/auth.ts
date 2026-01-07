'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import prisma from '@/lib/prisma'

// Helper pour obtenir l'URL de l'app côté serveur (runtime, pas build-time)
function getAppUrl(): string {
  // Priorité à APP_URL (variable serveur pure, lue à runtime)
  // Fallback sur NEXT_PUBLIC_APP_URL si défini
  return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
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
    console.error('Register error:', error)
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
    console.error('Login error:', error)
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

    // Note: PKCE doit être désactivé dans Supabase Dashboard pour que ça fonctionne
    // Dashboard > Authentication > Providers > Email > Désactiver "Use PKCE"
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getAppUrl()}/reset-password`,
    })

    if (error) {
      console.error('Password reset error:', error)
    }

    // Toujours retourner success pour éviter l'énumération d'emails
    return { success: true }
  } catch (error) {
    console.error('Password reset request error:', error)
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
    console.error('Update password error:', error)
    return { success: false, error: 'Une erreur est survenue' }
  }
}
