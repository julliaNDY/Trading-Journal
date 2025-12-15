# Trading Journal

Une application web de journal et d'analytics de trading, permettant d'importer, analyser et améliorer vos performances de trading.

## Fonctionnalités

- 📊 **Dashboard** : Vue d'ensemble avec KPIs (Profit Factor, Win Rate, RR moyen), courbe d'équité, rentabilité par heure
- 📖 **Journal** : Calendrier interactif pour consulter et annoter chaque journée de trading
- 📅 **Calendrier** : Vue mensuelle du PnL quotidien avec code couleur
- 📈 **Statistiques** : Analytics avancées avec filtres (période, symbole, tags)
- 📥 **Import CSV** : Import par glisser-déposer avec mapping des colonnes et détection des doublons
- 🏷️ **Tags** : Système de tags personnalisables pour trades et journées
- 🌍 **i18n** : Interface en français et anglais

## Stack Technique

- **Framework** : Next.js 14 (App Router) + TypeScript
- **Base de données** : MySQL via Prisma ORM
- **Auth** : JWT + cookies httpOnly (sans provider externe)
- **UI** : TailwindCSS + shadcn/ui
- **Charts** : Recharts
- **CSV** : PapaParse

## Installation Locale

### Prérequis

- Node.js 18+
- MySQL 8+

### Étapes

1. **Cloner le projet**
```bash
git clone <repo-url>
cd trading-journal
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Configurer les variables d'environnement**
```bash
cp env.example .env
```

Éditer `.env` avec vos valeurs :
```env
DATABASE_URL="mysql://user:password@localhost:3306/trading_journal"
JWT_SECRET="votre-secret-jwt-genere-avec-openssl-rand-base64-32"
APP_URL="http://localhost:3000"
UPLOAD_DIR="public/uploads"
BACKUP_DIR="backups"
```

4. **Créer la base de données**
```bash
npx prisma db push
```

5. **Lancer le serveur de développement**
```bash
npm run dev
```

L'application sera accessible sur `http://localhost:3000`

## Déploiement IONOS

### Prérequis IONOS

- Hébergement Node.js (sans accès root)
- Accès FTP
- Base de données MySQL

### Étapes de déploiement

1. **Build de production**
```bash
npm run build
```

2. **Préparer les fichiers**

Le build génère un dossier `.next/standalone`. Uploadez via FTP :
- `.next/standalone/` (tout le contenu)
- `.next/static/` → vers `.next/standalone/.next/static/`
- `public/` → vers `.next/standalone/public/`
- `prisma/` (pour les migrations)
- `.env` (avec les variables de production)

3. **Configuration MySQL sur IONOS**

Créez la base de données via le panel IONOS et notez :
- Hôte (ex: `db123456789.hosting-data.io`)
- Port (généralement `3306`)
- Nom de la base
- Utilisateur et mot de passe

4. **Variables d'environnement**

Configurez dans le panel IONOS ou dans `.env` :
```env
DATABASE_URL="mysql://user:password@db-host:3306/database_name"
JWT_SECRET="secret-de-production-tres-long"
APP_URL="https://votre-domaine.com"
NODE_ENV="production"
```

5. **Initialiser la base de données**
```bash
npx prisma db push
```

6. **Lancer l'application**
```bash
node server.js
```

### Configuration du serveur IONOS

Dans le panel IONOS, configurez :
- **Point d'entrée** : `server.js`
- **Port** : Celui assigné par IONOS (généralement via `process.env.PORT`)

## Backup Quotidien

### Script de backup

Le script `scripts/backup.ts` effectue :
1. Dump MySQL de la base de données
2. Archive ZIP avec le dump + dossier uploads
3. Rotation automatique (garde 14 jours)

### Exécution manuelle
```bash
npm run backup
```

### Planification sur IONOS

**Option 1 : Tâche planifiée IONOS**

Si disponible dans votre offre, créez une tâche planifiée :
- Commande : `cd /path/to/app && node --loader tsx scripts/backup.ts`
- Fréquence : Quotidienne à 3h00

**Option 2 : Endpoint sécurisé**

Créez un endpoint `/api/backup` protégé par un secret :
```typescript
// src/app/api/backup/route.ts
export async function POST(request: Request) {
  const secret = request.headers.get('x-backup-secret');
  if (secret !== process.env.BACKUP_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Exécuter le backup
}
```

Puis utilisez un service externe (cron-job.org, etc.) pour appeler cet endpoint quotidiennement.

## Format CSV Supporté

L'application supporte les fichiers CSV avec les colonnes suivantes :

| Colonne | Description | Requis |
|---------|-------------|--------|
| Symbol | Symbole de l'instrument (ex: NQ, MNQ) | ✅ |
| DT | Date du trade (YYYY-MM-DD) | ✅ |
| Entry | Prix d'entrée | ✅ |
| Exit | Prix de sortie | ✅ |
| Quantity | Quantité (négatif = SHORT) | ✅ |
| ProfitLoss | PnL réalisé en USD | ✅ |

**Exemple :**
```csv
Symbol;DT;Quantity;Entry;Exit;ProfitLoss
NQ;2025-12-12;-1;25223.75;25242.5;-375
NQ;2025-12-12;1;25238;25244.5;130
```

Le séparateur (`;` ou `,`) est détecté automatiquement.

## Calculs et Formules

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

**Note** : Le `pointValue` est fixé à 1 pour le MVP. Pour les futures, vous pouvez ajuster manuellement si nécessaire.

## Structure du Projet

```
src/
├── app/
│   ├── (auth)/          # Pages login/register
│   ├── (dashboard)/     # Pages protégées
│   ├── actions/         # Server actions
│   └── api/             # Route handlers
├── components/
│   ├── charts/          # Composants graphiques
│   ├── layout/          # Sidebar, Topbar
│   └── ui/              # Composants shadcn/ui
├── hooks/               # Hooks React
├── lib/                 # Utilitaires (auth, prisma, utils)
└── services/            # Logique métier
```

## Commandes Utiles

```bash
npm run dev          # Serveur de développement
npm run build        # Build de production
npm run start        # Serveur de production
npm run lint         # Linting
npm run db:generate  # Générer le client Prisma
npm run db:push      # Synchroniser le schéma
npm run db:studio    # Interface Prisma Studio
npm run backup       # Lancer un backup
```

## Licence

Projet privé - Tous droits réservés.

