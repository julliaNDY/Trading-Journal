# POC TimescaleDB + Replay Engine

## Objectif

Valider l'approche technique pour le stockage de tick data et le replay à 60fps avec TimescaleDB avant de démarrer l'Epic 1.

## Critères de Succès

- ✅ **AC1**: TimescaleDB provisionné et accessible depuis le projet
- ✅ **AC2**: Table `tick_data` (hypertable) créée avec compression active
- ✅ **AC3**: Dataset échantillon chargé (1 jour, 250ms precision = 345,600 ticks)
- ✅ **AC4**: Requête par fenêtre temporelle retourne les ticks en < 200ms
- ✅ **AC5**: Mini replay (streaming) fonctionne avec 60fps sur 1 jour

## Prérequis

### 1. PostgreSQL avec TimescaleDB

**Option A : Local (Recommandé pour POC)**

```bash
# Installer TimescaleDB localement (macOS)
brew tap timescale/tap
brew install timescaledb

# Initialiser PostgreSQL avec TimescaleDB
initdb /usr/local/var/postgres
pg_ctl -D /usr/local/var/postgres start

# Créer base de données
createdb trading_journal_poc

# Activer extension TimescaleDB
psql trading_journal_poc -c "CREATE EXTENSION IF NOT EXISTS timescaledb;"
```

**Option B : Docker**

```bash
docker run -d \
  --name timescaledb-poc \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=trading_journal_poc \
  -p 5432:5432 \
  timescale/timescaledb:latest-pg16
```

**Option C : Supabase (Limitation)**

⚠️ **Note** : Supabase ne supporte pas TimescaleDB par défaut. Pour le POC, utilisez une instance PostgreSQL locale ou dédiée avec TimescaleDB.

### 2. Variables d'Environnement

Ajouter dans `.env.local` :

```bash
# Pour POC local
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/trading_journal_poc"
```

### 3. Dépendances

Installer `pg` (PostgreSQL client) :

```bash
npm install pg
npm install --save-dev @types/pg
```

## Installation

### 1. Appliquer la Migration

```bash
# Appliquer la migration TimescaleDB
npx prisma migrate deploy

# Ou via Prisma Studio
npx prisma studio
```

### 2. Vérifier TimescaleDB

```bash
# Se connecter à PostgreSQL
psql trading_journal_poc

# Vérifier l'extension
SELECT * FROM pg_extension WHERE extname = 'timescaledb';

# Vérifier la hypertable
SELECT * FROM timescaledb_information.hypertables WHERE hypertable_name = 'tick_data';
```

## Génération de Données Échantillon

### Générer 1 jour de ticks (250ms precision)

```bash
npx tsx scripts/timescaledb-poc/generate-sample-data.ts [SYMBOL]
```

**Exemple** :
```bash
# Générer pour AAPL (par défaut)
npx tsx scripts/timescaledb-poc/generate-sample-data.ts

# Générer pour BTCUSD
npx tsx scripts/timescaledb-poc/generate-sample-data.ts BTCUSD
```

**Résultat attendu** :
- 345,600 ticks pour 1 jour (24h * 60min * 60sec * 4 ticks/sec)
- Taille disque : ~50-100MB (avant compression)
- Temps de génération : ~2-5 minutes

## Benchmarks & Tests de Performance

### Exécuter les Benchmarks

```bash
npx tsx scripts/timescaledb-poc/benchmark.ts
```

**Tests effectués** :
1. **Time Window Query** (AC4) : Requêtes par fenêtre temporelle (< 200ms)
2. **Streaming Replay** (AC5) : Replay à 60fps pour 1 jour
3. **Table Statistics** : Taille, compression, hypertable status

**Résultats attendus** :
- Time Window Query : < 200ms pour fenêtres 1h à 1 jour
- Streaming Replay : ≥ 60fps pour 1 jour de données
- Compression : Chunks compressés après 30 jours

## API Replay - Vue d'Ensemble

L'API replay fournit 5 endpoints pour différents cas d'utilisation :

