# Services Documentation

> Documentation de la couche services métier du Trading Path Journal.

**Version** : 1.0  
**Dernière mise à jour** : 2026-01-17  
**Emplacement** : `src/services/`

---

## Table des Matières

1. [Vue d'Ensemble](#vue-densemble)
2. [Trade Service](#trade-service)
3. [Stats Service](#stats-service)
4. [Import Service](#import-service)
5. [OCR Service](#ocr-service)
6. [Storage Service](#storage-service)
7. [Transcription Service](#transcription-service)
8. [Summary Service](#summary-service)
9. [Coach Service](#coach-service)
10. [Subscription Service](#subscription-service)
11. [Stripe Service](#stripe-service)
12. [Broker Sync Services](#broker-sync-services)

---

## Vue d'Ensemble

La couche services encapsule la logique métier de l'application. Chaque service est responsable d'un domaine fonctionnel spécifique.

### Principes

1. **Single Responsibility** : Chaque service gère un domaine unique
2. **Stateless** : Les services ne maintiennent pas d'état interne
3. **Type-safe** : Utilisation de TypeScript strict avec types explicites
4. **Testable** : Logique isolée et testable unitairement

### Structure

```
src/services/
├── trade-service.ts          # CRUD trades, sérialisation
├── stats-service.ts          # Calculs statistiques
├── import-service.ts         # Import CSV
├── ocr-service.ts            # Extraction de trades via OCR
├── storage-service.ts        # Upload/download fichiers
├── transcription-service.ts  # Transcription audio (Whisper)
├── summary-service.ts        # Résumé IA des notes vocales
├── coach-service.ts          # AI Coach (Google Gemini)
├── subscription-service.ts   # Gestion abonnements
├── stripe-service.ts         # Intégration Stripe
└── broker/
    ├── broker-sync-service.ts    # Orchestration sync
    ├── tradovate-provider.ts     # Provider Tradovate
    ├── ibkr-flex-query-provider.ts # Provider IBKR
    ├── scheduler.ts              # Planification des syncs
    ├── types.ts                  # Types partagés
    └── index.ts                  # Exports
```

---

## Trade Service

**Fichier** : `src/services/trade-service.ts`

Gère les opérations CRUD sur les trades et leur sérialisation pour le client.

### Types Exportés

```typescript
interface TradeWithTags extends Trade {
  tags: { tag: { id: string; name: string; color: string } }[];
  tradePlaybooks: { playbook: { id: string; name: string } }[];
}

interface SerializedTrade {
  id: string;
  userId: string;
  symbol: string;
  direction: Direction;
  openedAt: Date;
  closedAt: Date;
  entryPrice: number;  // Decimal -> number
  exitPrice: number;
  quantity: number;
  realizedPnlUsd: number;
  // ... autres champs
  tags: { tag: { id: string; name: string; color: string } }[];
}
```

### Fonctions Principales

#### `serializeTrade(trade: Trade): SerializedTrade`

Convertit un trade Prisma (avec Decimal) en objet sérialisable pour le client.

```typescript
import { serializeTrade } from '@/services/trade-service';

const trade = await prisma.trade.findUnique({ where: { id } });
const serialized = serializeTrade(trade);
// Tous les Decimal sont convertis en number
```

#### `getTradesForUser(userId, filters): Promise<SerializedTrade[]>`

Récupère les trades d'un utilisateur avec filtres.

```typescript
const trades = await getTradesForUser(userId, {
  startDate: new Date('2026-01-01'),
  endDate: new Date('2026-01-31'),
  symbols: ['NQ', 'ES'],
  accountIds: ['uuid'],
  tagIds: ['uuid'],
});
```

#### `createTrade(data): Promise<Trade>`

Crée un nouveau trade avec calculs automatiques (RR, fees).

#### `updateTrade(id, data): Promise<Trade>`

Met à jour un trade et recalcule les métriques dérivées.

#### `deleteTrade(id): Promise<void>`

Supprime un trade et ses données associées (screenshots, voice notes).

#### `getTradeWithDetails(id): Promise<TradeWithDetails>`

Récupère un trade avec toutes ses relations (tags, screenshots, voice notes, playbooks).

---

## Stats Service

**Fichier** : `src/services/stats-service.ts`

Calcule les statistiques globales et par période.

### Types Exportés

```typescript
interface GlobalStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;
  winRate: number;           // Pourcentage
  totalPnl: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  profitFactorIndex: number; // 0-10 scale
  averageWin: number;
  averageLoss: number;
  averageRR: number | null;
  bestDay: { date: string; pnl: number } | null;
  worstDay: { date: string; pnl: number } | null;
  averageDurationSeconds: number | null;
}

interface HourlyStats {
  hour: number;        // 0-23
  trades: number;
  totalPnl: number;
  avgPnl: number;
  winRate: number;
}

interface EquityPoint {
  date: string;        // YYYY-MM-DD
  cumPnl: number;      // Cumulative PnL
  pnl: number;         // Daily PnL
}

interface DailyPnl {
  date: string;
  pnl: number;
  tradesCount: number;
}
```

### Fonctions Principales

#### `calculateGlobalStats(trades: Trade[]): GlobalStats`

Calcule toutes les statistiques globales à partir d'un tableau de trades.

```typescript
import { calculateGlobalStats } from '@/services/stats-service';

const trades = await getTradesForUser(userId, filters);
const stats = calculateGlobalStats(trades);

console.log(`Win Rate: ${stats.winRate}%`);
console.log(`Profit Factor: ${stats.profitFactor}`);
```

#### `calculateProfitFactorIndex(pf: number): number`

Convertit le Profit Factor en index 0-10.

```typescript
// PF = 3 → Index = 10 (très bon)
// PF = 1.5 → Index = 5
// PF = 0.5 → Index = 1.67
const index = calculateProfitFactorIndex(2.5); // 8.33
```

#### `calculateHourlyStats(trades: Trade[]): HourlyStats[]`

Calcule les statistiques par heure d'ouverture.

#### `calculateEquityCurve(trades: Trade[]): EquityPoint[]`

Génère la courbe d'équité cumulée.

#### `calculateDailyPnl(trades: Trade[]): DailyPnl[]`

Calcule le PnL par jour pour le calendrier.

#### `calculateFiveMinuteStats(trades: Trade[]): FiveMinuteStats[]`

Statistiques par tranche de 5 minutes (granularité fine).

---

## Import Service

**Fichier** : `src/services/import-service.ts`

Gère l'import de trades depuis des fichiers CSV.

### Types Exportés

```typescript
interface ColumnMapping {
  symbol: string;
  openedAt: string;
  closedAt: string;
  direction?: string;
  entryPrice: string;
  exitPrice: string;
  quantity: string;
  realizedPnlUsd: string;
  fees?: string;
  floatingRunupUsd?: string;
  floatingDrawdownUsd?: string;
}

interface ImportPreview {
  rows: ParsedTradeRow[];
  errors: ImportError[];
  duplicates: number;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: ImportError[];
}
```

### Fonctions Principales

#### `parseCSV(file: File): Promise<CSVData>`

Parse un fichier CSV avec détection automatique du séparateur.

#### `previewImport(data, mapping, userId): Promise<ImportPreview>`

Génère un aperçu de l'import avec détection des doublons.

```typescript
const preview = await previewImport(csvData, mapping, userId);
console.log(`${preview.rows.length} trades à importer`);
console.log(`${preview.duplicates} doublons détectés`);
```

#### `commitImport(data, mapping, userId, accountId?): Promise<ImportResult>`

Effectue l'import définitif en base de données.

#### `generateImportHash(trade): string`

Génère un hash unique pour la déduplication.

```typescript
// Hash basé sur: userId, symbol, openedAt, closedAt, entryPrice, exitPrice, pnl
const hash = generateImportHash(tradeData);
```

---

## OCR Service

**Fichier** : `src/services/ocr-service.ts`

Extrait des données de trades depuis des images via Google Cloud Vision.

### Fonctions Principales

#### `extractTradesFromImage(imageBuffer: Buffer): Promise<ExtractedTrade[]>`

Analyse une image et extrait les trades reconnus.

```typescript
import { extractTradesFromImage } from '@/services/ocr-service';

const imageBuffer = await file.arrayBuffer();
const trades = await extractTradesFromImage(Buffer.from(imageBuffer));

// trades = [{ symbol, direction, entryPrice, exitPrice, quantity, pnl }]
```

### Dépendances

- **Google Cloud Vision API** : `GOOGLE_APPLICATION_CREDENTIALS` requis

---

## Storage Service

**Fichier** : `src/services/storage-service.ts`

Gère l'upload et le stockage des fichiers (screenshots, audio).

### Fonctions Principales

#### `uploadFile(file, directory, userId): Promise<string>`

Upload un fichier et retourne le chemin.

```typescript
const filePath = await uploadFile(imageFile, 'screenshots', userId);
// Retourne: "uploads/screenshots/{userId}/{timestamp}-{filename}"
```

#### `deleteFile(filePath): Promise<void>`

Supprime un fichier du stockage.

#### `getFileUrl(filePath): string`

Génère l'URL d'accès au fichier.

### Configuration

```env
UPLOAD_DIR="public/uploads"  # Stockage local
```

---

## Transcription Service

**Fichier** : `src/services/transcription-service.ts`

Transcrit les fichiers audio en texte via OpenAI Whisper.

### Fonctions Principales

#### `transcribeAudio(filePath: string): Promise<string>`

Transcrit un fichier audio.

```typescript
import { transcribeAudio } from '@/services/transcription-service';

const transcription = await transcribeAudio('/uploads/voice-notes/recording.webm');
// Retourne le texte transcrit
```

#### `generateTranscriptionHash(transcription: string): string`

Génère un hash MD5 pour le cache.

### Dépendances

- **OpenAI Whisper API** : `OPENAI_API_KEY` requis
- **Coût estimé** : ~$0.006/minute audio

---

## Summary Service

**Fichier** : `src/services/summary-service.ts`

Génère des résumés IA des transcriptions de notes vocales.

### Types Exportés

```typescript
interface VoiceNoteSummary {
  keyPoints: string[];
  emotions: string[];
  actionItems: string[];
  tradingInsights: string[];
}
```

### Fonctions Principales

#### `generateSummary(transcription: string, tradeContext?): Promise<VoiceNoteSummary>`

Génère un résumé structuré d'une transcription.

```typescript
import { generateSummary } from '@/services/summary-service';

const summary = await generateSummary(transcription, {
  symbol: 'NQ',
  direction: 'LONG',
  pnl: 500,
});

// summary.keyPoints = ["Bonne exécution", "Respect du plan"]
// summary.emotions = ["confiant", "discipliné"]
```

### Dépendances

- **OpenAI API** (GPT-4o) : `OPENAI_API_KEY` requis

---

## Coach Service

**Fichier** : `src/services/coach-service.ts`

Implémente le coach IA de trading avec Google Gemini.

### Types Exportés

```typescript
interface TradingContext {
  recentTrades: Trade[];
  stats: GlobalStats;
  streaks: {
    currentWinStreak: number;
    currentLoseStreak: number;
  };
}

interface CoachResponse {
  message: string;
  conversationId: string;
}
```

### Fonctions Principales

#### `chat(message: string, userId: string, conversationId?: string): AsyncGenerator<string>`

Génère une réponse en streaming.

```typescript
import { chat } from '@/services/coach-service';

const stream = chat("Comment améliorer mon win rate?", userId);

for await (const chunk of stream) {
  process.stdout.write(chunk);
}
```

#### `getTradingContext(userId: string): Promise<TradingContext>`

Récupère le contexte trading pour enrichir les prompts.

### Dépendances

- **Google Gemini API** : `GOOGLE_API_KEY` requis (via `@google/generative-ai`)

---

## Subscription Service

**Fichier** : `src/services/subscription-service.ts`

Gère la logique d'abonnement et d'accès.

### Fonctions Principales

#### `hasActiveSubscription(userId: string): Promise<boolean>`

Vérifie si l'utilisateur a un abonnement actif.

```typescript
const hasAccess = await hasActiveSubscription(userId);
if (!hasAccess) {
  redirect('/pricing');
}
```

#### `getSubscriptionStatus(userId: string): Promise<SubscriptionStatus>`

Récupère le statut détaillé de l'abonnement.

#### `createTrialSubscription(userId: string): Promise<Subscription>`

Crée un abonnement d'essai pour un nouvel utilisateur.

#### `cancelSubscription(userId: string): Promise<void>`

Annule l'abonnement (fin de période).

---

## Stripe Service

**Fichier** : `src/services/stripe-service.ts`

Intégration avec l'API Stripe pour les paiements.

### Fonctions Principales

#### `createCheckoutSession(userId, planId): Promise<{ url: string }>`

Crée une session Stripe Checkout.

```typescript
const { url } = await createCheckoutSession(userId, planId);
redirect(url);
```

#### `createCustomerPortalSession(userId): Promise<{ url: string }>`

Crée une session vers le portail client Stripe.

#### `handleWebhookEvent(event: Stripe.Event): Promise<void>`

Traite les événements webhook Stripe.

### Configuration

```env
STRIPE_SECRET_KEY="sk_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_..."
```

---

## Broker Sync Services

**Emplacement** : `src/services/broker/`

Services de synchronisation automatique avec les brokers.

### Architecture

```
broker/
├── broker-sync-service.ts    # Orchestration
├── tradovate-provider.ts     # Tradovate API
├── ibkr-flex-query-provider.ts # IBKR Flex Query
├── scheduler.ts              # Planification
├── types.ts                  # Types communs
└── index.ts
```

### Types Communs (`types.ts`)

```typescript
interface BrokerProvider {
  type: BrokerType;
  authenticate(credentials: BrokerCredentials): Promise<void>;
  fetchTrades(since?: Date): Promise<BrokerTrade[]>;
  validateConnection(): Promise<boolean>;
}

interface BrokerTrade {
  externalId: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  openedAt: Date;
  closedAt: Date;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  fees?: number;
}

interface SyncResult {
  imported: number;
  skipped: number;
  updated: number;
  errors: string[];
}
```

### Broker Sync Service (`broker-sync-service.ts`)

#### `syncBrokerConnection(connectionId: string): Promise<SyncResult>`

Synchronise une connexion broker spécifique.

```typescript
import { syncBrokerConnection } from '@/services/broker';

const result = await syncBrokerConnection(connectionId);
console.log(`Imported: ${result.imported}, Skipped: ${result.skipped}`);
```

#### `syncAllConnections(userId: string): Promise<SyncResult[]>`

Synchronise toutes les connexions d'un utilisateur.

### Tradovate Provider (`tradovate-provider.ts`)

```typescript
class TradovateProvider implements BrokerProvider {
  async authenticate(credentials): Promise<void>;
  async fetchTrades(since?: Date): Promise<BrokerTrade[]>;
  async refreshToken(): Promise<void>;
}
```

### IBKR Flex Query Provider (`ibkr-flex-query-provider.ts`)

```typescript
class IBKRFlexQueryProvider implements BrokerProvider {
  async authenticate(credentials): Promise<void>;
  async fetchTrades(since?: Date): Promise<BrokerTrade[]>;
  async parseFlexReport(xml: string): BrokerTrade[];
}
```

### Scheduler (`scheduler.ts`)

```typescript
// Appelé par /api/scheduler/broker-sync
async function runScheduledSync(): Promise<void>;

// Vérifie quelles connexions doivent être synchronisées
async function getConnectionsDueForSync(): Promise<BrokerConnection[]>;
```

---

## Bonnes Pratiques

### Imports

```typescript
// Préférer les imports nommés
import { serializeTrade, getTradesForUser } from '@/services/trade-service';

// Éviter les imports par défaut
import TradeService from '@/services/trade-service'; // ❌
```

### Gestion d'Erreurs

```typescript
// Les services doivent lever des erreurs explicites
export async function getTradeById(id: string, userId: string) {
  const trade = await prisma.trade.findUnique({ where: { id } });
  
  if (!trade) {
    throw new Error('Trade not found');
  }
  
  if (trade.userId !== userId) {
    throw new Error('Unauthorized');
  }
  
  return trade;
}
```

### Tests

Les tests des services sont dans `src/services/__tests__/` :

```bash
npm run test -- src/services/__tests__/
```

```typescript
// Exemple de test
import { calculateGlobalStats } from '@/services/stats-service';

describe('calculateGlobalStats', () => {
  it('should calculate profit factor correctly', () => {
    const trades = [
      { realizedPnlUsd: 100 },
      { realizedPnlUsd: -50 },
    ];
    
    const stats = calculateGlobalStats(trades);
    expect(stats.profitFactor).toBe(2);
  });
});
```
