import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Supported locales - English is default
const locales = ['en', 'fr'] as const;
type Locale = (typeof locales)[number];
const defaultLocale: Locale = 'en';

// Browser locale detection disabled - always default to English
// Users must explicitly set their language preference via the language switcher
// This ensures consistent experience regardless of browser settings

export async function middleware(request: NextRequest) {
  
  // ========================================
  // 1. LOCALE HANDLING
  // ========================================
  const localeCookie = request.cookies.get('locale')?.value;
  // Only use cookie if explicitly set, otherwise default to English
  const locale: Locale = (localeCookie && locales.includes(localeCookie as Locale)) 
    ? localeCookie as Locale 
    : defaultLocale;
  
  // Set locale header for next-intl
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-next-intl-locale', locale);

  // ========================================
  // 2. SUPABASE AUTH HANDLING
  // ========================================
  let supabaseResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
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
            request: {
              headers: requestHeaders,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ========================================
  // 3. ROUTE PROTECTION
  // ========================================
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
    '/settings',
  ]

  const subscriptionProtectedPaths = [
    '/dashboard',
    '/journal',
    '/statistiques',
    '/calendar',
    '/calendrier',
    '/playbooks',
    '/import',
    '/importer',
    '/accounts',
    '/comptes',
  ]

  const isProtectedRoute = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  )
  const isSubscriptionProtectedRoute = subscriptionProtectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  )

  // Redirect to landing if not authenticated on subscription route
  if (!user && isSubscriptionProtectedRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Redirect to login if not authenticated on protected route
  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // FREE BETA MODE: Subscription enforcement disabled
  // All authenticated users have full access
  // Original subscription check logic preserved below for future use:
  /*
  // Enforce subscription on gated routes
  if (user && isSubscriptionProtectedRoute) {
    try {
      // Use localhost for internal API calls to avoid SSL issues
      // The server runs HTTP internally, even if accessed via HTTPS through a reverse proxy
      const internalOrigin = process.env.NODE_ENV === 'production' 
        ? 'http://localhost:3000' 
        : request.nextUrl.origin
      const apiUrl = `${internalOrigin}/api/subscription/status`
      
      const apiResponse = await fetch(apiUrl, {
        headers: {
          cookie: request.headers.get('cookie') ?? '',
        },
        cache: 'no-store',
      })

      if (!apiResponse.ok) {
        const url = request.nextUrl.clone()
        url.pathname = '/'
        return NextResponse.redirect(url)
      }

      const data = await apiResponse.json()
      if (!data?.hasAccess) {
        const url = request.nextUrl.clone()
        url.pathname = '/'
        return NextResponse.redirect(url)
      }
    } catch (error) {
      // If subscription check fails, allow access to avoid blocking users
      // The page-level checks will handle unauthorized access
      console.error('[Middleware] Subscription check failed:', error)
    }
  }
  */

  // Auth routes that should redirect to dashboard if already logged in
  const authPathsToRedirect = ['/login', '/register', '/forgot-password']
  const isAuthRouteToRedirect = authPathsToRedirect.includes(request.nextUrl.pathname)

  if (user && isAuthRouteToRedirect) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|auth/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
