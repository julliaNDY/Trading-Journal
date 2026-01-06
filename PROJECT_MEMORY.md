# 📚 PROJECT MEMORY - Trading Journal App

> Ce fichier est maintenu automatiquement par l'IA pour garder une trace de toutes les modifications du projet.
> **Ne pas modifier manuellement** sauf pour corrections mineures.

---

## Historique des modifications

<!-- Les entrées sont ajoutées ci-dessous, les plus récentes en haut -->

## [2026-01-07 12:30] - Fix URL emails Supabase (runtime vs build-time)

### 📝 Demande utilisateur
> Le lien de reset password dans les emails redirige vers `0.0.0.0:3000` au lieu de `tradingpathjournal.com`

### 🔧 Modifications techniques
- **Fichiers modifiés :**
  - `src/app/actions/auth.ts` — Ajout fonction `getAppUrl()` qui utilise `APP_URL` (runtime) avec fallback sur `NEXT_PUBLIC_APP_URL`
  - `env.example` — Ajout de `APP_URL` (variable serveur pure)
  - `scripts/setup-production-env.sh` — Génère maintenant `APP_URL` en plus de `NEXT_PUBLIC_APP_URL`

### 💡 Pourquoi (Raison du changement)
**Bug critique** : Les variables `NEXT_PUBLIC_*` peuvent être "inlinées" au moment du build par Next.js, même dans les server actions. Si le build est fait avec `NEXT_PUBLIC_APP_URL=localhost:3000`, cette valeur sera hardcodée dans le bundle.

**Solution** :
1. Créer une variable `APP_URL` (sans préfixe NEXT_PUBLIC)
2. Cette variable est garantie d'être lue à runtime côté serveur
3. Fonction `getAppUrl()` avec fallback : `APP_URL` → `NEXT_PUBLIC_APP_URL` → `localhost:3000`

### 🔗 Contexte additionnel
Sur le VPS, il faut ajouter `APP_URL="https://tradingpathjournal.com"` dans `.env.local` puis rebuild.

---

## [2026-01-06 21:45] - Fix bug critique doublons à l'import CSV (118/120 faux doublons)

### 📝 Demande utilisateur
> 1. Temps de chargement très long lors de la création de compte/import
> 2. 118/120 trades considérés comme doublons sur un compte vide
> 3. Erreur connexion Supabase lors de l'import OCR

### 🔧 Modifications techniques
- **Fichiers modifiés :**
  - `src/services/trade-service.ts` — La signature de trade inclut maintenant le `accountId` pour éviter les faux doublons cross-comptes
  - `src/app/actions/import.ts` — `checkDuplicates()` accepte maintenant un `accountId` optionnel
  - `src/app/(dashboard)/importer/import-content.tsx` — Re-vérifie les doublons quand le compte sélectionné change via `useEffect`

### 💡 Pourquoi (Raison du changement)
**Bug critique** : La signature de trade (`calculateTradeSignature`) était basée sur `(userId, symbol, date, entryPrice)` mais **pas sur `accountId`**. Résultat : si l'utilisateur avait des trades avec le même symbole/date/prix sur d'autres comptes, ils étaient détectés comme doublons même sur un compte vide.

**Solution** : 
1. Inclure `accountId` dans la signature : `'no-account'` si null
2. Le fuzzy match respecte aussi la frontière du compte
3. La vérification des doublons se fait maintenant quand le compte est sélectionné (useEffect)

### 🔗 Contexte additionnel
L'erreur 3 (connexion Supabase) reste à investiguer côté configuration .env - le serveur Supabase répond (401) mais la connexion directe à la DB (port 5432) échoue.

---

## [2026-01-06 22:15] - Cleanup code legacy post-migration Supabase

### 📝 Demande utilisateur
> Nettoyer le code legacy après la migration vers Supabase

### 🔧 Modifications techniques
- **Fichiers supprimés :** 
  - `src/services/email-service.ts` — Nodemailer remplacé par Supabase Auth emails
  - `src/app/actions/password-reset.ts` — Remplacé par Supabase Auth
- **Dépendances supprimées :** `bcrypt`, `nodemailer`, `@types/bcrypt`, `@types/nodemailer`
- **Fichiers modifiés :**
  - `env.example` — Variables SMTP et JWT legacy supprimées
  - `src/app/actions/auth.ts` — Type de retour corrigé pour `needsEmailConfirmation`
  - `src/services/stats-service.ts` — Type `TradeWithTimes` simplifié

