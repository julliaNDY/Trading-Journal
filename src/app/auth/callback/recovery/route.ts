import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const token = searchParams.get('token') // Ancien format de token
  const error_param = searchParams.get('error')
  const error_description = searchParams.get('error_description')
  
  // Déterminer l'origin correct (utiliser APP_URL pour éviter les problèmes)
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  console.log('[Recovery Callback] Full URL:', request.url)
  console.log('[Recovery Callback] Code present:', !!code)
  console.log('[Recovery Callback] Token present:', !!token)
  console.log('[Recovery Callback] Error:', error_param, error_description)
  console.log('[Recovery Callback] APP_URL:', appUrl)

  // Si erreur Supabase directe
  if (error_param || error_description) {
    console.error('[Recovery Callback] Supabase error:', error_param, error_description)
    return NextResponse.redirect(`${appUrl}/forgot-password?error=recovery_error&desc=${encodeURIComponent(error_description || error_param || '')}`)
  }

  // Gérer le PKCE flow (code dans query params)
  if (code) {
    try {
      const supabase = await createClient()
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)

      console.log('[Recovery Callback] Exchange result:', { 
        hasData: !!data, 
        hasSession: !!data?.session,
        hasUser: !!data?.user,
        error: error?.message 
      })

      if (!error && data?.session) {
        console.log('[Recovery Callback] Success! Redirecting to reset-password')
        // Rediriger vers la page de reset password
        return NextResponse.redirect(`${appUrl}/reset-password`)
      }

      console.error('[Recovery Callback] Exchange error:', error?.message)
      return NextResponse.redirect(`${appUrl}/forgot-password?error=code_exchange_failed&desc=${encodeURIComponent(error?.message || '')}`)
    } catch (e) {
      console.error('[Recovery Callback] Exception:', e)
      return NextResponse.redirect(`${appUrl}/forgot-password?error=exception`)
    }
  }

  // Pas de code - peut-être implicit flow ou erreur
  // Rediriger vers reset-password qui tentera de gérer les hash fragments côté client
  console.log('[Recovery Callback] No code found, redirecting to reset-password for client-side handling')
  return NextResponse.redirect(`${appUrl}/reset-password`)
}

