import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  const type = searchParams.get('type') // 'signup', 'recovery', 'email_change'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

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
        } catch (e) {
          // User pourrait déjà exister (race condition) - ignorer
          console.log('User creation in callback:', e)
        }
      }

      // Si password recovery, rediriger vers page de reset
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/reset-password`)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Erreur - rediriger vers login avec message
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
}

