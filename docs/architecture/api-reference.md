# API Reference

> Documentation des endpoints API et Server Actions du Trading Path Journal.

**Version** : 1.0  
**Dernière mise à jour** : 2026-01-17

---

## Table des Matières

1. [Vue d'Ensemble](#vue-densemble)
2. [Authentification](#authentification)
3. [API Route Handlers](#api-route-handlers)
4. [Server Actions](#server-actions)

---

## Vue d'Ensemble

L'API du Trading Path Journal utilise deux patterns principaux :

1. **Route Handlers** (`src/app/api/`) - Endpoints REST pour les opérations nécessitant des uploads de fichiers ou des intégrations externes (webhooks, streaming).

2. **Server Actions** (`src/app/actions/`) - Fonctions serveur invoquées directement depuis les composants React pour les opérations CRUD courantes.

### Conventions

- Toutes les routes protégées nécessitent une authentification via Supabase Auth
- Les réponses JSON utilisent le format `{ data: T }` ou `{ error: string }`
- Les erreurs retournent un code HTTP approprié (400, 401, 403, 404, 500)
- La validation des inputs utilise Zod

---

## Authentification

L'authentification est gérée par Supabase Auth. Les tokens JWT sont transmis automatiquement via les cookies de session.

### Vérification de l'utilisateur

```typescript
// Dans un Route Handler
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // ... logique
}
```

```typescript
// Dans une Server Action
import { getUser } from '@/lib/auth';

export async function myAction() {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');
  
  // ... logique
}
```

---

## API Route Handlers

### Upload Voice Notes

#### `POST /api/voice-notes/upload`

Upload d'une note vocale pour un trade.

**Authentification** : Requise

**Content-Type** : `multipart/form-data`

**Body** :
| Champ | Type | Description |
|-------|------|-------------|
| `audio` | File | Fichier audio (webm, mp3, wav, m4a) |
| `tradeId` | string | UUID du trade |
| `duration` | number | Durée en secondes |

**Réponse** :
```json
{
  "id": "uuid",
  "filePath": "/uploads/voice-notes/...",
  "duration": 30
}
```

---

#### `POST /api/day-voice-notes/upload`

Upload d'une note vocale pour un journal quotidien.

**Authentification** : Requise

**Content-Type** : `multipart/form-data`

**Body** :
| Champ | Type | Description |
|-------|------|-------------|
| `audio` | File | Fichier audio |
| `dayJournalId` | string | UUID du journal |
| `duration` | number | Durée en secondes |

---

### Transcription

#### `POST /api/voice-notes/[id]/transcribe`

Lance la transcription d'une note vocale (Whisper API).

**Authentification** : Requise

**Params** :
- `id` : UUID de la voice note

**Réponse** :
```json
{
  "transcription": "Texte transcrit..."
}
```

---

#### `POST /api/voice-notes/[id]/summary`

Génère un résumé IA de la transcription.

**Authentification** : Requise

**Params** :
- `id` : UUID de la voice note

**Réponse** :
```json
{
  "summary": {
    "keyPoints": ["..."],
    "emotions": ["..."],
    "actionItems": ["..."]
  }
}
```

---

### OCR

#### `POST /api/ocr/parse`

Parse une image pour extraire des données de trade (Google Cloud Vision).

**Authentification** : Requise

**Content-Type** : `multipart/form-data`

**Body** :
| Champ | Type | Description |
|-------|------|-------------|
| `file` | File | Image (png, jpg, jpeg) |

**Réponse** :
```json
{
  "trades": [
    {
      "symbol": "NQ",
      "direction": "LONG",
      "entryPrice": 18500.25,
      "exitPrice": 18520.00,
      "quantity": 1,
      "pnl": 395.00
    }
  ]
}
```

---

### AI Coach

#### `POST /api/coach/chat`

Envoie un message au coach IA (streaming response).

**Authentification** : Requise

**Content-Type** : `application/json`

**Body** :
```json
{
  "message": "Comment améliorer mon win rate ?",
  "conversationId": "uuid (optionnel)"
}
```

**Réponse** : Stream SSE (Server-Sent Events)

---

#### `POST /api/coach/feedback`

Envoie un feedback sur une réponse du coach.

**Authentification** : Requise

**Body** :
```json
{
  "messageId": "uuid",
  "feedback": "LIKE" | "DISLIKE"
}
```

---

### Stripe Webhook

#### `POST /api/stripe/webhook`

Endpoint pour les webhooks Stripe.

**Authentification** : Signature Stripe

**Headers** :
- `stripe-signature` : Signature du webhook

**Events gérés** :
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

---

### Subscription Status

#### `GET /api/subscription/status`

Récupère le statut d'abonnement de l'utilisateur courant.

**Authentification** : Requise

**Réponse** :
```json
{
  "hasAccess": true,
  "subscription": {
    "status": "ACTIVE",
    "plan": "Pro Mensuel",
    "currentPeriodEnd": "2026-02-17T00:00:00Z"
  }
}
```

---

### Broker Sync Scheduler

#### `POST /api/scheduler/broker-sync`

Endpoint pour déclencher la synchronisation des brokers (appelé par cron).

**Authentification** : `SCHEDULER_SECRET` header

**Headers** :
- `x-scheduler-secret` : Secret configuré

---

### File Uploads

#### `GET /api/uploads/[...path]`

Sert les fichiers uploadés (screenshots, audio).

**Authentification** : Requise (vérifie que l'utilisateur a accès au fichier)

---

## Server Actions

### Auth Actions (`src/app/actions/auth.ts`)

| Action | Description |
|--------|-------------|
| `signIn(email, password)` | Connexion par email/password |
| `signUp(email, password)` | Inscription |
| `signOut()` | Déconnexion |
| `resetPassword(email)` | Envoi email reset password |
| `updatePassword(password)` | Mise à jour mot de passe |

---

### Trades Actions (`src/app/actions/trades.ts`)

| Action | Description |
|--------|-------------|
| `getTradesForUser(filters)` | Liste des trades avec filtres |
| `getTradeById(id)` | Détail d'un trade |
| `createTrade(data)` | Créer un trade manuellement |
| `updateTrade(id, data)` | Modifier un trade |
| `deleteTrade(id)` | Supprimer un trade |
| `bulkDeleteTrades(ids)` | Suppression en lot |

---

### Journal Actions (`src/app/actions/journal.ts`)

| Action | Description |
|--------|-------------|
| `getDayJournal(date)` | Récupère le journal d'un jour |
| `upsertDayJournal(date, note)` | Crée/modifie la note du jour |
| `getDayTrades(date)` | Trades d'un jour donné |
| `getMonthlyPnl(year, month)` | PnL par jour du mois |

---

### Import Actions (`src/app/actions/import.ts`)

| Action | Description |
|--------|-------------|
| `parseCSV(file)` | Parse un fichier CSV |
| `previewImport(data, mapping)` | Preview avant import |
| `commitImport(data, mapping)` | Import définitif |
| `getImportProfiles()` | Liste des profils d'import |
| `saveImportProfile(name, mapping)` | Sauvegarder un mapping |

---

### Accounts Actions (`src/app/actions/accounts.ts`)

| Action | Description |
|--------|-------------|
| `getAccounts()` | Liste des comptes trading |
| `createAccount(data)` | Créer un compte |
| `updateAccount(id, data)` | Modifier un compte |
| `deleteAccount(id)` | Supprimer un compte |

---

### Playbooks Actions (`src/app/actions/playbooks.ts`)

| Action | Description |
|--------|-------------|
| `getPlaybooks()` | Liste des playbooks |
| `getPlaybook(id)` | Détail d'un playbook |
| `createPlaybook(data)` | Créer un playbook |
| `updatePlaybook(id, data)` | Modifier un playbook |
| `deletePlaybook(id)` | Supprimer un playbook |
| `sharePlaybook(id, visibility)` | Modifier la visibilité |
| `importPlaybook(shareToken)` | Importer un playbook partagé |

---

### Voice Notes Actions (`src/app/actions/voice-notes.ts`)

| Action | Description |
|--------|-------------|
| `getVoiceNotes(tradeId)` | Notes vocales d'un trade |
| `deleteVoiceNote(id)` | Supprimer une note vocale |

---

### Broker Actions (`src/app/actions/broker.ts`)

| Action | Description |
|--------|-------------|
| `getBrokerConnections()` | Liste des connexions broker |
| `createBrokerConnection(data)` | Connecter un broker |
| `deleteBrokerConnection(id)` | Déconnecter un broker |
| `syncBroker(id)` | Synchroniser manuellement |
| `getSyncLogs(connectionId)` | Historique des syncs |

---

### Subscription Actions (`src/app/actions/subscription.ts`)

| Action | Description |
|--------|-------------|
| `getPlans()` | Liste des plans disponibles |
| `createCheckoutSession(planId)` | Créer session Stripe Checkout |
| `createPortalSession()` | Accéder au portail Stripe |
| `getSubscriptionStatus()` | Statut abonnement courant |

---

### Admin Actions (`src/app/actions/admin.ts`)

| Action | Description |
|--------|-------------|
| `getUsers()` | Liste des utilisateurs (admin only) |
| `getUserDetails(id)` | Détails d'un utilisateur |
| `updateUserSubscription(id, data)` | Modifier abonnement |
| `blockUser(id)` | Bloquer un utilisateur |
| `unblockUser(id)` | Débloquer un utilisateur |

---

### Voting Actions (`src/app/actions/voting.ts`)

| Action | Description |
|--------|-------------|
| `getVotingOptions()` | Options de vote actives |
| `vote(optionId)` | Voter pour une option |
| `removeVote(optionId)` | Retirer son vote |
| `getUserVotes()` | Votes de l'utilisateur |

---

### Profile Actions (`src/app/actions/profile.ts`)

| Action | Description |
|--------|-------------|
| `getProfile()` | Profil de l'utilisateur |
| `updateProfile(data)` | Modifier le profil |
| `updateAvatar(file)` | Modifier l'avatar |

---

### Coach Actions (`src/app/actions/coach.ts`)

| Action | Description |
|--------|-------------|
| `getConversations()` | Historique des conversations |
| `getConversation(id)` | Messages d'une conversation |
| `deleteConversation(id)` | Supprimer une conversation |
| `getTradingContext()` | Contexte trading pour l'IA |

---

## Codes d'Erreur

| Code | Description |
|------|-------------|
| 400 | Bad Request - Données invalides |
| 401 | Unauthorized - Non authentifié |
| 403 | Forbidden - Accès refusé |
| 404 | Not Found - Ressource inexistante |
| 409 | Conflict - Doublon ou conflit |
| 429 | Too Many Requests - Rate limit |
| 500 | Internal Server Error - Erreur serveur |

---

## Rate Limiting

- **Voice transcription** : 10 requêtes/minute
- **AI Coach** : 20 messages/heure
- **OCR** : 50 requêtes/jour
- **Broker Sync** : 1 sync/15 minutes par connexion

---

## Exemples d'Utilisation

### Créer un trade (Server Action)

```typescript
'use client';

import { createTrade } from '@/app/actions/trades';

async function handleSubmit(data: TradeFormData) {
  try {
    const trade = await createTrade(data);
    console.log('Trade créé:', trade.id);
  } catch (error) {
    console.error('Erreur:', error.message);
  }
}
```

### Upload voice note (Route Handler)

```typescript
'use client';

async function uploadVoiceNote(audioBlob: Blob, tradeId: string) {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');
  formData.append('tradeId', tradeId);
  formData.append('duration', '30');

  const response = await fetch('/api/voice-notes/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Upload failed');
  }

  return response.json();
}
```