| Endpoint | Description |
|----------|-------------|
| `/api/timescaledb-poc/info` | Informations système (données disponibles, TimescaleDB status) |
| `/api/timescaledb-poc/metadata` | Métadonnées pour une période spécifique |
| `/api/timescaledb-poc/replay` | Streaming SSE temps réel avec contrôle de vitesse |
| `/api/timescaledb-poc/candles` | Candles OHLCV agrégées |
| `/api/timescaledb-poc/ticks` | Ticks bruts avec pagination |

---

## 1. Info Endpoint

Retourne les informations système et les capabilities.

```
GET /api/timescaledb-poc/info
```

**Réponse** :
```json
{
  "success": true,
  "available": true,
  "symbols": ["AAPL", "BTCUSD"],
  "dateRange": { "earliest": "2026-01-16T00:00:00Z", "latest": "2026-01-17T00:00:00Z" },
  "totalTicks": 345600,
  "isTimescaleDB": true,
  "compressionEnabled": true,
  "capabilities": {
    "streaming": true,
    "speedControl": { "min": 0.1, "max": 100 },
    "fpsControl": { "min": 1, "max": 120 },
    "candleIntervals": ["1s", "5s", "1m", "5m", "15m", "1h", "4h", "1d"]
  }
}
```

---

## 2. Metadata Endpoint

Retourne les métadonnées pour une période spécifique.

```
GET /api/timescaledb-poc/metadata?symbol=AAPL&startTime=2026-01-16T00:00:00Z&endTime=2026-01-17T00:00:00Z
```

**Paramètres** :
- `symbol` (required) : Symbole à analyser
- `startTime` (required) : ISO timestamp de début
- `endTime` (required) : ISO timestamp de fin

**Réponse** :
```json
{
  "success": true,
  "metadata": {
    "symbol": "AAPL",
    "tickCount": 345600,
    "tradingDays": 1,
    "avgTicksPerSecond": 4,
    "priceRange": { "open": 150.0, "high": 152.5, "low": 149.2, "close": 151.3 },
    "estimatedSizeBytes": 34560000
  },
  "estimatedReplayDuration": {
    "1x": "5760 seconds",
    "2x": "2880 seconds",
    "4x": "1440 seconds",
    "10x": "576 seconds"
  }
}
```

---

## 3. Replay Endpoint (Streaming)

Streaming SSE avec contrôle de vitesse et métriques temps réel.

```
GET /api/timescaledb-poc/replay?startTime=...&endTime=...&symbol=AAPL&fps=60&speed=2&includeMetrics=true
```

**Paramètres** :
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `startTime` | string | required | ISO timestamp de début |
| `endTime` | string | required | ISO timestamp de fin |
| `symbol` | string | all | Symbole à rejouer |
| `fps` | number | 60 | Frames par seconde (1-120) |
| `speed` | number | 1 | Multiplicateur de vitesse (0.1-100) |
| `format` | string | 'ticks' | 'ticks', 'candles', ou 'both' |
| `candleInterval` | string | '1m' | Intervalle des candles |
| `includeMetrics` | boolean | false | Inclure métriques temps réel |
| `seekTo` | string | - | ISO timestamp pour sauter à |
| `batch` | boolean | false | Mode batch (non-streaming) |

**Format SSE** :
```
event: config
data: {"startTime": "...", "fps": 60, "speed": 2}

event: frame
data: {
  "frame": 0,
  "timestamp": "2026-01-16T00:00:00.250Z",
  "elapsedMs": 16.67,
  "ticks": [...],
  "metrics": {
    "currentPrice": 150.25,
    "priceChange": 0.25,
    "priceChangePercent": 0.17,
    "highOfDay": 150.25,
    "lowOfDay": 150.00,
    "totalVolume": 1234567,
    "ticksPerSecond": 4
  },
  "progress": {
    "percent": 0.05,
    "currentTime": "2026-01-16T00:00:00.250Z",
    "remainingFrames": 19999
  }
}

event: complete
data: {"done": true}
```

