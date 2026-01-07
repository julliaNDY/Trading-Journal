import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import type { User } from '@supabase/supabase-js'
import { authLogger } from '@/lib/logger'

// Helper pour obtenir l'URL de l'app
function getAppUrl(): string {
  return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

// Extract Discord username based on auth provider
function extractDiscordUsername(user: User): string | null {
  const provider = user.app_metadata?.provider
  
  if (provider === 'discord') {
    // Discord OAuth: username is in user_name or full_name
    return user.user_metadata?.user_name 
        || user.user_metadata?.full_name 
        || null
  }
  
  // Manual signup: discordUsername was passed in metadata
  return user.user_metadata?.discordUsername || null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  const type = searchParams.get('type') // 'signup', 'recovery', 'email_change'
  
  const appUrl = getAppUrl()

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // Extract Discord username (from OAuth or manual signup)
      const discordUsername = extractDiscordUsername(data.user)
      
      // Vérifier si l'utilisateur existe dans public.users
      const existingUser = await prisma.user.findUnique({
        where: { id: data.user.id },
        select: { id: true, discordUsername: true },
      })

      if (!existingUser) {
        // Nouveau user (inscription confirmée ou OAuth) - créer dans public.users
        try {
          await prisma.user.create({
            data: {
              id: data.user.id,
              email: data.user.email!,
              discordUsername,
            },
          })
        } catch (e) {
          // User pourrait déjà exister (race condition) - ignorer
          authLogger.debug('User creation skipped (may already exist)', e)
        }
      } else if (!existingUser.discordUsername && discordUsername) {
        // User existe mais n'a pas de Discord username - update si on en a un
        try {
          await prisma.user.update({
            where: { id: data.user.id },
            data: { discordUsername },
          })
        } catch (e) {
          authLogger.warn('Failed to update Discord username', e)
        }
      }

      // Si password recovery, rediriger vers page de reset
      if (type === 'recovery') {
        return NextResponse.redirect(`${appUrl}/reset-password`)
      }

      return NextResponse.redirect(`${appUrl}${next}`)
    }
    
    authLogger.error('Code exchange failed', error)
  }

  // Erreur - rediriger vers login avec message
  return NextResponse.redirect(`${appUrl}/login?error=auth_callback_error`)
}

