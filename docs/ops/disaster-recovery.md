# Disaster Recovery Guide

## Vue d'ensemble

Ce guide documente les procédures de récupération après sinistre pour le projet Trading Journal.

**Contexte** : Story 1.10 - Data Migration & Backup Strategy

---

## 📊 Architecture des données

| Data Store | Usage | Backup Method | Retention |
|------------|-------|---------------|-----------|
| **Supabase PostgreSQL** | Users, Trades, Tags, etc. | pg_dump quotidien | 30 jours |
| **TimescaleDB** | Tick data (Market Replay) | pg_dump quotidien | 30 jours |
| **Qdrant** | Embeddings (AI search) | Snapshots quotidiens | 7 jours |
| **Redis (Upstash)** | Queues (BullMQ) | Géré par Upstash | Automatique |

---

## 🎯 RTO/RPO Targets

| Scénario | RTO (Recovery Time) | RPO (Recovery Point) |
|----------|---------------------|----------------------|
| Corruption base de données | 2 heures | 1 heure |
| Panne infrastructure complète | 4 heures | 1 heure |
| Suppression accidentelle de données | 1 heure | 24 heures |
| Perte d'un service externe | 30 minutes | 0 (pas de perte) |

---

## 🚨 Procédures de récupération

### Scénario 1 : Corruption Supabase PostgreSQL

**Symptômes** :
- Erreurs de requête SQL
- Données incohérentes
- Application ne démarre pas

**Procédure** :

1. **Identifier le problème** :
   ```bash
   # Vérifier les logs Supabase
   # Dashboard Supabase > Logs > Database
   ```

2. **Restaurer depuis backup** :
   ```bash
   # Lister les backups disponibles
   ls -la backups/supabase/
   
   # Restaurer le backup le plus récent
   psql "$DATABASE_URL" < backups/supabase/supabase-YYYY-MM-DD.sql
   ```

3. **Vérifier l'intégrité** :
   ```bash
   npx tsx scripts/validate-data-integrity.ts
   ```

4. **Redémarrer l'application** :
   ```bash
   # Vercel redéploie automatiquement
   # Ou manuellement : vercel --prod
   ```

---

### Scénario 2 : Corruption TimescaleDB

**Symptômes** :
- Market Replay ne fonctionne pas
- Erreurs sur les requêtes tick_data
- Continuous aggregates vides

**Procédure** :

1. **Désactiver TimescaleDB temporairement** :
   ```bash
   # Dans .env.local ou Vercel
   USE_TIMESCALEDB="false"
   ```

2. **Restaurer depuis backup** :
   ```bash
   # Lister les backups
   ls -la backups/timescale/
   
   # Restaurer
   psql "$TIMESCALE_DATABASE_URL" < backups/timescale/timescale-YYYY-MM-DD.sql
   ```

3. **Recréer les features TimescaleDB** :
   ```bash
   psql "$TIMESCALE_DATABASE_URL" -f scripts/timescaledb-production-setup.sql
   ```

4. **Rafraîchir les continuous aggregates** :
   ```sql
   CALL refresh_continuous_aggregate('candle_1m', NULL, NULL);
   CALL refresh_continuous_aggregate('candle_5m', NULL, NULL);
   CALL refresh_continuous_aggregate('candle_15m', NULL, NULL);
   CALL refresh_continuous_aggregate('candle_1h', NULL, NULL);
   ```

5. **Réactiver TimescaleDB** :
   ```bash
   USE_TIMESCALEDB="true"
   ```

---

### Scénario 3 : Perte des embeddings Qdrant

**Symptômes** :
- Recherche sémantique ne fonctionne pas
- AI Coach ne trouve pas de trades similaires
- Erreurs sur `/api/vectordb/search`

**Procédure** :

1. **Vérifier l'état de Qdrant** :
   ```bash
   npx tsx scripts/vectordb/check-status.ts
   ```

