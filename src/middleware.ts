import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Supported locales - English is default
const locales = ['en', 'fr'] as const;
type Locale = (typeof locales)[number];
const defaultLocale: Locale = 'en';

function detectBrowserLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return defaultLocale;
  
  const languages = acceptLanguage
    .split(',')
    .map(lang => {
      const [code, qValue] = lang.trim().split(';q=');
      return {
        code: code.split('-')[0].toLowerCase(),
        quality: qValue ? parseFloat(qValue) : 1.0,
      };
    })
    .sort((a, b) => b.quality - a.quality);

  for (const lang of languages) {
    if (locales.includes(lang.code as Locale)) {
      return lang.code as Locale;
    }
  }
  
  return defaultLocale;
}

export async function middleware(request: NextRequest) {
  // ========================================
  // 1. LOCALE HANDLING
  // ========================================
  const localeCookie = request.cookies.get('locale')?.value;
  let locale: Locale;
  
  if (localeCookie && locales.includes(localeCookie as Locale)) {
    locale = localeCookie as Locale;
  } else {
    locale = detectBrowserLocale(request.headers.get('accept-language'));
  }
  
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

  const isProtectedRoute = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  )

  // Redirect to login if not authenticated on protected route
  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

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
