# Epic 7: Déploiement Production + Cutover

**Epic ID:** E7  
**Estimation:** 2h  
**Statut:** Ready for Dev  
**Dépendances:** E1-E6 (tout doit être prêt)  
**Criticité:** 🔴 HAUTE - Production  

---

## Stories

### E7-S1: Préparation pré-migration

**Story ID:** E7-S1  
**Points:** 2  
**Priorité:** P0 (Bloquant)

#### Description
Effectuer toutes les préparations avant le cutover production.

#### Critères d'acceptation
- [ ] Backup MySQL production complet
- [ ] Backup dossier uploads complet
- [ ] Communication aux users envoyée
- [ ] Créneau maintenance planifié

#### Actions

**1. Backup MySQL**
```bash
# Sur le VPS de production
mysqldump -u root -p trading_journal > /backup/trading_journal_$(date +%Y%m%d_%H%M%S).sql
```

**2. Backup Uploads**
```bash
tar -czvf /backup/uploads_$(date +%Y%m%d_%H%M%S).tar.gz /var/www/app/public/uploads
```

**3. Email aux users (à envoyer 24-48h avant)**

```
Objet: [Trading Journal] Maintenance planifiée et mise à jour importante

Bonjour,

Nous effectuons une mise à jour majeure de Trading Journal le [DATE] à [HEURE].

🔧 Ce qui change:
- Infrastructure améliorée pour plus de performance et de sécurité
- Nouveau système d'authentification plus sécurisé

⚠️ Action requise:
Après la mise à jour, vous devrez définir un nouveau mot de passe.
Vous recevrez un email avec un lien pour le faire.

⏱️ Durée estimée: 30 minutes d'indisponibilité

📊 Vos données:
Toutes vos données (trades, notes, statistiques) seront conservées intégralement.

Merci de votre patience!
L'équipe Trading Journal
```

**4. Checklist pré-migration**
- [ ] Backup MySQL vérifié (taille cohérente)
- [ ] Backup uploads vérifié
- [ ] Email préventif envoyé
- [ ] Créneau communiqué (ex: dimanche 03:00 UTC)
- [ ] Script ETL testé une dernière fois sur copie des données

---

### E7-S2: Envoyer emails reset password

**Story ID:** E7-S2  
**Points:** 2  
**Priorité:** P0 (Bloquant)

#### Description
Envoyer un email de reset password à tous les users migrés APRÈS la migration des données.

#### Critères d'acceptation
- [ ] Tous les users reçoivent un email
- [ ] Lien valide vers reset password
- [ ] Template clair et rassurant

#### Script d'envoi

```typescript
// scripts/send-migration-emails.ts
import { createAdminClient } from '@/lib/supabase/server'

async function sendMigrationEmails() {
  const supabase = createAdminClient()
  
  // Récupérer tous les users migrés
  const { data: users, error } = await supabase.auth.admin.listUsers()
  
  if (error) {
    console.error('Error fetching users:', error)
    return
  }
  
  console.log(`Sending reset emails to ${users.users.length} users...`)
  
  for (const user of users.users) {
    // Vérifier que c'est un user migré (via metadata)
    if (!user.user_metadata?.migratedFrom) {
      continue
    }
    
    try {
      // Générer lien de reset password
      const { error: resetError } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: user.email!,
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?type=recovery`,
        },
      })
      
      if (resetError) {
        console.error(`Failed for ${user.email}:`, resetError.message)
      } else {
        console.log(`✅ Reset email sent to: ${user.email}`)
      }
      
      // Petit délai pour éviter rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
      
    } catch (e) {
      console.error(`Error for ${user.email}:`, e)
    }
  }
  
  console.log('Done!')
}

sendMigrationEmails()
```

#### Template email (à configurer dans Supabase)

```html
<h2>Bienvenue sur le nouveau Trading Journal!</h2>

<p>Nous avons mis à jour notre infrastructure pour améliorer la sécurité et les performances.</p>

<p>Pour continuer à utiliser votre compte, veuillez définir un nouveau mot de passe en cliquant sur le bouton ci-dessous:</p>

<p style="margin: 30px 0;">
  <a href="{{ .ConfirmationURL }}" 
     style="background-color: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
    Définir mon nouveau mot de passe
  </a>
</p>

<p>Ce lien est valide pendant 24 heures.</p>

<p><strong>Vos données sont intactes</strong> - tous vos trades, notes et statistiques ont été migrés.</p>

<p>Merci de votre confiance!</p>
```

---

### E7-S3: Cutover Production

**Story ID:** E7-S3  
**Points:** 3  
**Priorité:** P0 (Bloquant)

#### Description
Exécuter le cutover de production.

#### Timeline détaillée

```
T-30min : Début de la fenêtre de maintenance
         └─ Mettre page maintenance
         
T-25min : Backup final
         └─ mysqldump (pour avoir le dernier état)
         
