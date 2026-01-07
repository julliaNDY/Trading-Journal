import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// Helper pour obtenir l'URL de l'app
function getAppUrl(): string {
  return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  const type = searchParams.get('type') // 'signup', 'recovery', 'email_change'
  
  const appUrl = getAppUrl()
  console.log('[Auth Callback] Type:', type, '| Code present:', !!code, '| APP_URL:', appUrl)

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    console.log('[Auth Callback] Exchange result:', { hasUser: !!data?.user, error: error?.message })

    if (!error && data.user) {
      // Vérifier si l'utilisateur existe dans public.users
      const existingUser = await prisma.user.findUnique({
        where: { id: data.user.id },
      })

      if (!existingUser) {
        // Nouveau user (inscription confirmée) - créer dans public.users
        try {
          await prisma.user.create({
            data: {
              id: data.user.id,
              email: data.user.email!,
              discordUsername: data.user.user_metadata?.discordUsername || null,
            },
          })
          console.log('[Auth Callback] Created new user in public.users')
        } catch (e) {
          // User pourrait déjà exister (race condition) - ignorer
          console.log('[Auth Callback] User creation error (may already exist):', e)
        }
      }

      // Si password recovery, rediriger vers page de reset
      if (type === 'recovery') {
        console.log('[Auth Callback] Recovery flow - redirecting to reset-password')
        return NextResponse.redirect(`${appUrl}/reset-password`)
      }

      return NextResponse.redirect(`${appUrl}${next}`)
    }
    
    console.error('[Auth Callback] Code exchange failed:', error?.message)
  }

  // Erreur - rediriger vers login avec message
  return NextResponse.redirect(`${appUrl}/login?error=auth_callback_error`)
}