### 💡 Pourquoi (Raison du changement)
Post-migration Supabase, ces fichiers et dépendances sont obsolètes :
- Supabase Auth gère les emails transactionnels (inscription, reset password)
- Supabase Auth gère le hachage des mots de passe (pas besoin de bcrypt)

---

## [2026-01-06 21:45] - Migration données MySQL → Supabase PostgreSQL

### 📝 Demande utilisateur
> Migrer toutes les données de la base MySQL/MariaDB (Docker sur VPS) vers Supabase PostgreSQL

### 🔧 Modifications techniques
- **Fichiers créés :** 
  - `scripts/migrate-mysql-to-supabase.ts` — Script ETL complet
  - `scripts/backup-mysql.sh` — Script de backup MySQL
  - `scripts/check-migration.ts` — Script de vérification
- **Dépendances ajoutées :** `mysql2`, `dotenv`

### 💡 Résultat de la migration
- **Users:** 10 (9 MySQL + 1 test) ✓
- **Accounts:** 19 ✓
- **Trades:** 1190 ✓
- **Screenshots:** 5 ✓
- **Day Journals:** 2 ✓
- **Playbooks:** 2 + Groups (2) + Prerequisites (5) ✓

### 🔗 Contexte additionnel
- Conversion des booléens MySQL (0/1) → PostgreSQL (true/false) via fonction `toBoolean()`
- Les utilisateurs existants doivent utiliser "Mot de passe oublié" car les hashes bcrypt ne sont pas compatibles avec Supabase Auth
- Fichier `migration-id-mapping.json` généré avec la correspondance ancien ID → nouveau UUID

---

## [2026-01-06 20:15] - Fix reset-password redirect vers dashboard

### 📝 Demande utilisateur
> Le lien de reset password redirige vers le dashboard au lieu d'afficher le formulaire

### 🔧 Modifications techniques
- **Fichiers déplacés :** `src/app/(auth)/reset-password/` → `src/app/reset-password/`

### 💡 Pourquoi (Raison du changement)
Le layout `(auth)/layout.tsx` redirige tous les utilisateurs connectés vers `/dashboard`. Après le callback recovery, l'utilisateur est authentifié (session Supabase active), donc la page `/reset-password` dans le groupe `(auth)` déclenchait cette redirection.

Solution : Déplacer `/reset-password` hors du groupe `(auth)` pour qu'elle ne soit pas affectée par ce comportement.

---

## [2026-01-06 19:30] - Fix bugs auth Supabase (i18n + reset password flow)

### 📝 Demande utilisateur
> 1. Message inscription en français même en mode anglais
> 2. Clic sur lien reset password → connecte directement au lieu d'afficher le formulaire

### 🔧 Modifications techniques
- **Fichiers modifiés :** 
  - `src/app/actions/auth.ts` — Retourne `needsEmailConfirmation: true` au lieu d'un message hardcodé
  - `src/app/(auth)/register/page.tsx` — Utilise la clé i18n `checkEmailConfirmation`
  - `src/middleware.ts` — `/reset-password` n'est plus redirigé vers dashboard quand connecté
  - `messages/fr.json` / `messages/en.json` — Ajout clé `checkEmailConfirmation`
- **Fichiers créés :**
  - `src/app/auth/callback/recovery/route.ts` — Callback dédié pour le flow password recovery

### 💡 Pourquoi (Raison du changement)
1. **i18n** : Les messages serveur ne doivent jamais être hardcodés. Retourner un flag et laisser le client afficher le message traduit.
2. **Reset password** : Supabase ne préserve pas les query params personnalisés dans `redirectTo`. Solution : utiliser un chemin dédié `/auth/callback/recovery` qui redirige toujours vers `/reset-password`.

### 🔗 Contexte additionnel
- Le middleware permet maintenant `/reset-password` même si l'utilisateur est authentifié (nécessaire pour le flow recovery)
- Le callback recovery échange le code contre une session puis redirige vers `/reset-password`

---

## [2026-01-06 18:30] - Fix bouton changement de langue sur page login

### 📝 Demande utilisateur
> Le bouton de changement de langue sur la page login ne fonctionne pas