2. **Option A : Restaurer depuis snapshot** :
   ```bash
   # Lister les snapshots disponibles
   curl "$QDRANT_URL/collections/trades/snapshots" \
     -H "api-key: $QDRANT_API_KEY"
   
   # Restaurer un snapshot
   curl -X PUT "$QDRANT_URL/collections/trades/snapshots/recover" \
     -H "api-key: $QDRANT_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"location": "snapshot-name.snapshot"}'
   ```

3. **Option B : Régénérer les embeddings** :
   ```bash
   # Recréer les collections
   npx tsx scripts/vectordb/create-collections-direct.ts
   
   # Régénérer tous les embeddings
   npx tsx scripts/vectordb/generate-embeddings-direct.ts
   ```

---

### Scénario 4 : Panne Redis/Upstash

**Symptômes** :
- Jobs ne s'exécutent pas
- Import CSV bloqué
- Sync broker ne fonctionne pas

**Procédure** :

1. **Vérifier l'état d'Upstash** :
   - Dashboard Upstash > Status
   - https://status.upstash.com/

2. **Si Upstash est down** :
   - L'application continue de fonctionner (mode dégradé)
   - Les jobs seront en queue et exécutés au retour d'Upstash

3. **Si données Redis corrompues** :
   - Upstash gère automatiquement les backups
   - Contacter le support Upstash si nécessaire

---

### Scénario 5 : Suppression accidentelle de données

**Symptômes** :
- Utilisateur signale des données manquantes
- Trades/journals disparus

**Procédure** :

1. **Identifier les données supprimées** :
   ```sql
   -- Vérifier les logs d'audit si disponibles
   -- Ou comparer avec le dernier backup
   ```

2. **Restaurer depuis backup** :
   ```bash
   # Créer une base temporaire pour extraire les données
   createdb temp_restore
   psql temp_restore < backups/supabase/supabase-YYYY-MM-DD.sql
   
   # Extraire les données manquantes
   pg_dump temp_restore -t trades --data-only > missing_trades.sql
   
   # Restaurer dans la base principale
   psql "$DATABASE_URL" < missing_trades.sql
   
   # Nettoyer
   dropdb temp_restore
   ```

3. **Régénérer les embeddings pour les données restaurées** :
   ```bash
   npx tsx scripts/vectordb/generate-embeddings-direct.ts
   ```

---

## 🔄 Procédures de backup

### Backup manuel

```bash
# Backup complet
npx tsx scripts/backup-all.ts

# Backup Supabase uniquement
npx tsx scripts/backup-all.ts --supabase

# Backup TimescaleDB uniquement
npx tsx scripts/backup-all.ts --timescale

# Backup Qdrant uniquement
npx tsx scripts/backup-all.ts --qdrant
```

### Backup automatique (Cron)

```bash
# Ajouter au crontab (serveur ou Vercel Cron)
# Backup quotidien à 3h00 UTC
0 3 * * * cd /path/to/project && npx tsx scripts/backup-all.ts >> /var/log/backup.log 2>&1
```

### Vercel Cron (vercel.json)

```json
{
  "crons": [
    {
      "path": "/api/cron/backup",
      "schedule": "0 3 * * *"
    }
  ]
}
```

---

## ✅ Checklist de validation post-recovery

- [ ] Application accessible
- [ ] Login/Logout fonctionnel
- [ ] Trades affichés correctement
- [ ] Import CSV fonctionne
- [ ] Market Replay fonctionne (si TimescaleDB)
- [ ] Recherche sémantique fonctionne (si Qdrant)
- [ ] AI Coach répond
- [ ] Sync broker fonctionne

### Script de validation

```bash
npx tsx scripts/validate-data-integrity.ts
```

---

## 📞 Contacts et escalade

| Service | Support | SLA |
|---------|---------|-----|
| Supabase | support@supabase.io | 24h (Pro) |
| TimescaleDB | support@timescale.com | 24h (Pro) |
| Qdrant Cloud | support@qdrant.tech | 48h |
| Upstash | support@upstash.com | 24h |
| Vercel | support@vercel.com | 24h (Pro) |

---

## 📝 Historique des incidents

| Date | Incident | Cause | Résolution | Durée |
|------|----------|-------|------------|-------|
| - | - | - | - | - |

---

**Dernière mise à jour** : 2026-01-18