**Exemple JavaScript** :
```javascript
const eventSource = new EventSource(
  '/api/timescaledb-poc/replay?' +
  'startTime=2026-01-16T09:30:00Z&' +
  'endTime=2026-01-16T16:00:00Z&' +
  'symbol=AAPL&' +
  'fps=60&' +
  'speed=4&' +  // 4x speed
  'includeMetrics=true'
);

eventSource.addEventListener('config', (e) => {
  console.log('Replay config:', JSON.parse(e.data));
});

eventSource.addEventListener('frame', (e) => {
  const frame = JSON.parse(e.data);
  
  // Update chart with new ticks
  frame.ticks.forEach(tick => {
    chart.update(tick.time, tick.lastPrice);
  });
  
  // Update metrics display
  if (frame.metrics) {
    updateMetricsUI(frame.metrics);
  }
  
  // Update progress bar
  progressBar.style.width = frame.progress.percent + '%';
});

eventSource.addEventListener('complete', () => {
  console.log('Replay complete');
  eventSource.close();
});

eventSource.addEventListener('error', (e) => {
  console.error('Replay error:', e);
  eventSource.close();
});
```

---

## 4. Candles Endpoint

Retourne les candles OHLCV agrégées.

```
GET /api/timescaledb-poc/candles?symbol=AAPL&startTime=...&endTime=...&interval=5m
```

**Paramètres** :
- `symbol` (required) : Symbole
- `startTime` (required) : ISO timestamp de début
- `endTime` (required) : ISO timestamp de fin
- `interval` (default: '1m') : Intervalle des candles
  - Options: `1s`, `5s`, `15s`, `30s`, `1m`, `5m`, `15m`, `30m`, `1h`, `4h`, `1d`

**Réponse** :
```json
{
  "success": true,
  "symbol": "AAPL",
  "interval": "5m",
  "candleCount": 78,
  "executionTimeMs": 45,
  "summary": {
    "open": 150.0,
    "high": 152.5,
    "low": 149.2,
    "close": 151.3,
    "totalVolume": 12345678,
    "priceChange": 1.3,
    "priceChangePercent": 0.87
  },
  "candles": [
    { "time": "2026-01-16T09:30:00Z", "open": 150.0, "high": 150.5, "low": 149.8, "close": 150.3, "volume": 50000, "tickCount": 1200 },
    ...
  ]
}
```

---

## 5. Ticks Endpoint

Retourne les ticks bruts avec pagination.

```
GET /api/timescaledb-poc/ticks?symbol=AAPL&startTime=...&endTime=...&limit=10000&offset=0
```

**Paramètres** :
- `startTime` (required) : ISO timestamp de début
- `endTime` (required) : ISO timestamp de fin
- `symbol` (optional) : Symbole
- `limit` (default: 10000, max: 100000) : Nombre max de ticks
- `offset` (default: 0) : Offset pour pagination

**Réponse** :
```json
{
  "success": true,
  "query": { "startTime": "...", "endTime": "...", "symbol": "AAPL", "limit": 10000, "offset": 0 },
  "pagination": {
    "returned": 10000,
    "total": 345600,
    "hasMore": true,
    "nextOffset": 10000
  },
  "executionTimeMs": 89,
  "ticks": [
    { "time": "2026-01-16T00:00:00.000Z", "symbol": "AAPL", "bidPrice": 149.99, "askPrice": 150.01, "lastPrice": 150.0, "volume": 100 },
    ...
  ]
}
```

---

## Contrôles de Vitesse

L'API replay supporte les multiplicateurs de vitesse suivants :

| Speed | Description | Utilisation |
|-------|-------------|-------------|
| 0.5x | Ralenti | Analyse détaillée |
| 1x | Temps réel | Simulation trading |
| 2x | Double vitesse | Review rapide |
| 4x | Quadruple | Skip sections calmes |
| 10x | Fast forward | Navigation rapide |
| 100x | Ultra rapide | Recherche |

