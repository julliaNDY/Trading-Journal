# Trading Path Journal

Une plateforme complète de journal de trading et d'analytics, permettant d'importer, analyser et améliorer vos performances de trading.

## ✨ Fonctionnalités

### Core Features
- 📊 **Dashboard** : Vue d'ensemble avec KPIs (Profit Factor, Win Rate, RR moyen), courbe d'équité, rentabilité par heure
- 📖 **Journal** : Calendrier interactif pour consulter et annoter chaque journée de trading
- 📅 **Calendrier** : Vue mensuelle du PnL quotidien avec code couleur
- 📈 **Statistiques** : Analytics avancées avec filtres (période, symbole, tags, comptes)
- 📥 **Import CSV** : Import par glisser-déposer avec mapping des colonnes et détection des doublons
- 🏷️ **Tags** : Système de tags personnalisables pour trades et journées
- 🌍 **i18n** : Interface en français et anglais

### Features Avancées
- 🎯 **Playbooks** : Bibliothèque de stratégies avec checklists et partage public
- 🎙️ **Voice Notes** : Notes vocales avec transcription automatique (Whisper) et résumé IA
- 🤖 **AI Coach** : Assistant de coaching trading alimenté par Google Gemini
- 📸 **OCR Import** : Import de trades via capture d'écran (Google Cloud Vision)
- 🔗 **Broker Sync** : Synchronisation automatique avec 9/10 Tier 1 brokers (Alpaca, OANDA, TopstepX, TradeStation, Charles Schwab + 5 autres POST-LAUNCH)
- 💳 **Subscriptions** : Système d'abonnement SaaS avec Stripe
- 🗳️ **Beta Voting** : Système de vote pour les nouvelles fonctionnalités

## 🛠️ Stack Technique

### Framework & Runtime
- **Framework** : Next.js 15 (App Router) + TypeScript 5.6
- **React** : 18.3.1
- **Runtime** : Node.js 20.x LTS

### Database & Backend
- **Database** : PostgreSQL via Supabase
- **ORM** : Prisma 5.22
- **Auth** : Supabase Auth (OAuth + Magic Link)
- **Storage** : Supabase Storage + Local filesystem

### UI & Styling
- **CSS** : TailwindCSS 3.4
- **Components** : shadcn/ui (Radix UI)
- **Icons** : Lucide React
- **Charts** : Recharts + Lightweight Charts

### Services Externes
- **AI** : Google Gemini (coaching) + OpenAI Whisper (transcription)
- **Payments** : Stripe
- **OCR** : Google Cloud Vision
- **Email** : Supabase Auth (Magic Link)

### Build & Dev
- **Linting** : ESLint
- **Tests** : Vitest
- **CSV Parsing** : PapaParse

## 🌐 Broker Support

### Tier 1 - Operational Brokers (9/10) ✅
- **Alpaca** (Stocks + Crypto) - 2M traders
- **OANDA** (Forex + CFDs) - 300K traders
- **TopstepX** (Futures) - 50K traders
- **TradeStation** (All markets) - 150K traders
- **Charles Schwab** (All markets) - 33M traders [IN PROGRESS - 80% ready]

### Tier 2 - Coming Soon (Feb 10+)
- Interactive Brokers (IBKR)
- Coinbase Advanced (Crypto)
- E*TRADE
- Firstrade
- Webull

**Total Coverage**: 90M+ traders, $100B+ in assets

For detailed broker status, see `docs/BROKERS-STATUS-SUMMARY.md`

## 📋 Prérequis

- Node.js 20.x ou supérieur
- npm 10.x ou supérieur
- Compte Supabase (gratuit pour développement)
- Compte Stripe (pour les abonnements)

## 🚀 Installation Locale

### 1. Cloner le projet

```bash
git clone <repo-url>
cd trading-journal
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer l'environnement

```bash
cp env.example .env
```

Éditer `.env` avec vos valeurs (voir `env.example` pour les détails) :

```env
# Database (Supabase)
DATABASE_URL="postgresql://..."

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."
SUPABASE_SERVICE_ROLE_KEY="eyJ..."

# App
APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# OpenAI (transcription vocale)
OPENAI_API_KEY="sk-..."

# Stripe (abonnements)
STRIPE_SECRET_KEY="sk_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

### 4. Synchroniser la base de données

```bash
npx prisma db push
```

### 5. Initialiser les plans Stripe

```bash
npm run seed:plans
```

### 6. Lancer le serveur de développement

```bash
npm run dev
```

L'application sera accessible sur `http://localhost:3000`

