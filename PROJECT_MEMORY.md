# 📚 PROJECT MEMORY - Trading Journal App

> Ce fichier est maintenu automatiquement par l'IA pour garder une trace de toutes les modifications du projet.
> **Ne pas modifier manuellement** sauf pour corrections mineures.

---

## Historique des modifications

## [2026-01-20 18:30] - Documentation: Création plan global Stories 1.1 à 17.1

### 📝 Demande utilisateur
> Qu'en est-il du plan allant de @docs/stories/1.1.story.md à @docs/stories/17.1.story.md

### 🔧 Modifications techniques
- **Fichiers créés :** 
  - `docs/PLAN-GLOBAL-1.1-17.1.md` - Document de synthèse du plan global

- **Analyse effectuée:**
  - Analyse de toutes les stories de 1.1 à 17.1
  - Identification de la structure Phases (0-12) et Epics (1-17)
  - Mapping des stories aux phases/epics
  - Identification des documents de planification existants
  - Identification du document manquant `docs/roadmap-trading-path-journal.md`

### 💡 Pourquoi (Raison du changement)
Création d'un document de synthèse pour comprendre la structure globale du projet et identifier les documents de planification manquants. Le document référence `docs/roadmap-trading-path-journal.md` dans de nombreuses stories mais ce fichier n'existe pas dans le repo.

### 🔗 Contexte additionnel
- Structure identifiée : 12 Phases, 17 Epics, stories numérotées X.Y (X = Epic number)
- Phase 0 : ✅ Completed (POC)
- Phase 11 : 🔵 En cours (AI Daily Bias Analysis - Jan 2026)
- Phase 12 : 🟠 Planifiée (Future Roadmap Features, incluant Epic 17 - Gamification)
- Document manquant : `docs/roadmap-trading-path-journal.md` (référencé partout mais non trouvé)

---

## [2026-01-20 17:00] - Sécurité: Remplacement clé API Gemini leakée

### 📝 Demande utilisateur
> La clé API Gemini a été leakée en ligne. Remplacer l'ancienne clé par une nouvelle dans tous les fichiers, en évitant de hardcoder la clé dans le code source.

### 🔧 Modifications techniques
- **Fichiers modifiés :** 
  - `docs/ops/qdrant-setup.md` - Clé hardcodée remplacée par placeholder `your-gemini-api-key-here`
  - `scripts/vectordb/configure-qdrant.ts` - Clé hardcodée remplacée par `process.env.GOOGLE_API_KEY`
  - `.env.local` - Mise à jour de `GOOGLE_API_KEY` et `GOOGLE_GEMINI_API_KEY` avec la nouvelle clé

### 💡 Pourquoi (Raison du changement)
Les clés API ne doivent JAMAIS être hardcodées dans le code source car :
- Elles sont versionnées dans l'historique git
- Elles peuvent être exposées sur GitHub
- Elles sont difficiles à révoquer/rotation

### 🔗 Contexte additionnel
- L'ancienne clé `AIzaSyCo-VNsZTorOEyahpnlvRo89zn4z2VFFsA` a été supprimée
- La nouvelle clé est stockée UNIQUEMENT dans `.env.local` (gitignored)
- Le script `configure-qdrant.ts` utilise maintenant `process.env.GOOGLE_API_KEY`
- **ATTENTION**: L'ancienne clé reste dans l'historique git. Considérer un `git filter-branch` ou BFG Repo-Cleaner si nécessaire.

---

## [2026-01-20 16:15] - Fix: Server Action erreur "Cannot read properties of undefined (reading 'call')"

### 📝 Demande utilisateur
> Erreur lors du clic sur le bouton "Join Beta For Free": "Cannot read properties of undefined (reading 'call')"

### 🔧 Modifications techniques
- **Fichiers modifiés :** 
  - `src/app/actions/subscription.ts` - Supprimé l'instrumentation de debug contenant `import('fs')`
  - `src/components/landing/beta-access-landing.tsx` - Supprimé les logs de debug