T-20min : Exécuter script ETL
         └─ npx tsx scripts/migrate-to-supabase.ts
         
T-10min : Validation migration
         └─ Vérifier counts
         └─ Spot-check quelques trades
         
T-5min  : Déployer nouveau code
         └─ git pull && npm run build && pm2 restart
         
T-3min  : Mettre à jour variables env production
         └─ Ajouter Supabase vars
         └─ Retirer MySQL vars legacy
         
T-2min  : Tests smoke
         └─ Login test user
         └─ Accès dashboard
         └─ Voir trades
         
T-1min  : Go/No-Go décision
         
T0      : Retirer page maintenance
         
T+5min  : Envoyer emails reset password
         └─ npx tsx scripts/send-migration-emails.ts
         
T+10min : Monitoring
         └─ Vérifier logs
         └─ Vérifier premiers logins users
```

#### Commandes de déploiement

```bash
# Sur le VPS

# 1. Page maintenance
echo "Maintenance en cours..." > /var/www/app/public/maintenance.html
# (configurer nginx pour servir cette page)

# 2. Pull nouveau code
cd /var/www/app
git pull origin main

# 3. Install deps
npm install

# 4. Build
npm run build

# 5. Mettre à jour .env
nano .env
# Ajouter: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, etc.
# Modifier: DATABASE_URL (PostgreSQL)
# Supprimer: JWT_SECRET, SMTP_*

# 6. Appliquer schema Prisma
npx prisma db push

# 7. Restart app
pm2 restart all

# 8. Vérifier logs
pm2 logs --lines 50

# 9. Retirer maintenance
rm /var/www/app/public/maintenance.html
# (ou reconfigurer nginx)
```

---

### E7-S4: Validation post-cutover

**Story ID:** E7-S4  
**Points:** 1  
**Priorité:** P0 (Bloquant)

#### Description
Valider que tout fonctionne après le cutover.

#### Critères d'acceptation
- [ ] App accessible
- [ ] Login fonctionne
- [ ] Dashboard charge
- [ ] Trades visibles
- [ ] Aucune erreur dans les logs

#### Checklist validation

| # | Test | Status |
|---|------|--------|
| 1 | Page login charge | ⬜ |
| 2 | Login test user | ⬜ |
| 3 | Dashboard affiche KPIs | ⬜ |
| 4 | Liste trades visible | ⬜ |
| 5 | Détail trade OK | ⬜ |
| 6 | Import CSV fonctionne | ⬜ |
| 7 | Notes journal OK | ⬜ |
| 8 | Logout fonctionne | ⬜ |
| 9 | Reset password email reçu | ⬜ |
| 10 | Logs sans erreur | ⬜ |

---

### E7-S5: Monitoring post-migration

**Story ID:** E7-S5  
**Points:** 1  
**Priorité:** P1 (Important)

#### Description
Surveiller l'application pendant les premières heures/jours.

#### Critères d'acceptation
- [ ] Pas d'erreurs récurrentes
- [ ] Users peuvent se connecter
- [ ] Performance acceptable

#### Actions de monitoring

```bash
# Surveiller les logs en temps réel
pm2 logs

# Vérifier Supabase Dashboard
# - Auth > Users : connexions récentes
# - Database > Logs : erreurs SQL

# Vérifier métriques
# - Temps de réponse
# - Erreurs 500
# - Taux de login réussi
```

#### Critères de rollback

Si dans les 30 minutes suivant le cutover :
- [ ] Plus de 10% des users ne peuvent pas se connecter
- [ ] Erreurs 500 répétées
- [ ] Perte de données détectée

→ **Rollback immédiat** (voir procédure dans architecture doc)

---

### E7-S6: Documentation finale

**Story ID:** E7-S6  
**Points:** 1  
**Priorité:** P2 (Nice to have)

#### Description
Documenter la migration pour référence future.

#### Critères d'acceptation
- [ ] PROJECT_MEMORY.md mis à jour
- [ ] Leçons apprises documentées
- [ ] Ancien système documenté (pour archive)

---

## Checklist Epic E7

- [ ] E7-S1: Préparation complète
- [ ] E7-S2: Script emails prêt
- [ ] E7-S3: Cutover exécuté
- [ ] E7-S4: Validation passée
- [ ] E7-S5: Monitoring en place
- [ ] E7-S6: Documentation finale

**Epic E7 terminé quand :** App en production sur Supabase, tous les users peuvent se connecter.

---

## Plan de Rollback (Rappel)

**Avant T0 (point de non-retour):**
```bash
# Si problème critique détecté AVANT de retirer la maintenance:

# 1. Ne pas retirer la maintenance
# 2. Restaurer ancien code
git checkout main-pre-supabase
git push origin main --force

# 3. Restaurer .env avec MySQL
# 4. Redéployer
npm run build && pm2 restart all

# 5. Retirer maintenance
```

**Après T0:** Pas de rollback simple - corriger en avant.