**Scripts de développement supplémentaires :**
- `npm run dev:check` - Vérifier si le port 3000 est utilisé
- `npm run dev:safe` - Arrêter le processus existant et démarrer
- `npm run dev:kill` - Arrêter le processus sur le port 3000

## 📁 Structure du Projet

```
src/
├── app/
│   ├── (auth)/              # Pages login/register/forgot-password
│   ├── (dashboard)/         # Pages protégées (dashboard, journal, etc.)
│   ├── (public)/            # Pages publiques (landing, pricing)
│   ├── actions/             # Server Actions (19 fichiers)
│   ├── api/                 # Route Handlers (15 endpoints)
│   ├── auth/                # Callbacks auth Supabase
│   └── playbooks/           # Pages playbooks
├── components/
│   ├── ui/                  # Composants shadcn/ui
│   ├── layout/              # Sidebar, Topbar, Footer
│   ├── charts/              # Graphiques (Recharts, TradingView)
│   ├── audio/               # Voice notes
│   ├── coach/               # AI Coach UI
│   └── admin/               # Admin dashboard
├── hooks/                   # Hooks React personnalisés
├── i18n/                    # Configuration i18n
├── lib/                     # Utilitaires (auth, prisma, utils)
├── services/                # Logique métier (11 services)
└── types/                   # Types TypeScript partagés
```

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [`docs/development-setup.md`](docs/development-setup.md) | Guide de setup développeur complet |
| [`docs/architecture/tech-stack.md`](docs/architecture/tech-stack.md) | Stack technique détaillée |
| [`docs/architecture/coding-standards.md`](docs/architecture/coding-standards.md) | Standards de code |
| [`docs/architecture/source-tree.md`](docs/architecture/source-tree.md) | Structure du projet |
| [`docs/architecture/api-reference.md`](docs/architecture/api-reference.md) | Documentation API |
| [`docs/architecture/database-schema.md`](docs/architecture/database-schema.md) | Schéma de base de données |
| [`docs/architecture/services-documentation.md`](docs/architecture/services-documentation.md) | Documentation des services |
| [`GUIDE_ADMINISTRATEUR.md`](GUIDE_ADMINISTRATEUR.md) | Guide pour administrateurs non-techniques |

## 🧪 Tests

```bash
# Exécuter les tests
npm run test

# Tests en mode watch
npm run test:watch

# Tests avec couverture
npm run test:coverage
```

## 🔧 Commandes Utiles

```bash
npm run dev          # Serveur de développement
npm run build        # Build de production
npm run start        # Serveur de production
npm run lint         # Linting ESLint
npm run test         # Tests Vitest
npm run seed:plans   # Initialiser les plans Stripe dans la DB
```

### Commandes Prisma

```bash
npx prisma generate  # Générer le client Prisma
npx prisma db push   # Synchroniser le schéma avec la DB
npx prisma studio    # Interface graphique pour la DB
npx prisma migrate   # Appliquer les migrations
```

## 🚀 Déploiement

### Production (VPS)

Voir [`GUIDE_ADMINISTRATEUR.md`](GUIDE_ADMINISTRATEUR.md) pour un guide complet de déploiement sur VPS.

**Résumé :**
1. Cloner sur le serveur
2. Configurer `.env` avec les variables de production
3. `npm install && npm run build`
4. Utiliser PM2 pour le process management
5. Configurer Nginx comme reverse proxy
6. Installer le certificat SSL avec Certbot

### Variables d'Environnement de Production

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | URL de connexion PostgreSQL Supabase |
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publique Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé secrète Supabase (admin) |
| `STRIPE_SECRET_KEY` | Clé secrète Stripe |
| `STRIPE_WEBHOOK_SECRET` | Secret du webhook Stripe |
| `OPENAI_API_KEY` | Clé API OpenAI (transcription) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Chemin vers le fichier service account GCP |

## 📊 Calculs et Formules

### Profit Factor
```
PF = Gains Bruts / |Pertes Brutes|
```

### Indice Profit Factor (0-10)
```
Index = min(10, (PF / 3) × 10)
```
Un PF de 3 correspond à un index de 10.

### Risk/Reward Ratio
```
Risque = |Prix Entrée - Stop Loss| × Quantité × Point Value
RR = |PnL Réalisé| / Risque
```

## 🔐 Sécurité

- Authentification via Supabase Auth (JWT)
- Row Level Security (RLS) sur Supabase
- Validation des inputs avec Zod
- Protection CSRF via Next.js
- Secrets jamais exposés côté client

## 📝 Licence

Projet privé - Tous droits réservés.

---

**Version** : 1.0.0  
**Dernière mise à jour** : 2026-01-17
