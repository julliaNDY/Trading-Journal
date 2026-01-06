# Epic 6: Tests de Non-Régression

**Epic ID:** E6  
**Estimation:** 4h  
**Statut:** Ready for Dev  
**Dépendances:** E3, E4, E5  

---

## Stories

### E6-S1: Tests Auth - Inscription

**Story ID:** E6-S1  
**Points:** 2  
**Priorité:** P0 (Bloquant)

#### Description
Tester le flow complet d'inscription via Supabase.

#### Critères d'acceptation
- [ ] Formulaire inscription fonctionne
- [ ] Email de confirmation reçu
- [ ] Clic sur lien confirmation → user activé
- [ ] User créé dans `auth.users` ET `public.users`
- [ ] Redirection vers dashboard après confirmation

#### Scénarios de test

| # | Action | Résultat attendu |
|---|--------|------------------|
| 1 | Remplir formulaire avec nouvel email | Message "Vérifiez votre email" |
| 2 | Vérifier boîte mail | Email de confirmation reçu |
| 3 | Cliquer sur lien dans email | Page charge sans erreur |
| 4 | Vérifier Supabase Dashboard > Auth | User présent avec email confirmé |
| 5 | Vérifier public.users via Prisma Studio | User présent avec même ID |

#### Données de test

```
Email: test-migration-1@example.com
Password: TestPassword123!
Discord: test_user
```

---

### E6-S2: Tests Auth - Connexion

**Story ID:** E6-S2  
**Points:** 2  
**Priorité:** P0 (Bloquant)

#### Description
Tester le flow de connexion via Supabase.

#### Critères d'acceptation
- [ ] Login avec bon password → succès
- [ ] Login avec mauvais password → erreur claire
- [ ] Login user non confirmé → message approprié
- [ ] Login user bloqué → message approprié
- [ ] Session persistée (refresh page = toujours connecté)

#### Scénarios de test

| # | Action | Résultat attendu |
|---|--------|------------------|
| 1 | Login avec credentials corrects | Redirection vers /dashboard |
| 2 | Login avec mauvais password | "Email ou mot de passe incorrect" |
| 3 | Login avec email inexistant | "Email ou mot de passe incorrect" |
| 4 | Refresh page après login | Toujours sur dashboard |
| 5 | Nouveau onglet sur /dashboard | Toujours connecté |

---

### E6-S3: Tests Auth - Déconnexion

**Story ID:** E6-S3  
**Points:** 1  
**Priorité:** P0 (Bloquant)

#### Description
Tester la déconnexion via Supabase.

#### Critères d'acceptation
- [ ] Bouton logout → redirection login
- [ ] Accès /dashboard après logout → redirection login
- [ ] Cookies Supabase supprimés

#### Scénarios de test

| # | Action | Résultat attendu |
|---|--------|------------------|
| 1 | Clic sur Logout | Redirection vers /login |
| 2 | Accès direct /dashboard | Redirection vers /login |
| 3 | Vérifier cookies (DevTools) | Pas de cookie sb-* |

---

### E6-S4: Tests Auth - Reset Password

**Story ID:** E6-S4  
**Points:** 2  
**Priorité:** P0 (Bloquant)

#### Description
Tester le flow de réinitialisation de mot de passe.

#### Critères d'acceptation
- [ ] Page forgot-password accessible
- [ ] Soumission email → message succès (même si email inexistant)
- [ ] Email reçu avec lien
- [ ] Lien → page reset-password
- [ ] Nouveau password → login fonctionne

#### Scénarios de test

