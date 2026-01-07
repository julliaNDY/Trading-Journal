import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { authLogger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error_param = searchParams.get('error')
  const error_description = searchParams.get('error_description')
  
  // Déterminer l'origin correct (utiliser APP_URL pour éviter les problèmes)
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  // Si erreur Supabase directe
  if (error_param || error_description) {
    authLogger.error('Recovery callback error', { error_param, error_description })
    return NextResponse.redirect(`${appUrl}/forgot-password?error=recovery_error&desc=${encodeURIComponent(error_description || error_param || '')}`)
  }

  // Gérer le PKCE flow (code dans query params)
  if (code) {
    try {
      const supabase = await createClient()
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)

      if (!error && data?.session) {
        return NextResponse.redirect(`${appUrl}/reset-password`)
      }

      authLogger.error('Code exchange failed', error)
      return NextResponse.redirect(`${appUrl}/forgot-password?error=code_exchange_failed&desc=${encodeURIComponent(error?.message || '')}`)
    } catch (e) {
      authLogger.error('Recovery callback exception', e)
      return NextResponse.redirect(`${appUrl}/forgot-password?error=exception`)
    }
  }

  // Pas de code - rediriger vers reset-password pour client-side handling
  return NextResponse.redirect(`${appUrl}/reset-password`)
}

