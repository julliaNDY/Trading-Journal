import { createClient } from '@/lib/supabase/server'
import prisma from './prisma'

export interface UserSession {
  id: string
  email: string
  createdAt: Date
  isBlocked: boolean
  discordUsername: string | null
}

/**
 * Récupère l'utilisateur connecté via Supabase Auth
 * Crée automatiquement l'entrée dans public.users si elle n'existe pas
 * Retourne null si non connecté ou si l'utilisateur est bloqué
 */
export async function getUser(): Promise<UserSession | null> {
  const supabase = await createClient()

  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser()

  if (error || !authUser) {
    return null
  }

  // Récupérer les données de public.users
  let user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: {
      id: true,
      email: true,
      createdAt: true,
      isBlocked: true,
      discordUsername: true,
    },
  })

  // Si l'utilisateur n'existe pas dans public.users, le créer
  if (!user) {
    try {
      user = await prisma.user.create({
        data: {
          id: authUser.id,
          email: authUser.email!,
          discordUsername: authUser.user_metadata?.discordUsername || null,
        },
        select: {
          id: true,
          email: true,
          createdAt: true,
          isBlocked: true,
          discordUsername: true,
        },
      })
    } catch (e) {
      // En cas d'erreur (race condition), réessayer de récupérer
      user = await prisma.user.findUnique({
        where: { id: authUser.id },
        select: {
          id: true,
          email: true,
          createdAt: true,
          isBlocked: true,
          discordUsername: true,
        },
      })
    }
  }

  // Si user bloqué, refuser l'accès
  if (user?.isBlocked) {
    return null
  }

  return user
}

/**
 * Requiert une authentification - lance une erreur si non connecté
 */
export async function requireAuth(): Promise<UserSession> {
  const user = await getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

/**
 * Pour les opérations admin (à étendre selon les besoins)
 */
export async function requireAdmin(): Promise<UserSession> {
  const user = await requireAuth()
  // TODO: Ajouter vérification admin si nécessaire
  return user
}