- **Cause racine identifiée:**
  - L'instrumentation de debug avait ajouté un `import('fs')` dans le fichier de Server Actions
  - Next.js ne peut pas créer le proxy client pour une Server Action qui dépend de modules Node.js (comme `fs`)
  - Cela causait l'erreur `Cannot read properties of undefined (reading 'call')` lors de l'appel de `createCheckoutSessionAction()`

- **Solution:**
  - Suppression complète de l'instrumentation contenant l'import `fs`
  - Le fichier `subscription.ts` est revenu à son état fonctionnel original
  - Next.js peut maintenant générer correctement le proxy client pour la Server Action

### 💡 Pourquoi (Raison du changement)
Les Server Actions Next.js doivent être "sérialisables" pour être appelées depuis le client. L'import de modules Node.js comme `fs` dans un fichier de Server Actions empêche Next.js de créer le proxy client nécessaire, causant l'erreur lors de l'appel de la fonction.

### 🔗 Contexte additionnel
- L'erreur se manifestait comme une requête POST vers `/` qui échouait avec le statut 500
- Le digest d'erreur était: `3679147901`
- Les logs de debug ont révélé que l'action n'était jamais appelée côté serveur, confirmant un problème de sérialisation/proxy

---

## [2026-01-20 15:30] - Landing page pricing display simplified

### 📝 Demande utilisateur
> Sur la landing page (/) changer le texte "$20 FREE" par "FREE" écrit à la place de $20, et supprimer les lignes "landing.publicPrice $30" et "landing.perMonth"

### 🔧 Modifications techniques
- **Fichiers modifiés :** 
  - `src/components/landing/beta-access-landing.tsx` (lignes 97-115)

- **Changements:**
  - Supprimé l'affichage de "$20" et simplifié l'affichage du prix
  - Supprimé les deux lignes contenant `publicPrice` et `perMonth` 
  - Le prix affiché utilise maintenant directement `{t('perSemester')}` qui affiche "FREE" (EN) ou "GRATUIT" (FR)
  - Nettoyage de la structure HTML pour afficher uniquement le texte "FREE"/"GRATUIT" en grand

### 💡 Pourquoi (Raison du changement)
Simplification de l'affichage du pricing sur la landing page pour mettre en avant la gratuité de l'accès beta sans référence au prix public futur.

### 🔗 Contexte additionnel
Les clés de traduction `publicPrice` et `perMonth` n'existaient pas dans les fichiers de traduction, donc seul le composant React a été modifié. Le texte "FREE"/"GRATUIT" provient de la clé `perSemester` déjà existante.

---

## [2026-01-20 00:00] - Landing page pricing text update

### 📝 Demande utilisateur
> Changer le texte du bouton de la landing page de "Join Beta for 20$" à "Join Beta For Free", remplacer "$20 / semester" par "FREE", et supprimer "Expected public price $30/month"

### 🔧 Modifications techniques
- **Fichiers modifiés :** 
  - `messages/en.json` (lignes 1331-1335)
  - `messages/fr.json` (lignes 1331-1335)

- **Changements:**
  - EN: `joinBeta` → "Join Beta For Free" (was "Join Beta for $20")
  - EN: `perSemester` → "FREE" (was "/ semester")
  - EN: Removed `publicPrice` and `perMonth` lines
  - FR: `joinBeta` → "Rejoindre la Beta Gratuitement" (was "Rejoindre la Beta pour 20$")
  - FR: `perSemester` → "GRATUIT" (was "/ semestre")
  - FR: Removed `publicPrice` and `perMonth` lines

### 💡 Pourquoi (Raison du changement)
Mise à jour du messaging de la landing page pour indiquer que l'accès beta est maintenant gratuit, en ligne avec la nouvelle stratégie de pricing.

### 🔗 Contexte additionnel
Les deux fichiers de traduction (EN et FR) ont été mis à jour de manière identique pour maintenir la cohérence multi-langue.
