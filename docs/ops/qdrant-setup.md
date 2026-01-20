# Qdrant Cloud Setup Guide

## Configuration Complétée ✅

### Variables d'Environnement

Les variables suivantes ont été configurées dans `.env.local` :

```bash
QDRANT_URL="https://40099ca1-43df-4699-9f49-f13b3a16bb48.europe-west3-0.gcp.cloud.qdrant.io:6333"
QDRANT_API_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.XeQ06c2VJaVE0g31rkwfVJNhoIvNP6mdzujMNAwf65E"
GOOGLE_API_KEY="AIzaSyCo-VNsZTorOEyahpnlvRo89zn4z2VFFsA"
```

### Collections Créées

| Collection | Vector Size | Distance | Indexes |
|------------|-------------|----------|---------|
| `trades` | 768 | Cosine | user_id, trade_id, symbol, direction, pnl_positive, closed_at |
| `playbooks` | 768 | Cosine | user_id, playbook_id, name, is_public |
| `journal_entries` | 768 | Cosine | user_id, journal_id, date |
| `coach_history` | 768 | Cosine | user_id, conversation_id, message_id, role, created_at |

### Scripts Disponibles

```bash
# Configurer Qdrant Cloud
npx tsx scripts/vectordb/configure-qdrant.ts

# Créer les collections (si problème avec fetch)
npx tsx scripts/vectordb/create-collections-direct.ts

# Setup production (standard)
npx tsx scripts/vectordb/setup-production.ts

# Tester la connexion
npx tsx scripts/vectordb/test-connection.ts
```

### API Endpoints

- `GET /api/vectordb/health` - Health check Qdrant
- `POST /api/vectordb/search` - Recherche sémantique

### Notes Techniques

**Problème connu** : Le `fetch` natif de Node.js peut avoir des problèmes avec certaines configurations réseau. Le script `create-collections-direct.ts` utilise les modules `http`/`https` natifs pour contourner ce problème.

**Solution** : Pour les opérations critiques, utiliser `create-collections-direct.ts` ou mettre à jour le client Qdrant pour utiliser une bibliothèque HTTP alternative (ex: `node-fetch`, `undici`).

### Vérification

```bash
# Test de connexion
curl https://40099ca1-43df-4699-9f49-f13b3a16bb48.europe-west3-0.gcp.cloud.qdrant.io:6333/ \
  -H "api-key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.XeQ06c2VJaVE0g31rkwfVJNhoIvNP6mdzujMNAwf65E"

# Lister les collections
curl https://40099ca1-43df-4699-9f49-f13b3a16bb48.europe-west3-0.gcp.cloud.qdrant.io:6333/collections \
  -H "api-key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.XeQ06c2VJaVE0g31rkwfVJNhoIvNP6mdzujMNAwf65E"
```

### Prochaines Étapes

1. ✅ Collections créées
2. ⏭️ Générer les embeddings pour les données existantes
3. ⏭️ Configurer les backups (snapshots quotidiens)
4. ⏭️ Monitoring et alertes (Story 1.9)