**Exemple avec contrôle de vitesse** :
```javascript
// Démarrer à 1x
let speed = 1;
let eventSource = startReplay(speed);

// Fonction pour changer la vitesse
function changeSpeed(newSpeed) {
  // Fermer le stream actuel
  eventSource.close();
  
  // Redémarrer avec seekTo au timestamp actuel
  eventSource = new EventSource(
    `/api/timescaledb-poc/replay?` +
    `startTime=${currentConfig.startTime}&` +
    `endTime=${currentConfig.endTime}&` +
    `symbol=${currentConfig.symbol}&` +
    `speed=${newSpeed}&` +
    `seekTo=${currentTimestamp}`
  );
  
  speed = newSpeed;
}

// Boutons de contrôle
document.getElementById('speed-05x').onclick = () => changeSpeed(0.5);
document.getElementById('speed-1x').onclick = () => changeSpeed(1);
document.getElementById('speed-2x').onclick = () => changeSpeed(2);
document.getElementById('speed-4x').onclick = () => changeSpeed(4);
document.getElementById('speed-10x').onclick = () => changeSpeed(10);
```

## Documentation des Résultats

### Rapport POC

Après avoir exécuté les benchmarks, documenter les résultats dans :

- `docs/reports/phase-0-report.md` (Section POC-1)

**Métriques à documenter** :
- Latence requêtes (p50, p95, p99)
- Throughput (rows/sec)
- Taille disque (avant/après compression)
- FPS replay (moyen, min, max)
- Temps de génération dataset

### Exemple de Rapport

```markdown
## POC-1 : TimescaleDB + Replay Storage

### Résultats

- **Time Window Query** : ✅ PASS
  - 1h window: 45ms (p50), 89ms (p95)
  - 1 day window: 156ms (p50), 198ms (p95)
  
- **Streaming Replay** : ✅ PASS
  - Average FPS: 61.2fps
  - Min FPS: 58.3fps
  - Max FPS: 63.8fps
  
- **Compression** :
  - Before compression: 87MB
  - After compression: 12MB
  - Compression ratio: 7.25x

### Conclusion

✅ **GO** : TimescaleDB validé pour stockage tick data et replay 60fps.
```

## Troubleshooting

### TimescaleDB Extension Not Found

**Erreur** : `ERROR: extension "timescaledb" does not exist`

**Solution** :
1. Vérifier que TimescaleDB est installé
2. Créer l'extension : `CREATE EXTENSION IF NOT EXISTS timescaledb;`
3. Vérifier : `SELECT * FROM pg_extension WHERE extname = 'timescaledb';`

### Table Not Converted to Hypertable

**Erreur** : La table `tick_data` existe mais n'est pas une hypertable

**Solution** :
```sql
-- Vérifier
SELECT * FROM timescaledb_information.hypertables WHERE hypertable_name = 'tick_data';

-- Convertir manuellement
SELECT create_hypertable('tick_data', 'time', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
```

### Performance Issues

**Symptôme** : Requêtes lentes (> 200ms)

**Solutions** :
1. Vérifier les index : `SELECT * FROM pg_indexes WHERE tablename = 'tick_data';`
2. Analyser les requêtes : `EXPLAIN ANALYZE SELECT ...`
3. Vérifier la compression : `SELECT * FROM timescaledb_information.compression_settings;`

## Prochaines Étapes

Une fois le POC validé :

1. ✅ Documenter les résultats dans `docs/reports/phase-0-report.md`
2. ✅ Mettre à jour `docs/architecture-trading-path-journal.md` avec les choix validés
3. ✅ Préparer le plan de migration pour Phase 1
4. ✅ Clôturer Story 1.1 (Phase 0)

## Références

- **Story** : `docs/stories/1.1.story.md`
- **POC Plan** : `docs/specs/phase-0-poc-plan.md` (POC-1)
- **Architecture** : `docs/architecture-trading-path-journal.md` (Section 2.3.3)
- **TimescaleDB Docs** : https://docs.timescale.com/

---

**Créé le** : 2026-01-17  
**Status** : ⏳ En cours  
**Owner** : Platform Engineering Team
