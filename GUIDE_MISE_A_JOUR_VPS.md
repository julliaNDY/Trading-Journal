# 📘 Guide de Mise à Jour du Site sur VPS

> **Stack technique :** Next.js 15 + Prisma + PostgreSQL (Supabase) + PM2
> 
> **Dernière mise à jour :** Janvier 2026

---

## 📋 Checklist Rapide

```
[ ] 1. Connexion SSH
[ ] 2. Backup de précaution
[ ] 3. git pull
[ ] 4. npm install
[ ] 5. Prisma migrate
[ ] 6. npm run build
[ ] 7. PM2 restart
[ ] 8. Vérification
```

---

## 🔐 Étape 1 : Connexion SSH

```bash
# Connexion au serveur
ssh user@votre-serveur.com

# OU avec clé SSH spécifique
ssh -i ~/.ssh/votre_cle user@votre-serveur.com

# Se rendre dans le dossier du projet
cd /var/www/trading-journal
# ou
cd ~/apps/trading-journal
```

---

## 💾 Étape 2 : Backup de Précaution

### Option A : Backup rapide (recommandé)

```bash
# Créer un dossier de backup avec la date
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p ~/backups/$BACKUP_DATE

# Sauvegarder les fichiers critiques
cp .env ~/backups/$BACKUP_DATE/.env.backup
cp -r prisma ~/backups/$BACKUP_DATE/prisma.backup

echo "✅ Backup créé dans ~/backups/$BACKUP_DATE"
```

### Option B : Backup complet (avant mise à jour majeure)

```bash
# Backup complet du dossier (exclut node_modules et .next)
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
tar --exclude='node_modules' --exclude='.next' -czvf ~/backups/trading-journal-$BACKUP_DATE.tar.gz .

echo "✅ Backup complet créé"
```

> **Note :** La base de données PostgreSQL est hébergée sur Supabase. Les backups automatiques sont gérés par Supabase. Pour un backup manuel, utilisez le Dashboard Supabase > Project Settings > Database > Backups.

---

## 📥 Étape 3 : Récupérer les Modifications (git pull)

```bash
# Vérifier la branche actuelle
git branch

# S'assurer d'être sur la bonne branche
git checkout main  # ou master selon votre configuration

# Récupérer les modifications
git pull origin main

# En cas de conflit (rare en production)
git stash  # Sauvegarder les modifications locales
git pull origin main
git stash pop  # Réappliquer les modifications locales
```

---

## 📦 Étape 4 : Installation des Dépendances

```bash
# Installer les nouvelles dépendances (si package.json a changé)
npm install --production=false

# OU pour une installation propre
npm ci
```

> **⚠️ Important :** Si vous voyez des erreurs npm, essayez :
> ```bash
> rm -rf node_modules package-lock.json
> npm install
> ```

---

## 🗄️ Étape 5 : Migrations de Base de Données

```bash
# Vérifier si des migrations sont en attente
npx prisma migrate status

# Appliquer les migrations
npx prisma migrate deploy

# Générer le client Prisma (si le schema a changé)
npx prisma generate
```

> **⚠️ En cas d'erreur de migration :**
> 1. Ne **JAMAIS** utiliser `prisma migrate dev` en production
> 2. Si erreur, vérifier les logs : `npx prisma migrate status`
> 3. Contacter un développeur si la migration échoue

---

## 🏗️ Étape 6 : Build de l'Application

```bash
# Builder l'application Next.js
npm run build
```

> **Durée estimée :** 2-5 minutes selon la puissance du serveur
> 
> **En cas d'erreur de build :**
> - Vérifier les logs d'erreur
> - S'assurer que les variables d'environnement sont correctes
> - Vérifier l'espace disque : `df -h`

---

## 🔄 Étape 7 : Redémarrage du Service

### Avec PM2 (Recommandé)

```bash
# Redémarrer l'application
pm2 restart trading-journal

# OU recharger sans downtime (zero-downtime reload)
pm2 reload trading-journal

# Vérifier le statut
pm2 status

# Voir les logs en temps réel
pm2 logs trading-journal --lines 50
```

### Première fois avec PM2 ?

```bash
# Démarrer l'application avec PM2
pm2 start npm --name "trading-journal" -- start

# Sauvegarder la configuration PM2
pm2 save

# Configurer le démarrage automatique au boot
pm2 startup
```

### Alternative : Systemd

```bash
# Si vous utilisez systemd au lieu de PM2
sudo systemctl restart trading-journal
sudo systemctl status trading-journal
```

---

## ✅ Étape 8 : Vérification

### Tests automatiques

```bash
# Vérifier que le serveur répond
curl -I http://localhost:3000

# OU avec le domaine
curl -I https://votre-domaine.com
```

### Vérifications manuelles

1. **Page d'accueil** : Ouvrir le site dans un navigateur
2. **Connexion** : Tester le login avec un compte test
3. **Dashboard** : Vérifier que les données s'affichent
4. **Import CSV** : Tester l'import d'un fichier test
5. **Logs** : `pm2 logs --lines 100` (pas d'erreurs rouges)

### Vérifier les processus

```bash
# Statut PM2
pm2 status

# Mémoire utilisée
pm2 monit

# Logs d'erreur uniquement
pm2 logs --err
```

---

## 🚨 En Cas de Problème

### Rollback rapide

```bash
# Annuler le dernier git pull
git reset --hard HEAD~1

# Réinstaller les dépendances de l'ancienne version
npm install

# Rebuild
npm run build

# Redémarrer
pm2 restart trading-journal
```

### Restaurer depuis un backup

```bash
# Restaurer le .env si nécessaire
cp ~/backups/YYYYMMDD_HHMMSS/.env.backup .env

# Réinstaller et rebuild
npm install
npm run build
pm2 restart trading-journal
```

### Contacts urgence

- **Email développeur :** [À COMPLÉTER]
- **Documentation Supabase :** https://supabase.com/docs
- **Dashboard Supabase :** https://app.supabase.com

---

## 📝 Commandes Utiles

| Action | Commande |
|--------|----------|
| Voir les logs | `pm2 logs trading-journal` |
| Redémarrer | `pm2 restart trading-journal` |
| Arrêter | `pm2 stop trading-journal` |
| Statut | `pm2 status` |
| Monitoring | `pm2 monit` |
| Espace disque | `df -h` |
| Mémoire | `free -m` |
| Processus Node | `ps aux \| grep node` |

---

## 🔄 Script Automatique (Optionnel)

Créez un script `deploy.sh` à la racine :

```bash
#!/bin/bash
set -e

echo "🚀 Début du déploiement..."

# Backup
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p ~/backups/$BACKUP_DATE
cp .env ~/backups/$BACKUP_DATE/.env.backup
echo "✅ Backup créé"

# Git pull
git pull origin main
echo "✅ Code mis à jour"

# Dependencies
npm ci
echo "✅ Dépendances installées"

# Migrations
npx prisma migrate deploy
npx prisma generate
echo "✅ Base de données migrée"

# Build
npm run build
echo "✅ Build terminé"

# Restart
pm2 restart trading-journal
echo "✅ Application redémarrée"

# Health check
sleep 5
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200" && echo "✅ Site en ligne" || echo "⚠️ Vérifier le site manuellement"

echo "🎉 Déploiement terminé !"
```

Utilisation :
```bash
chmod +x deploy.sh
./deploy.sh
```

---

*Guide rédigé pour l'équipe Trading Journal - Janvier 2026*

