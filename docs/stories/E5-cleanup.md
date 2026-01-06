# Epic 5: Suppression Code Legacy + Cleanup

**Epic ID:** E5  
**Estimation:** 2h  
**Statut:** Ready for Dev  
**Dépendances:** E4 (Auth refactoré et testé)  

---

## Stories

### E5-S1: Supprimer fichiers obsolètes

**Story ID:** E5-S1  
**Points:** 1  
**Priorité:** P0 (Bloquant)

#### Description
Supprimer les fichiers qui ne sont plus utilisés après la migration.

#### Critères d'acceptation
- [ ] `src/services/email-service.ts` supprimé
- [ ] `src/app/actions/password-reset.ts` supprimé
- [ ] Aucune référence restante à ces fichiers

#### Fichiers à supprimer

```bash
rm src/services/email-service.ts
rm src/app/actions/password-reset.ts
```

#### Vérification
```bash
# Vérifier qu'aucun import ne référence ces fichiers
grep -r "email-service" src/
grep -r "password-reset" src/
```

---

### E5-S2: Supprimer dépendances obsolètes

**Story ID:** E5-S2  
**Points:** 1  
**Priorité:** P0 (Bloquant)

#### Description
Désinstaller les packages npm qui ne sont plus nécessaires.

#### Critères d'acceptation
- [ ] bcryptjs désinstallé
- [ ] jose désinstallé
- [ ] nodemailer désinstallé
- [ ] Types correspondants désinstallés

#### Commandes

```bash
npm uninstall bcryptjs jose nodemailer
npm uninstall @types/bcryptjs @types/nodemailer
```

#### Vérification
```bash
# Vérifier que les imports ne sont plus présents
grep -r "from 'bcryptjs'" src/
grep -r "from 'jose'" src/
grep -r "from 'nodemailer'" src/
```

---

### E5-S3: Nettoyer variables d'environnement

**Story ID:** E5-S3  
**Points:** 1  
**Priorité:** P1 (Important)

#### Description
Supprimer les variables d'environnement obsolètes.

#### Critères d'acceptation
- [ ] `.env.example` mis à jour
- [ ] Variables legacy commentées ou supprimées
- [ ] Documentation claire des nouvelles variables

#### Variables à supprimer

```env
# À SUPPRIMER de .env et .env.example
JWT_SECRET=xxx
SMTP_HOST=xxx
SMTP_PORT=xxx
SMTP_USER=xxx
SMTP_PASS=xxx
SMTP_FROM=xxx
SMTP_SECURE=xxx
```

#### Fichier `.env.example` final

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
# UPLOADS (inchangé)
# ===================
UPLOAD_DIR=public/uploads
BACKUP_DIR=backups
```

---

### E5-S4: Nettoyer imports inutilisés

**Story ID:** E5-S4  
**Points:** 1  
**Priorité:** P1 (Important)

#### Description
Supprimer tous les imports orphelins dans le code.

#### Critères d'acceptation
- [ ] Aucun import inutilisé
- [ ] ESLint/TypeScript clean
- [ ] Build sans warning

#### Commandes

```bash
# Vérifier les imports inutilisés
npx eslint src/ --fix

# Build pour vérifier
npm run build
```

---

### E5-S5: Mettre à jour README.md

**Story ID:** E5-S5  
**Points:** 2  
**Priorité:** P1 (Important)

#### Description
Mettre à jour la documentation pour refléter la nouvelle architecture.

#### Critères d'acceptation
- [ ] Section "Installation" mise à jour
- [ ] Variables d'environnement documentées
- [ ] Mention de Supabase ajoutée
- [ ] Ancien système auth retiré

#### Sections à mettre à jour

```markdown
## Stack Technique

- Next.js 14 (App Router) + TypeScript
- **Supabase** (PostgreSQL + Auth)
- Prisma ORM
- TailwindCSS + shadcn/ui
- Recharts

## Variables d'Environnement

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Connection string PostgreSQL Supabase |
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé anonyme Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service (backend only) |
| `NEXT_PUBLIC_APP_URL` | URL de l'application |

## Installation

1. Cloner le repo
2. `npm install`
3. Créer un projet Supabase et récupérer les credentials
4. Copier `.env.example` vers `.env` et remplir
5. `npx prisma db push`
6. `npm run dev`
```

---

### E5-S6: Mettre à jour backup script

**Story ID:** E5-S6  
**Points:** 2  
**Priorité:** P2 (Nice to have)

#### Description
Adapter le script de backup pour PostgreSQL au lieu de MySQL.

#### Critères d'acceptation
- [ ] Script utilise pg_dump ou Supabase API
- [ ] Backup fonctionnel

#### Notes
- Supabase inclut des backups automatiques quotidiens
- Le script custom peut être simplifié ou supprimé
- Alternative : utiliser Supabase CLI pour les backups

```typescript
// scripts/backup.ts (nouvelle version)
import { exec } from 'child_process'

// Option 1: Utiliser pg_dump
const command = `pg_dump "${process.env.DATABASE_URL}" > backups/db-${Date.now()}.sql`

// Option 2: Utiliser Supabase CLI
// supabase db dump -f backups/db-${Date.now()}.sql

// Option 3: Simplement documenter que Supabase gère les backups
```

---

## Checklist Epic E5

- [ ] E5-S1: Fichiers obsolètes supprimés
- [ ] E5-S2: Dépendances obsolètes désinstallées
- [ ] E5-S3: Variables env nettoyées
- [ ] E5-S4: Imports nettoyés
- [ ] E5-S5: README mis à jour
- [ ] E5-S6: Backup script adapté (optionnel)

**Epic E5 terminé quand :** Build clean, aucun code legacy restant.

