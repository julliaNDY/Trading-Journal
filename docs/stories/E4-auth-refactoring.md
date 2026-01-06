# Epic 4: Refactoring Auth (Supabase Auth SDK)

**Epic ID:** E4  
**Estimation:** 6h  
**Statut:** Ready for Dev  
**Dépendances:** E1 (Setup Supabase)  

---

## Stories

### E4-S1: Créer middleware Next.js

**Story ID:** E4-S1  
**Points:** 3  
**Priorité:** P0 (Bloquant)

#### Description
Créer le middleware pour gérer le refresh des sessions Supabase et la protection des routes.

#### Critères d'acceptation
- [ ] Middleware créé à la racine `src/middleware.ts`
- [ ] Sessions Supabase rafraîchies automatiquement
- [ ] Routes dashboard protégées
- [ ] Routes auth redirigent si déjà connecté

#### Fichier à créer

**`src/middleware.ts`**
```typescript
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

  // Refresh session - IMPORTANT: ne pas supprimer
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Routes protégées (dashboard)
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

  // Routes auth (login, register)
  const authPaths = ['/login', '/register']
  const isAuthRoute = authPaths.includes(request.nextUrl.pathname)

  // Rediriger vers dashboard si déjà authentifié sur route auth
  if (user && isAuthRoute) {
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
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
```

---

### E4-S2: Créer route callback auth

**Story ID:** E4-S2  
**Points:** 2  
**Priorité:** P0 (Bloquant)

#### Description
Créer la route qui gère les callbacks d'authentification (confirmation email, magic link, reset password).

#### Critères d'acceptation
- [ ] Route `/auth/callback` créée
- [ ] Échange du code contre une session
- [ ] Création user dans public.users si nouveau
- [ ] Redirection appropriée selon le type

#### Fichier à créer

**`src/app/auth/callback/route.ts`**
```typescript
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
      // Vérifier/créer user dans public.users
      const existingUser = await prisma.user.findUnique({
        where: { id: data.user.id },
      })

      if (!existingUser) {
        // Nouveau user (inscription confirmée)
        try {
          await prisma.user.create({
            data: {
              id: data.user.id,
              email: data.user.email!,
              discordUsername: data.user.user_metadata?.discordUsername || null,
            },
          })
        } catch (e) {
          // User pourrait déjà exister (race condition)
          console.log('User creation in callback:', e)
        }
      }

      // Redirection selon le type
      if (type === 'recovery') {
        // Password reset - rediriger vers page de reset
        return NextResponse.redirect(`${origin}/reset-password`)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Erreur - rediriger vers login avec message
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
}
```

---

### E4-S3: Refactorer `src/lib/auth.ts`

**Story ID:** E4-S3  
**Points:** 3  
**Priorité:** P0 (Bloquant)

#### Description
Simplifier auth.ts pour utiliser Supabase au lieu du JWT maison.

#### Critères d'acceptation
- [ ] `getUser()` utilise Supabase
- [ ] `requireAuth()` fonctionne
- [ ] Fonctions hashPassword/verifyPassword supprimées
- [ ] Fonctions createSession/destroySession supprimées
- [ ] Interface identique pour les consommateurs

#### Modification

**`src/lib/auth.ts`** (NOUVEAU CONTENU)
```typescript
import { createClient } from '@/lib/supabase/server'
import prisma from './prisma'

export interface UserSession {
  id: string
  email: string
  createdAt: Date
  isBlocked: boolean
  discordUsername: string | null
}

export async function getUser(): Promise<UserSession | null> {
  const supabase = await createClient()

  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser()

  if (error || !authUser) {
    return null
  }

  // Récupérer les données supplémentaires de public.users
  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: {
      id: true,
      email: true,
      createdAt: true,
      isBlocked: true,
      discordUsername: true,
    },
  })

  // Si user bloqué, refuser l'accès
  if (user?.isBlocked) {
    return null
  }

  return user
}

export async function requireAuth(): Promise<UserSession> {
  const user = await getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

// Pour les opérations admin
export async function requireAdmin(): Promise<UserSession> {
  const user = await requireAuth()
  // TODO: Ajouter vérification admin si nécessaire
  return user
}
```

