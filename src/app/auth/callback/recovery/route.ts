import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error_description = searchParams.get('error_description')

  console.log('[Recovery Callback] URL:', request.url)
  console.log('[Recovery Callback] Code present:', !!code)
  console.log('[Recovery Callback] Error description:', error_description)

  // Si erreur Supabase directe
  if (error_description) {
    console.error('[Recovery Callback] Supabase error:', error_description)
    return NextResponse.redirect(`${origin}/forgot-password?error=recovery_error`)
  }

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    console.log('[Recovery Callback] Exchange result:', { data: !!data, error: error?.message })

    if (!error && data.session) {
      // Rediriger vers la page de reset password
      return NextResponse.redirect(`${origin}/reset-password`)
    }

    console.error('[Recovery Callback] Exchange error:', error?.message)
  }

  // Erreur - rediriger vers forgot-password avec message
  return NextResponse.redirect(`${origin}/forgot-password?error=recovery_error`)
}

