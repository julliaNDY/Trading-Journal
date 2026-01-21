import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import type { User } from '@supabase/supabase-js'
import { authLogger } from '@/lib/logger'

// Helper pour obtenir l'URL de l'app
function getAppUrl(): string {
  return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

// Extract Discord data from user metadata
// Works for: Discord signup, Discord login, Discord link to existing account
interface DiscordData {
  username: string | null
  avatarUrl: string | null
  hasDiscordIdentity: boolean
}

function extractDiscordData(user: User): DiscordData {
  // Check if user has Discord identity linked (either as provider or linked identity)
  const identities = user.identities || []
  const hasDiscordIdentity = identities.some(id => id.provider === 'discord')
  const isDiscordProvider = user.app_metadata?.provider === 'discord'
  
  // If Discord is involved (primary provider OR linked identity)
  if (isDiscordProvider || hasDiscordIdentity) {
    // Discord data is in user_metadata
    const username = user.user_metadata?.user_name 
        || user.user_metadata?.full_name 
        || user.user_metadata?.name
        || null
    
    // Discord avatar URL is provided by Supabase
    const avatarUrl = user.user_metadata?.avatar_url || null
    
    return { username, avatarUrl, hasDiscordIdentity: true }
  }
  
  // Manual signup: discordUsername was passed in metadata
  return {
    username: user.user_metadata?.discordUsername || null,
    avatarUrl: null,
    hasDiscordIdentity: false,
  }
}

export async function GET(request: Request) {
  // #region agent log - helper function
  const debugLog = async (loc: string, msg: string, data: object) => {
    const logEntry = JSON.stringify({location:loc,message:msg,data,timestamp:Date.now(),sessionId:'debug-session',runId:'production'});
    console.log('[DEBUG]', logEntry); // PM2 logs backup
    try {
      const fs = await import('fs');
      const path = await import('path');
      const logPath = path.join(process.cwd(), '.cursor', 'debug.log');
      fs.mkdirSync(path.dirname(logPath), { recursive: true });
      fs.appendFileSync(logPath, logEntry + '\n');
    } catch (e) { console.error('[DEBUG LOG ERROR]', e); }
  };
  // #endregion
  
  try {
    // #region agent log
    await debugLog('callback:entry', 'Callback entry', {url:request.url,env:process.env.NODE_ENV,appUrl:process.env.APP_URL});
    // #endregion
    
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/dashboard'
    const type = searchParams.get('type') // 'signup', 'recovery', 'email_change'
    
    const appUrl = getAppUrl()
    // #region agent log
    await debugLog('callback:config', 'Config loaded', {appUrl,hasCode:!!code,codeLength:code?.length,next,type});
    // #endregion

    if (code) {
      const supabase = await createClient()
      // #region agent log
      await debugLog('callback:exchange-start', 'Attempting code exchange', {codePrefix:code.substring(0,8)});
      // #endregion
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      // #region agent log
      await debugLog('callback:exchange-result', 'Code exchange result', {hasData:!!data,hasUser:!!data?.user,hasError:!!error,errorMsg:error?.message,errorCode:error?.code});
      // #endregion

    if (!error && data.user) {
      // Extract Discord data (username + avatar) from OAuth, manual signup, or link
      const discordData = extractDiscordData(data.user)
      const hasDiscordData = discordData.hasDiscordIdentity
      
      // Vérifier si l'utilisateur existe dans public.users
      const existingUser = await prisma.user.findUnique({
        where: { id: data.user.id },
        select: { id: true, discordUsername: true, avatarUrl: true },
      })

      if (!existingUser) {
        // Nouveau user (inscription confirmée ou OAuth) - créer dans public.users
        // Vérifier aussi par email au cas où l'utilisateur existe avec un autre ID (edge case)
        const existingByEmail = await prisma.user.findUnique({
          where: { email: data.user.email! },
          select: { id: true },
        })

        if (existingByEmail) {
          // User existe déjà avec cet email mais ID différent - cas rare (migration, etc.)
          authLogger.warn('User exists with same email but different ID', { 
            existingId: existingByEmail.id, 
            newId: data.user.id 
          })
          // Ne pas créer de doublon, continuer avec l'utilisateur existant
        } else {
          try {
            await prisma.user.create({
              data: {
                id: data.user.id,
                email: data.user.email!,
                discordUsername: discordData.username,
                // Si Discord impliqué et pas d'avatar custom, utiliser l'avatar Discord
                avatarUrl: hasDiscordData ? discordData.avatarUrl : null,
              },
            })
            authLogger.info('New user created', { 
              userId: data.user.id, 
              discordUsername: discordData.username,
              hasAvatar: !!discordData.avatarUrl
            })
          } catch (e: any) {
            // Vérifier si c'est une contrainte unique (email ou id)
            if (e?.code === 'P2002' || e?.message?.includes('Unique constraint')) {
              // User existe déjà (race condition ou trigger Supabase) - ignorer
              authLogger.debug('User creation skipped (already exists)', { 
                error: e.message,
                userId: data.user.id 
              })
            } else {
              // Autre erreur - logger mais ne pas bloquer l'auth
              authLogger.error('Unexpected error creating user', e)
            }
          }
        }
      } else if (hasDiscordData) {
        // User existe et a Discord (login OU link) - TOUJOURS sync le username (peut avoir changé)
        // Et sync l'avatar si l'user n'en a pas de custom
        const updateData: { discordUsername?: string; avatarUrl?: string } = {}
        
        if (discordData.username && discordData.username !== existingUser.discordUsername) {
          updateData.discordUsername = discordData.username
        }
        
        // Sync avatar Discord seulement si pas d'avatar custom uploadé
        // (on détecte un avatar custom par le fait qu'il contient "avatars/" dans l'URL)
        const hasCustomAvatar = existingUser.avatarUrl?.includes('avatars/')
        if (discordData.avatarUrl && !hasCustomAvatar) {
          updateData.avatarUrl = discordData.avatarUrl
        }
        
        if (Object.keys(updateData).length > 0) {
          try {
            await prisma.user.update({
              where: { id: data.user.id },
              data: updateData,
            })
            authLogger.info('User Discord data synced', { userId: data.user.id, ...updateData })
          } catch (e) {
            authLogger.warn('Failed to sync Discord data', e)
          }
        }
      } else if (!existingUser.discordUsername && discordData.username) {
        // Login classique mais on a un discordUsername en metadata (inscription manuelle)
        try {
          await prisma.user.update({
            where: { id: data.user.id },
            data: { discordUsername: discordData.username },
          })
        } catch (e) {
          authLogger.warn('Failed to update Discord username', e)
        }
      }

      // Si password recovery, rediriger vers page de reset
      if (type === 'recovery') {
        return NextResponse.redirect(`${appUrl}/reset-password`)
      }

      // Si email_change, mettre à jour l'email dans public.users
      if (type === 'email_change' && data.user.email) {
        try {
          await prisma.user.update({
            where: { id: data.user.id },
            data: { email: data.user.email },
          })
          authLogger.info('Email updated in public.users', { userId: data.user.id, newEmail: data.user.email })
        } catch (e) {
          authLogger.error('Failed to update email in public.users', e)
        }
        // Redirect to settings with success message
        return NextResponse.redirect(`${appUrl}/settings?email_updated=true`)
      }

      // #region agent log
      await debugLog('callback:success', 'Success redirect', {redirectTo:`${appUrl}${next}`});
      // #endregion
      return NextResponse.redirect(`${appUrl}${next}`)
    }
    
    // #region agent log
    await debugLog('callback:exchange-failed', 'Code exchange failed', {errorMsg:error?.message,errorCode:error?.code});
    // #endregion
    authLogger.error('Code exchange failed', error)
  }

  // Erreur - rediriger vers login avec message
  const finalAppUrl = getAppUrl()
  // #region agent log
  await debugLog('callback:error-redirect', 'Error redirect', {hasCode:!!code,redirectTo:`${finalAppUrl}/login?error=auth_callback_error`});
  // #endregion
  return NextResponse.redirect(`${finalAppUrl}/login?error=auth_callback_error`)
  } catch (err: any) {
    // #region agent log - catch all errors
    console.error('[DEBUG FATAL]', err);
    const debugLogErr = async (msg: string, data: object) => {
      const logEntry = JSON.stringify({location:'callback:FATAL',message:msg,data,timestamp:Date.now()});
      console.log('[DEBUG]', logEntry);
      try {
        const fs = await import('fs');
        const path = await import('path');
        const logPath = path.join(process.cwd(), '.cursor', 'debug.log');
        fs.mkdirSync(path.dirname(logPath), { recursive: true });
        fs.appendFileSync(logPath, logEntry + '\n');
      } catch (e) { /* ignore */ }
    };
    await debugLogErr('FATAL ERROR in callback', {error:err?.message,stack:err?.stack?.substring(0,500)});
    // #endregion
    return NextResponse.redirect(`${getAppUrl()}/login?error=auth_callback_error`);
  }
}