| # | Action | Résultat attendu |
|---|--------|------------------|
| 1 | Soumettre email existant | "Email envoyé" (ou similaire) |
| 2 | Soumettre email inexistant | Même message (pas d'énumération) |
| 3 | Vérifier boîte mail | Email reset reçu |
| 4 | Cliquer sur lien | Page reset-password |
| 5 | Définir nouveau password | Succès |
| 6 | Login avec nouveau password | Accès dashboard |

---

### E6-S5: Tests Data - Trades existants

**Story ID:** E6-S5  
**Points:** 2  
**Priorité:** P0 (Bloquant)

#### Description
Vérifier que les trades migrés sont accessibles et corrects.

#### Critères d'acceptation
- [ ] Liste trades affiche les trades migrés
- [ ] Détail trade affiche toutes les infos
- [ ] Partial exits visibles
- [ ] Screenshots visibles
- [ ] Tags assignés visibles

#### Scénarios de test

| # | Action | Résultat attendu |
|---|--------|------------------|
| 1 | Aller sur /trades | Liste des trades migrés |
| 2 | Cliquer sur un trade | Détail complet |
| 3 | Vérifier dates | Dates correctes |
| 4 | Vérifier PnL | Valeurs correctes |
| 5 | Vérifier screenshots | Images chargent |

---

### E6-S6: Tests Data - Création trade

**Story ID:** E6-S6  
**Points:** 2  
**Priorité:** P0 (Bloquant)

#### Description
Vérifier que la création de nouveaux trades fonctionne.

#### Critères d'acceptation
- [ ] Import CSV fonctionne
- [ ] Import OCR fonctionne
- [ ] Trade créé avec bon userId (UUID)
- [ ] Détail trade accessible

#### Scénarios de test

| # | Action | Résultat attendu |
|---|--------|------------------|
| 1 | Import CSV simple | Trades créés |
| 2 | Vérifier userId en DB | Format UUID |
| 3 | Import OCR | Trade créé |
| 4 | Éditer trade | Modifications sauvées |

---

### E6-S7: Tests Data - Journal

**Story ID:** E6-S7  
**Points:** 2  
**Priorité:** P1 (Important)

#### Description
Vérifier que les notes de journal fonctionnent.

#### Critères d'acceptation
- [ ] Notes existantes visibles
- [ ] Création nouvelle note OK
- [ ] Tags de jour OK
- [ ] Screenshots de jour OK

#### Scénarios de test

| # | Action | Résultat attendu |
|---|--------|------------------|
| 1 | Aller sur /journal | Calendrier affiché |
| 2 | Cliquer jour avec note | Note affichée |
| 3 | Modifier note | Sauvegarde OK |
| 4 | Ajouter tag | Tag visible |

---

### E6-S8: Tests Stats

**Story ID:** E6-S8  
**Points:** 2  
**Priorité:** P1 (Important)

#### Description
Vérifier que les statistiques sont calculées correctement.

#### Critères d'acceptation
- [ ] Dashboard affiche KPIs
- [ ] Profit factor correct
- [ ] Equity curve correcte
- [ ] Calendrier PnL correct

#### Scénarios de test

| # | Action | Résultat attendu |
|---|--------|------------------|
| 1 | Aller sur /dashboard | KPIs affichés |
| 2 | Vérifier un calcul manuellement | Valeur correcte |
| 3 | Aller sur /statistiques | Charts affichés |
| 4 | Aller sur /calendrier | PnL par jour correct |

---

### E6-S9: Tests User Migré

**Story ID:** E6-S9  
**Points:** 3  
**Priorité:** P0 (Bloquant - Production)

#### Description
Tester qu'un user migré peut se reconnecter après avoir reset son password.

#### Critères d'acceptation
- [ ] User migré reçoit email de reset (via email préventif)
- [ ] Peut définir nouveau password
- [ ] Peut se connecter avec nouveau password
- [ ] Voit toutes ses données (trades, notes, etc.)

#### Scénarios de test (avec un vrai user migré)

| # | Action | Résultat attendu |
|---|--------|------------------|
| 1 | User reçoit email préventif | Email reçu |
| 2 | Clic sur lien reset | Page reset-password |
| 3 | Définir nouveau password | Succès |
| 4 | Login | Accès dashboard |
| 5 | Vérifier trades | Tous les trades présents |
| 6 | Vérifier notes | Notes présentes |

---

## Checklist Epic E6

- [ ] E6-S1: Test inscription ✓
- [ ] E6-S2: Test connexion ✓
- [ ] E6-S3: Test déconnexion ✓
- [ ] E6-S4: Test reset password ✓
- [ ] E6-S5: Test trades existants ✓
- [ ] E6-S6: Test création trade ✓
- [ ] E6-S7: Test journal ✓
- [ ] E6-S8: Test stats ✓
- [ ] E6-S9: Test user migré ✓

**Epic E6 terminé quand :** Tous les tests passent, aucune régression détectée.

