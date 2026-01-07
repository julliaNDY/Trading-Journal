# 🗺️ ROADMAP - Trading Journal App

> **Stratégie : "Clean & Scale"**
> Ne rien construire de nouveau avant d'avoir des fondations saines.

---

## Statut du Projet

| Milestone | Statut | Date |
|-----------|--------|------|
| Migration Supabase | ✅ Terminé | 2026-01-06 |
| Phase 1 : Audit & Optimisation | ✅ Terminé | 2026-01-07 |
| Phase 2 : Nouvelles Fonctionnalités | ✅ Terminé | 2026-01-07 |

---

## PHASE 1 : AUDIT & OPTIMISATION 🔍

> **Priorité : ABSOLUE**
> Objectif : Identifier la dette technique, les goulots d'étranglement et le code mort.

### Epic 0 : Audit Technique Complet ✅ COMPLETE

| Story | Description | Statut |
|-------|-------------|--------|
| 0.1 | Audit structure du code & architecture | ✅ Done |
| 0.2 | Analyse dette technique & code mort | ✅ Done |
| 0.3 | Audit performance (queries, renders, bundle) | ✅ Done |
| 0.4 | Audit sécurité (auth, validation, CORS) | ✅ Done |
| 0.5 | Rapport d'audit & plan de refactoring | ✅ Done |

**Rapport complet :** [docs/AUDIT_REPORT.md](./AUDIT_REPORT.md)

### Epic 1 : Refactoring & Modularisation ✅ COMPLETE

| Story | Description | Statut |
|-------|-------------|--------|
| 1.1 | Suppression code mort + Logger centralisé | ✅ Done |
| 1.2 | Refactoring voice-notes (-641 lignes, -40%) | ✅ Done |
| 1.3 | Lazy loading charts (Recharts, Lightweight) | ✅ Done |
| 1.4 | Composant Skeleton UI ajouté | ✅ Done |
| 1.5 | Documentation technique mise à jour | ✅ Done |

**Réalisations :**
- Créé `src/lib/logger.ts` : Logger centralisé avec niveaux (debug/info/warn/error)
- Refactorisé `voice-notes-section` : composant générique réutilisable
- Lazy loading des 4 charts : réduction bundle initial ~200KB
- Nettoyé code mort : mysql2, subscription-service.ts, migration-script

---

## PHASE 2 : NOUVELLES FONCTIONNALITÉS 🚀

> **Pré-requis : Phase 1 terminée**

### A. Connectivité & Données (Data Integrity)

#### Epic 2 : Broker Sync ✅ COMPLETE
**Objectif :** Synchronisation automatique des trades via API broker.

| Story | Description | Priorité | Status |
|-------|-------------|----------|--------|
| 2.1 | Architecture Broker Sync (abstraction multi-broker) | HIGH | ✅ Done |
| 2.2 | Intégration API Tradovate | HIGH | ✅ Done |
| 2.3 | Intégration API IBKR via Flex Query | HIGH | ✅ Done |
| 2.4 | Scheduler de synchronisation automatique | MEDIUM | ✅ Done |
| 2.5 | UI gestion des connexions broker | MEDIUM | ✅ Done |

#### Epic 3 : TradingView Integration ✅ COMPLETE
**Objectif :** Afficher les points d'exécution sur graphique TradingView.

| Story | Description | Priorité | Status |
|-------|-------------|----------|--------|
| 3.1 | Intégration Lightweight Charts (TradingView open-source) | HIGH | ✅ Done |
| 3.2 | Overlay des points d'entrée/sortie sur le chart | HIGH | ✅ Done |
| 3.3 | Synchronisation symbole/timeframe avec trade sélectionné | MEDIUM | ✅ Done |
| 3.4 | Intégration données broker réelles (dépend Epic 2) | LOW | ✅ Done |

#### Epic 4 : OCR Avancé ✅ COMPLETE
**Objectif :** Extraction automatique Drawdown & Runup via OCR.

| Story | Description | Priorité | Status |
|-------|-------------|----------|--------|
| 4.1 | Extraction DD/RU dans ocr-service.ts | HIGH | ✅ Done |
| 4.2 | Ajout champs Drawdown/Runup au flow OCR UI | HIGH | ✅ Done |
| 4.3 | Validation & correction manuelle des valeurs extraites | MEDIUM | ✅ Done |

---

### B. Intelligence Artificielle & Voix (AI Experience)

#### Epic 5 : Voice-to-Insight (Trades) ✅ COMPLETE
**Objectif :** Notes vocales sur les trades avec transcription + synthèse IA.

