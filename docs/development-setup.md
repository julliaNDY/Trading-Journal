# Development Setup Guide

> Guide complet pour configurer l'environnement de développement du Trading Path Journal.

**Version** : 1.0  
**Dernière mise à jour** : 2026-01-17

---

## Table des Matières

1. [Prérequis](#prérequis)
2. [Installation](#installation)
3. [Configuration Supabase](#configuration-supabase)
4. [Configuration des Services Externes](#configuration-des-services-externes)
5. [Variables d'Environnement](#variables-denvironnement)
6. [Lancer le Projet](#lancer-le-projet)
7. [Commandes Utiles](#commandes-utiles)
8. [Troubleshooting](#troubleshooting)

---

## Prérequis

### Logiciels Requis

| Logiciel | Version | Installation |
|----------|---------|--------------|
| **Node.js** | 20.x LTS | https://nodejs.org |
| **npm** | 10.x+ | Inclus avec Node.js |
| **Git** | 2.x+ | https://git-scm.com |

### Comptes Requis

| Service | Usage | Gratuit pour dev? |
|---------|-------|-------------------|
| **Supabase** | Base de données + Auth | ✅ Oui (tier gratuit) |
| **Stripe** | Paiements (test mode) | ✅ Oui (test mode) |
| **OpenAI** | Transcription audio | ⚠️ Pay-as-you-go |
| **Google Cloud** | OCR (Cloud Vision) | ⚠️ Pay-as-you-go (free tier limité) |

### Vérification des Prérequis

```bash
# Vérifier Node.js
node --version
# v20.x.x

# Vérifier npm
npm --version
# 10.x.x

# Vérifier Git
git --version
# git version 2.x.x
```

---

## Installation

### 1. Cloner le Repository

```bash
git clone <repo-url> trading-journal
cd trading-journal
```

### 2. Installer les Dépendances

```bash
npm install
```

Cette commande exécute automatiquement `prisma generate` via le script `postinstall`.

### 3. Créer le Fichier d'Environnement

```bash
cp env.example .env
```

### 4. Configurer les Variables d'Environnement

Éditer le fichier `.env` avec vos valeurs (voir section [Variables d'Environnement](#variables-denvironnement)).

---

## Configuration Supabase

### 1. Créer un Projet Supabase

1. Aller sur https://supabase.com
2. Créer un nouveau projet
3. Noter les informations suivantes (Settings > API) :
   - Project URL
   - anon public key
   - service_role key (secret)

### 2. Configurer la Connexion Base de Données

1. Aller dans Settings > Database
2. Copier le "Connection string" (URI)
3. Remplacer `[YOUR-PASSWORD]` par le mot de passe défini à la création

```env
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
```

### 3. Configurer les Clés API

```env
NEXT_PUBLIC_SUPABASE_URL="https://[PROJECT-REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."
SUPABASE_SERVICE_ROLE_KEY="eyJ..."
```

### 4. Synchroniser le Schéma

```bash
npx prisma db push
```

### 5. Initialiser les Plans

```bash
npm run seed:plans
```

### 6. Configurer l'Auth (Optionnel)

Pour activer l'authentification OAuth (Google, GitHub) :

1. Aller dans Authentication > Providers
2. Activer les providers souhaités
3. Configurer les credentials OAuth

Voir [`docs/guides/google-oauth-setup.md`](guides/google-oauth-setup.md) pour le guide Google OAuth.

---

## Configuration des Services Externes

### OpenAI (Transcription Audio)

1. Créer un compte sur https://platform.openai.com
2. Générer une API key : API Keys > Create new secret key
3. Ajouter au `.env` :

```env
OPENAI_API_KEY="sk-..."
```

**Coût estimé** : ~$0.006/minute audio (Whisper)

### Stripe (Paiements)

1. Créer un compte sur https://dashboard.stripe.com
2. En mode **Test**, récupérer les clés :
   - Developers > API keys
   - Publishable key (pk_test_...)
   - Secret key (sk_test_...)

3. Créer un webhook :
   - Developers > Webhooks > Add endpoint
   - URL : `http://localhost:3000/api/stripe/webhook` (dev) ou `https://votre-domaine.com/api/stripe/webhook` (prod)
   - Events à écouter :
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.paid`
     - `invoice.payment_failed`
   - Copier le Signing secret (whsec_...)

```env
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

### Google Cloud Vision (OCR)

1. Créer un projet sur https://console.cloud.google.com
2. Activer l'API Cloud Vision
3. Créer un Service Account :
   - IAM & Admin > Service Accounts > Create
   - Donner le rôle "Cloud Vision API User"
   - Créer une clé JSON

4. Stocker le fichier JSON de manière sécurisée (hors du repo!)

```env
GOOGLE_APPLICATION_CREDENTIALS="/chemin/absolu/vers/service-account.json"
```

### Google Gemini (AI Coach)

1. Accéder à https://makersuite.google.com/app/apikey
2. Créer une API key

```env
GOOGLE_API_KEY="AIza..."
```

---

## Variables d'Environnement

### Référence Complète

```env
# ===========================================
# DATABASE (Supabase PostgreSQL)
# ===========================================
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"

# ===========================================
# SUPABASE
# ===========================================
NEXT_PUBLIC_SUPABASE_URL="https://[PROJECT-REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."
SUPABASE_SERVICE_ROLE_KEY="eyJ..."

# ===========================================
# APP
# ===========================================
APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
UPLOAD_DIR="public/uploads"
BACKUP_DIR="backups"

# ===========================================
# OPENAI (Transcription)
# ===========================================
OPENAI_API_KEY="sk-..."

# ===========================================
# GOOGLE (AI Coach + OCR)
# ===========================================
GOOGLE_API_KEY="AIza..."  # Pour Gemini
GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"  # Pour Vision

# ===========================================
# STRIPE (Paiements)
# ===========================================
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# ===========================================
# BROKER SYNC (Optionnel)
# ===========================================
BROKER_ENCRYPTION_KEY=""  # openssl rand -base64 32
SCHEDULER_SECRET=""       # openssl rand -base64 32
```

### Variables Requises vs Optionnelles

| Variable | Requis | Description |
|----------|--------|-------------|
| `DATABASE_URL` | ✅ | Connexion PostgreSQL |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | URL Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Clé publique Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Clé secrète Supabase |
| `APP_URL` | ✅ | URL de l'application |
| `OPENAI_API_KEY` | ⚠️ | Requis pour voice notes |
| `GOOGLE_API_KEY` | ⚠️ | Requis pour AI Coach |
| `GOOGLE_APPLICATION_CREDENTIALS` | ⚠️ | Requis pour OCR |
| `STRIPE_*` | ⚠️ | Requis pour abonnements |
| `BROKER_ENCRYPTION_KEY` | ❌ | Pour broker sync |
| `SCHEDULER_SECRET` | ❌ | Pour cron jobs |

---

## Lancer le Projet

### Mode Développement

```bash
npm run dev
```

L'application sera accessible sur http://localhost:3000

### Scripts de Développement Alternatifs

```bash
# Vérifier si le port 3000 est utilisé
npm run dev:check

# Arrêter le process existant et démarrer
npm run dev:safe

# Arrêter le process sur le port 3000
npm run dev:kill
```

### Interface Prisma Studio

Pour explorer la base de données visuellement :

```bash
npx prisma studio
```

Ouvre une interface web sur http://localhost:5555

---

## Commandes Utiles

### Développement

```bash
npm run dev          # Serveur de développement
npm run build        # Build de production
npm run start        # Serveur de production
npm run lint         # Linting ESLint
```

### Base de Données

```bash
npx prisma generate  # Générer le client Prisma
npx prisma db push   # Synchroniser le schéma
npx prisma studio    # Interface graphique
npx prisma migrate dev --name <name>  # Créer une migration
npx prisma migrate deploy  # Appliquer les migrations (prod)
```

### Tests

```bash
npm run test         # Exécuter les tests
npm run test:watch   # Tests en mode watch
npm run test:coverage # Tests avec couverture
```

### Scripts Métier

```bash
npm run seed:plans   # Initialiser les plans Stripe
```

---

## Troubleshooting

### Erreur "Cannot connect to database"

**Symptôme** : Erreur de connexion PostgreSQL au démarrage.

**Solutions** :
1. Vérifier que `DATABASE_URL` est correct dans `.env`
2. Vérifier que le projet Supabase est actif (non pausé)
3. Vérifier les espaces/caractères spéciaux dans le mot de passe (URL-encode si nécessaire)

```bash
# Tester la connexion
npx prisma db pull
```

### Erreur "Module not found: @prisma/client"

**Symptôme** : Le client Prisma n'est pas généré.

**Solution** :
```bash
npx prisma generate
```

### Erreur "Port 3000 already in use"

**Symptôme** : Le port est déjà utilisé par un autre process.

**Solution** :
```bash
npm run dev:safe
# ou
npm run dev:kill && npm run dev
```

### Erreur "OPENAI_API_KEY not set"

**Symptôme** : Les fonctionnalités de transcription ne fonctionnent pas.

**Solution** :
1. Créer une clé API sur https://platform.openai.com
2. Ajouter `OPENAI_API_KEY=sk-...` dans `.env`
3. Redémarrer le serveur de développement

### Erreur Stripe Webhook en Local

**Symptôme** : Les webhooks Stripe ne sont pas reçus en développement local.

**Solution** : Utiliser Stripe CLI pour le forwarding local :

```bash
# Installer Stripe CLI
brew install stripe/stripe-cli/stripe  # macOS
# ou télécharger depuis https://stripe.com/docs/stripe-cli

# Se connecter
stripe login

# Forward les webhooks vers localhost
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Copier le webhook signing secret affiché
```

### Erreur Google Cloud Vision

**Symptôme** : L'OCR ne fonctionne pas.

**Solutions** :
1. Vérifier que `GOOGLE_APPLICATION_CREDENTIALS` pointe vers un fichier JSON valide
2. Vérifier que l'API Cloud Vision est activée dans le projet GCP
3. Vérifier que le service account a les permissions nécessaires

### Build échoue avec erreur TypeScript

**Symptôme** : Erreurs de type lors du build.

**Solution** :
```bash
# Vérifier les erreurs TypeScript
npx tsc --noEmit

# Régénérer les types Prisma
npx prisma generate
```

---

## Structure des Dossiers de Développement

```
.
├── .env                  # Variables d'environnement (ignoré par git)
├── .env.example          # Template des variables
├── prisma/
│   ├── schema.prisma     # Schéma de base de données
│   └── migrations/       # Migrations Prisma
├── src/
│   ├── app/              # App Router Next.js
│   ├── components/       # Composants React
│   ├── lib/              # Utilitaires
│   └── services/         # Logique métier
├── public/
│   └── uploads/          # Fichiers uploadés (dev)
├── docs/                 # Documentation
└── scripts/              # Scripts utilitaires
```

---

## Prochaines Étapes

Après avoir configuré l'environnement :

1. **Créer un compte utilisateur** : Accéder à http://localhost:3000 et créer un compte
2. **Importer des trades** : Utiliser la page Import avec un fichier CSV
3. **Explorer le dashboard** : Voir les statistiques générées
4. **Configurer les playbooks** : Créer des stratégies de trading

---

## Ressources Additionnelles

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com)
- [TailwindCSS Documentation](https://tailwindcss.com/docs)