### 🔧 Modifications techniques
- **Fichiers modifiés :** 
  - `src/components/layout/auth-language-switcher.tsx`
  - `src/components/layout/language-switcher.tsx`
- **Fonctions modifiées :** `handleLanguageChange()` dans les deux fichiers

### 💡 Pourquoi (Raison du changement)
Avec `next-intl`, le cookie de locale est lu côté serveur via `getRequestConfig`. Quand une server action (`setLocale`) modifie le cookie et appelle `revalidatePath()`, cela invalide le cache mais les composants client déjà rendus ne se re-renderent pas automatiquement avec les nouvelles traductions.

La solution : ajouter `router.refresh()` après l'appel à `setLocale()` pour forcer Next.js à re-fetcher les données serveur et re-rendre la page avec la nouvelle locale.

### 🔗 Contexte additionnel
- Import ajouté : `useRouter` de `next/navigation`
- `handleLanguageChange` est maintenant `async` et await `setLocale(locale)` avant d'appeler `router.refresh()`

---

## [2026-01-06 17:00] - 📋 Planification Migration Supabase (PRD + Architecture)

### 📝 Demande utilisateur
> Migration complète de l'infrastructure backend vers Supabase :
> 1. Migration BDD MySQL → Supabase PostgreSQL (zéro perte de données)
> 2. Refonte Auth JWT maison → Supabase Auth (emails transactionnels délégués)

### 🔧 Modifications techniques
- **Fichiers créés :** 
  - `docs/prd-supabase-migration.md` (787 lignes) — PRD complet avec 7 épics
  - `docs/architecture-supabase-migration.md` — Architecture détaillée avec ADRs

### 💡 Pourquoi (Raison du changement)
Migration majeure nécessitant un workflow de planification complet (brownfield-fullstack) :
- Simplification opérationnelle (auth + emails managés)
- Scalabilité (BDD managée, backups auto)
- Sécurité renforcée (MFA possible, rate limiting built-in)
- Réduction de ~500 lignes de code auth/email custom

### 🔗 Contexte additionnel
**7 Épics identifiés (~28h de travail estimé) :**
1. E1 : Setup Supabase + Configuration (2h)
2. E2 : Migration schéma Prisma MySQL → PostgreSQL (4h)
3. E3 : Script ETL migration données (8h) — CRITIQUE
4. E4 : Refactoring Auth Supabase SDK (6h)
5. E5 : Suppression code legacy + cleanup (2h)
6. E6 : Tests de non-régression (4h)
7. E7 : Déploiement production + cutover (2h)

**Décisions architecturales clés (ADRs) :**
- ADR-1 : Conserver Prisma comme ORM (pas de réécriture)
- ADR-2 : UUID partagé User ↔ auth.users (même ID)
- ADR-3 : Migration big-bang (pas de dual-write)
- ADR-4 : Middleware Next.js pour refresh tokens

**Statut :** ✅ Validé par PO → Stories créées

---

## [2026-01-06 17:30] - Création Stories Migration Supabase

### 📝 Demande utilisateur
> Suite validation PO : créer les stories détaillées pour chaque epic de la migration Supabase.
> Décision PO : Email préventif aux users avant cutover (plutôt que reset forcé).

### 🔧 Modifications techniques
- **Fichiers créés :**
  - `docs/stories/E1-setup-supabase.md` — 5 stories (Setup)
  - `docs/stories/E2-schema-migration.md` — 6 stories (Prisma)
  - `docs/stories/E3-data-migration.md` — 8 stories (ETL)
  - `docs/stories/E4-auth-refactoring.md` — 8 stories (Auth)
  - `docs/stories/E5-cleanup.md` — 6 stories (Cleanup)
  - `docs/stories/E6-tests.md` — 9 stories (Tests)
  - `docs/stories/E7-deployment.md` — 6 stories (Déploiement)

### 💡 Pourquoi
Stories détaillées avec code snippets pour faciliter l'implémentation par le Dev Agent.

### 🔗 Contexte additionnel
- **Total : 48 stories** réparties sur 7 épics
- Chaque story contient : description, critères d'acceptation, code/commandes
- Ordre d'exécution : E1 → E2 → E3 (// E4) → E5 → E6 → E7
- Scripts migration : `scripts/migrate-to-supabase.ts`, `scripts/send-migration-emails.ts`

