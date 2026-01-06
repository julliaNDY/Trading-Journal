# Epic 1: Setup Supabase + Configuration

**Epic ID:** E1  
**Estimation:** 2h  
**Statut:** Ready for Dev  
**Dépendances:** Aucune  

---

## Stories

### E1-S1: Création projet Supabase

**Story ID:** E1-S1  
**Points:** 1  
**Priorité:** P0 (Bloquant)

#### Description
Créer le projet Supabase et récupérer les credentials nécessaires.

#### Critères d'acceptation
- [ ] Projet créé sur supabase.com
- [ ] Région EU sélectionnée (eu-central-1 ou eu-west)
- [ ] Variables récupérées :
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `DATABASE_URL` (PostgreSQL connection string)

#### Actions manuelles requises
```
1. Aller sur https://supabase.com/dashboard
2. Créer un nouveau projet
3. Nom: "trading-journal-prod" (ou similaire)
4. Région: EU (Frankfurt ou autre EU)
5. Mot de passe DB: générer un fort et le sauvegarder
6. Attendre la création (~2 min)
7. Aller dans Settings > API pour récupérer les clés
8. Aller dans Settings > Database pour récupérer la connection string
```

#### Output attendu
Fichier `.env.supabase` (temporaire, à merger dans `.env` plus tard) :
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DATABASE_URL=postgresql://postgres:xxx@db.xxx.supabase.co:5432/postgres
```

---

### E1-S2: Configuration Auth Supabase

**Story ID:** E1-S2  
**Points:** 1  
**Priorité:** P0 (Bloquant)

#### Description
Configurer les paramètres d'authentification dans Supabase Dashboard.

#### Critères d'acceptation
- [ ] Site URL configuré
- [ ] Redirect URLs configurés
- [ ] Email templates personnalisés (FR)
- [ ] Confirmation email activé

#### Actions manuelles requises
```
1. Dashboard Supabase > Authentication > URL Configuration
   - Site URL: https://votre-domaine.com (ou http://localhost:3000 pour dev)
   - Redirect URLs ajouter:
     - http://localhost:3000/auth/callback
     - https://votre-domaine.com/auth/callback

2. Authentication > Email Templates
   - Personnaliser chaque template en FR :
     - Confirm signup
     - Magic Link
     - Change Email Address
     - Reset Password
```

#### Templates Email (FR)

**Confirm signup:**
```html
<h2>Bienvenue sur Trading Journal !</h2>
<p>Cliquez sur le lien ci-dessous pour confirmer votre inscription :</p>
<p><a href="{{ .ConfirmationURL }}">Confirmer mon email</a></p>
<p>Ce lien expire dans 24 heures.</p>
```

**Reset Password:**
```html
<h2>Réinitialisation de mot de passe</h2>
<p>Vous avez demandé à réinitialiser votre mot de passe Trading Journal.</p>
<p><a href="{{ .ConfirmationURL }}">Définir un nouveau mot de passe</a></p>
<p>Ce lien expire dans 1 heure.</p>
<p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
```

---

### E1-S3: Installation dépendances

**Story ID:** E1-S3  
**Points:** 1  
**Priorité:** P0 (Bloquant)

#### Description
Installer les packages Supabase nécessaires pour Next.js SSR.

#### Critères d'acceptation
- [ ] `@supabase/supabase-js` installé
- [ ] `@supabase/ssr` installé
- [ ] Pas d'erreur TypeScript

#### Commandes
```bash
npm install @supabase/supabase-js @supabase/ssr
```

#### Notes
- Ne PAS désinstaller `bcryptjs` et `jose` maintenant (sera fait en E5)
- Ces packages coexisteront temporairement

---

### E1-S4: Créer clients Supabase

**Story ID:** E1-S4  
**Points:** 2  
**Priorité:** P0 (Bloquant)

#### Description
Créer les fichiers clients Supabase pour server et browser.

#### Critères d'acceptation
- [ ] `src/lib/supabase/server.ts` créé et fonctionnel
- [ ] `src/lib/supabase/client.ts` créé et fonctionnel
- [ ] Types exportés correctement

#### Fichiers à créer

**`src/lib/supabase/server.ts`**
```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component - ignore
          }
        },
      },
    }
  )
}

export function createAdminClient() {
  const { createClient } = require('@supabase/supabase-js')
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
```

**`src/lib/supabase/client.ts`**
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

#### Tests de validation
```typescript
// Dans un fichier temporaire ou via console
import { createClient } from '@/lib/supabase/server'

const supabase = await createClient()
const { data, error } = await supabase.auth.getSession()
console.log('Supabase connection:', error ? 'FAILED' : 'OK')
```

---

### E1-S5: Mise à jour variables d'environnement

**Story ID:** E1-S5  
**Points:** 1  
**Priorité:** P0 (Bloquant)

#### Description
Mettre à jour `.env.example` et documenter les nouvelles variables.

#### Critères d'acceptation
- [ ] `.env.example` mis à jour avec nouvelles variables
- [ ] Commentaires explicatifs ajoutés
- [ ] README mis à jour si nécessaire

#### Fichier `.env.example` (mise à jour)
```env
# ===================
# DATABASE (Supabase PostgreSQL)
# ===================
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres

# ===================
# SUPABASE
# ===================
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# ===================
# APP
# ===================
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ===================
# LEGACY (à supprimer après migration)
# ===================
# JWT_SECRET=xxx
# SMTP_HOST=xxx
# SMTP_PORT=587
# SMTP_USER=xxx
# SMTP_PASS=xxx
# SMTP_FROM=xxx
# SMTP_SECURE=false
```

---

## Checklist Epic E1

- [ ] E1-S1: Projet Supabase créé
- [ ] E1-S2: Auth configuré (URLs + templates)
- [ ] E1-S3: Packages installés
- [ ] E1-S4: Clients Supabase créés
- [ ] E1-S5: Variables env documentées

**Epic E1 terminé quand :** `createClient()` retourne une connexion valide à Supabase.

