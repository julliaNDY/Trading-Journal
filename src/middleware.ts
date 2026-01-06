import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Ne pas supprimer cette ligne - elle rafraîchit la session
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Routes protégées (dashboard et sous-pages)
  const protectedPaths = [
    '/dashboard',
    '/journal',
    '/calendrier',
    '/statistiques',
    '/importer',
    '/trades',
    '/comptes',
    '/playbooks',
    '/admin',
  ]

  const isProtectedRoute = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  )

  // Rediriger vers login si non authentifié sur route protégée
  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Routes auth (login, register, forgot-password)
  // Note: /reset-password est autorisé même si connecté (pour le flux recovery)
  const authPathsToRedirect = ['/login', '/register', '/forgot-password']
  const isAuthRouteToRedirect = authPathsToRedirect.includes(request.nextUrl.pathname)

  // Rediriger vers dashboard si déjà authentifié sur route auth (sauf reset-password)
  if (user && isAuthRouteToRedirect) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files (images, etc.)
     * - api routes (handled separately)
     * - auth callback routes (handled by their own route handlers)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/|auth/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}