| Story | Description | Priorité | Status |
|-------|-------------|----------|--------|
| 5.1 | Composant enregistrement audio (Web Audio API) | HIGH | ✅ Done |
| 5.2 | Intégration Whisper API pour transcription | HIGH | ✅ Done |
| 5.3 | Synthèse LLM des points clés (sans perte d'info) | HIGH | ✅ Done |
| 5.4 | Stockage & affichage notes vocales sur page trade | MEDIUM | ✅ Done |

#### Epic 6 : Voice-to-Insight (Journal) ✅ COMPLETE
**Objectif :** Même fonctionnalité pour la page Journal quotidien.

| Story | Description | Priorité | Status |
|-------|-------------|----------|--------|
| 6.1 | Réutilisation composant audio (Epic 5) | HIGH | ✅ Done |
| 6.2 | Intégration sur page Journal | HIGH | ✅ Done |
| 6.3 | Résumé automatique de la journée via LLM | MEDIUM | ✅ Done |

#### Epic 7 : AI Coach & Feedback ✅ COMPLETE
**Objectif :** Bouton micro flottant pour coaching IA interactif.

| Story | Description | Priorité | Status |
|-------|-------------|----------|--------|
| 7.1 | Composant micro flottant (Dashboard & Stats) | HIGH | ✅ Done |
| 7.2 | Chat conversationnel avec contexte trading | HIGH | ✅ Done |
| 7.3 | Analyse des résultats & conseils personnalisés | HIGH | ✅ Done |
| 7.4 | Collecte feedbacks/suggestions utilisateur | MEDIUM | ✅ Done |

---

### C. Utilisateurs & Social (User Growth)

#### Epic 8 : Social Login
**Objectif :** Inscription/Connexion via Google, Apple, Discord.

| Story | Description | Priorité | Status |
|-------|-------------|----------|--------|
| 8.1 | Configuration providers Supabase (Google, Apple, Discord) | HIGH | ✅ Done* |
| 8.2 | Boutons social login sur pages auth | HIGH | ✅ Done |
| 8.3 | Récupération auto username Discord | MEDIUM | ✅ Done |
| 8.4 | Liaison compte existant avec social | MEDIUM | ✅ Done |

*Note: Discord actif. Google/Apple nécessitent configuration Supabase Dashboard.

#### Epic 9 : Playbook Sharing ✅ COMPLETE
**Objectif :** Partage de stratégies entre utilisateurs.

| Story | Description | Priorité | Status |
|-------|-------------|----------|--------|
| 9.1 | Modèle données partage (visibilité, permissions) | HIGH | ✅ Done |
| 9.2 | UI partage playbook (lien, embed) | HIGH | ✅ Done |
| 9.3 | Page découverte playbooks publics | MEDIUM | ✅ Done |
| 9.4 | Import playbook d'un autre utilisateur | MEDIUM | ✅ Done |

---

### D. Gestion de Compte & Business (Monetization & Compliance)

#### Epic 10 : Gestion de Profil Avancée ✅ COMPLETE
**Objectif :** Page profil complète avec toutes les options.

| Story | Description | Priorité | Status |
|-------|-------------|----------|--------|
| 10.1 | Upload & gestion avatar | MEDIUM | ✅ Done |
| 10.2 | Suppression de compte (RGPD) | HIGH | ✅ Done |
| 10.3 | Archivage comptes trading | MEDIUM | ✅ Done |
| 10.4 | Liaison/Déliaison comptes sociaux | MEDIUM | ✅ Done |
| 10.5 | Changement email/mot de passe | HIGH | ✅ Done |
| 10.6 | Changement langue préférée | LOW | ✅ Done |

#### Epic 11 : Abonnements (SaaS) ✅ COMPLETE
**Objectif :** Système de paiement avec Stripe.

| Story | Description | Priorité | Status |
|-------|-------------|----------|--------|
| 11.1 | Architecture subscription (modèle données + Stripe) | HIGH | ✅ Done |
| 11.2 | Intégration Stripe (checkout, webhooks, portal) | HIGH | ✅ Done |
| 11.3 | Plans : Mensuel 10€, Trimestriel 20€, Semestriel 50€, Annuel 70€ | HIGH | ✅ Done |
| 11.4 | Page pricing + gestion facturation | MEDIUM | ✅ Done |
| 11.5 | Feature gating selon plan | MEDIUM | ✅ Done |
| 11.6 | Mentions légales mises à jour (adresse + tarifs) | MEDIUM | ✅ Done |

#### Epic 12 : Légal & Internationalisation ✅ COMPLETE
**Objectif :** Conformité légale + site bilingue complet.

| Story | Description | Priorité | Status |
|-------|-------------|----------|--------|
| 12.1 | Page CGV (FR + EN) | HIGH | ✅ Done |
| 12.2 | Page CGU (FR + EN) | HIGH | ✅ Done |
| 12.3 | Page Mentions Légales (FR + EN) | HIGH | ✅ Done |
| 12.4 | Formulaire de contact | MEDIUM | ✅ Done |
| 12.5 | Audit i18n complet (toutes les pages) | HIGH | ✅ Done |
| 12.6 | Adaptation dynamique selon préférence user | MEDIUM | ✅ Done |

---

## Estimation Globale

| Phase | Épics | Estimation |
|-------|-------|------------|
| Phase 1 : Audit & Optimisation | 2 | ~2-3 semaines |
| Phase 2A : Connectivité & Données | 3 | ~4-6 semaines |
| Phase 2B : IA & Voix | 3 | ~4-6 semaines |
| Phase 2C : Utilisateurs & Social | 2 | ~2-3 semaines |
| Phase 2D : Compte & Business | 3 | ~4-5 semaines |

**Total estimé : 16-23 semaines** (hors imprévus)

---

## Notes

- Les estimations sont indicatives et seront affinées après l'audit
- L'ordre des épics Phase 2 peut être réorganisé selon les priorités business
- Chaque epic fera l'objet d'un PRD détaillé avant développement

---

*Dernière mise à jour : 2026-01-07*