---

## [2026-01-06 17:00] - 📋 Planification Migration Supabase (PRD + Architecture)

### 📝 Demande utilisateur
> Refonte complète du système OCR/Import pour atteindre 100% de fiabilité avec :
> 1. Gestion des doublons par MERGE (enrichissement) plutôt que skip
> 2. Gestion des partial exits (sorties multiples)
> 3. Création de compte à la volée lors de l'import OCR

### 🔧 Modifications techniques

**Phase 1 - Signature de Trade Flexible :**
- `prisma/schema.prisma` : Ajout `tradeSignature` + index
- `prisma/migrations/20260106120000_add_trade_signature/` : Migration SQL
- `src/services/trade-service.ts` : 
  - `simpleHash()`, `calculateTradeSignature()`, `findTradeBySignature()`
  - Signature basée sur (userId, symbol, DATE, entryPrice arrondi) - stable même si times/exitPrice changent

**Phase 2 - Logique de Merge Intelligente :**
- `src/services/trade-service.ts` :
  - `PartialExitInput`, `MergeTradeInput`, `MergeResult` (interfaces)
  - `mergeTradeData()` : Merge times, partial exits, recalcule totaux
  - `createOrMergeTrade()` : Point d'entrée idempotent (create ou merge selon signature)
- `src/app/actions/trades.ts` : `createTradesFromOcr()` réécrit pour utiliser merge
- `src/app/actions/import.ts` : `commitImport()` et `checkDuplicates()` réécrits pour le merge

**Phase 3 - Partial Exits :**
- ✅ Déjà implémenté dans `trade-detail-content.tsx`
- Durée calculée de entry à last exit (via `closedAt` mis à jour par merge)

**Phase 4 - Création de Compte OCR :**
- `src/app/(dashboard)/importer/import-content.tsx` :
  - États ajoutés : `isCreatingOcrAccount`, `newOcrAccountName`, `newOcrAccountBroker`
  - Fonction `handleCreateOcrAccount()`
  - UI inline dans le dialog de confirmation OCR

**Phase 5 - Validation UI Liste Trades :**
- ✅ `trade.closedAt` = dernière sortie (mis à jour par merge)
- ✅ Prix sortie affiche "(avg)" si partial exits

**Traductions ajoutées :**
- `messages/fr.json` & `messages/en.json` : `mergedCount`, `accountCreated`

### 💡 Pourquoi (Raison du changement)
- **Idempotence** : Upload multiple de la même capture ne crée plus de doublon
- **Enrichissement** : CSV sans heures + OCR avec heures → trade enrichi (pas skip)
- **UX** : Création de compte inline lors de l'import OCR (comme CSV)

### 🔗 Contexte additionnel
- Migration à appliquer : `npx prisma migrate deploy`
- Trades existants sans signature seront retrouvés via fallback fuzzy (date + entry price ±0.5%)
- Retour `commitImport` maintenant : `{ imported, merged, skipped, errors }`

---

## [2026-01-06 14:30] - Refonte OCR/Import Phase 1 : Signature de Trade Flexible (archivé)

*(Contenu archivé - voir entrée complète ci-dessus)*

---

## [2026-01-06 --:--] - Initialisation du système de mémoire persistante

### 📝 Demande utilisateur
> Configuration d'un système de mémoire persistante pour le projet via le fichier `rules.mdc`, permettant à l'IA de garder une trace de toutes les modifications et décisions.

### 🔧 Modifications techniques
- **Fichiers modifiés :** `.cursor/rules/rules.mdc`
- **Fichiers créés :** `PROJECT_MEMORY.md`

### 💡 Pourquoi (Raison du changement)
L'utilisateur souhaite que l'IA maintienne une mémoire persistante du projet pour :
1. Éviter de répéter des erreurs passées
2. Maintenir la cohérence des décisions architecturales
3. Avoir un historique complet des modifications
4. Faciliter la reprise de contexte entre sessions

### 🔗 Contexte additionnel
Le fichier `rules.mdc` contient maintenant :
- Les règles de journalisation systématique
- Le format d'entrée obligatoire pour `PROJECT_MEMORY.md`
- Les instructions de lecture prioritaire avant chaque réponse
- Le contexte complet du projet Trading Journal (stack, features, modèle de données, etc.)

---