---

### E4-S4: Refactorer `src/app/actions/auth.ts`

**Story ID:** E4-S4  
**Points:** 5  
**Priorité:** P0 (Bloquant)

#### Description
Réécrire les actions d'authentification pour utiliser Supabase.

#### Critères d'acceptation
- [ ] `register()` crée user via Supabase
- [ ] `login()` authentifie via Supabase
- [ ] `logout()` déconnecte via Supabase
- [ ] Messages d'erreur en français
- [ ] Validation Zod conservée

#### Modification

**`src/app/actions/auth.ts`** (NOUVEAU CONTENU)
```typescript
'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import prisma from '@/lib/prisma'

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
): Promise<{ error?: string; success?: boolean; message?: string }> {
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
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
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
      return { error: error.message }
    }

    if (!data.user) {
      return { error: "Erreur lors de l'inscription" }
    }

    // Note: L'user sera créé dans public.users via le callback
    // après confirmation de l'email

    return {
      success: true,
      message: 'Vérifiez votre email pour confirmer votre inscription',
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

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?type=recovery`,
    })

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
```

---

### E4-S5: Mettre à jour page Login

**Story ID:** E4-S5  
**Points:** 2  
**Priorité:** P0 (Bloquant)

#### Description
Adapter la page login pour Supabase (message de confirmation email).

#### Critères d'acceptation
- [ ] Affiche message si email non confirmé
- [ ] Gère les erreurs Supabase
- [ ] UI inchangée (sauf messages)

#### Points de modification
- Ajouter affichage du paramètre `?error=` dans l'URL
- Messages traduits en français

---

### E4-S6: Mettre à jour page Register

**Story ID:** E4-S6  
**Points:** 2  
**Priorité:** P0 (Bloquant)

#### Description
Adapter la page register pour le flow Supabase avec confirmation email.

#### Critères d'acceptation
- [ ] Affiche message de confirmation email après inscription
- [ ] Pas de redirection auto vers dashboard
- [ ] UI claire sur le flow

---

### E4-S7: Mettre à jour page Forgot Password

**Story ID:** E4-S7  
**Points:** 2  
**Priorité:** P1 (Important)

#### Description
Simplifier la page forgot-password pour utiliser Supabase.

#### Modification

**`src/app/(auth)/forgot-password/page.tsx`** (simplifier)
```typescript
'use client'

import { useState } from 'react'
import { requestPasswordReset } from '@/app/actions/auth'
// ... UI similaire mais appelle requestPasswordReset()
```

---

### E4-S8: Mettre à jour page Reset Password

**Story ID:** E4-S8  
**Points:** 2  
**Priorité:** P1 (Important)

#### Description
Adapter la page reset-password pour le flow Supabase.

#### Modification

**`src/app/(auth)/reset-password/page.tsx`** (simplifier)
```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updatePassword } from '@/app/actions/auth'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return
    }
    
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères')
      return
    }

    setLoading(true)
    const result = await updatePassword(password)
    setLoading(false)

    if (result.success) {
      router.push('/dashboard')
    } else {
      setError(result.error || 'Une erreur est survenue')
    }
  }

  // ... UI du formulaire
}
```

---

## Checklist Epic E4

- [ ] E4-S1: Middleware créé
- [ ] E4-S2: Route callback créée
- [ ] E4-S3: auth.ts refactoré
- [ ] E4-S4: actions/auth.ts refactoré
- [ ] E4-S5: Page login mise à jour
- [ ] E4-S6: Page register mise à jour
- [ ] E4-S7: Page forgot-password mise à jour
- [ ] E4-S8: Page reset-password mise à jour

**Epic E4 terminé quand :** Login/Register/Logout fonctionnent via Supabase.

