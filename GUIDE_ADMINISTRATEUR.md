# 📚 Guide Administrateur - Trading Path Journal

> **Pour qui ?** Ce guide est destiné aux administrateurs sans connaissances techniques.  
> **Objectif :** Vous permettre de lancer, maintenir et dépanner le site en toute autonomie.

---

## 📑 Table des matières

1. [Lancer le site sur votre ordinateur](#-1-lancer-le-site-sur-votre-ordinateur)
2. [Mettre le site en ligne (serveur)](#-2-mettre-le-site-en-ligne-serveur)
3. [Gérer les paramètres secrets](#-3-gérer-les-paramètres-secrets)
4. [Maintenance quotidienne](#-4-maintenance-quotidienne)
5. [Que faire si ça plante ?](#-5-que-faire-si-ça-plante)
6. [Glossaire des termes](#-6-glossaire-des-termes)

---

## 🖥️ 1. Lancer le site sur votre ordinateur

### Étape 1 : Installer les outils nécessaires

Avant de pouvoir lancer le site, vous devez installer deux logiciels gratuits :

#### A. Installer Node.js (le moteur du site)

1. Allez sur : **https://nodejs.org**
2. Cliquez sur le bouton vert **"LTS"** (version recommandée)
3. Téléchargez et installez le fichier
4. **Sur Mac :** Double-cliquez sur le fichier `.pkg` et suivez les instructions
5. **Sur Windows :** Double-cliquez sur le fichier `.msi` et suivez les instructions

**Pour vérifier que ça a marché :**
1. Ouvrez le **Terminal** (Mac) ou **PowerShell** (Windows)
2. Tapez : `node --version`
3. Vous devriez voir un numéro comme `v20.x.x`

#### B. Installer Git (optionnel, pour les mises à jour)

1. Allez sur : **https://git-scm.com**
2. Téléchargez et installez la version pour votre système

---

### Étape 2 : Télécharger le projet

**Option A : Avec Git (recommandé)**
```
git clone [URL_DU_REPO] trading-journal
cd trading-journal
```

**Option B : Sans Git**
1. Téléchargez le fichier ZIP du projet
2. Décompressez-le dans un dossier de votre choix

---

### Étape 3 : Configurer les paramètres secrets

1. Dans le dossier du projet, trouvez le fichier `env.example`
2. Faites une copie et renommez-la `.env`
3. Ouvrez `.env` avec un éditeur de texte (Bloc-notes, TextEdit, VS Code)
4. Remplissez les valeurs selon les instructions dans le fichier

⚠️ **Important :** Ne partagez JAMAIS ce fichier `.env` avec qui que ce soit !

---

### Étape 4 : Installer les dépendances

Ouvrez le Terminal dans le dossier du projet et tapez :

```
npm install
```

**Attendez** que l'installation se termine (peut prendre 2-5 minutes).

---

### Étape 5 : Préparer la base de données

Tapez cette commande :

```
npx prisma db push
```

Cela crée toutes les tables nécessaires dans votre base de données.

---

### Étape 6 : Lancer le site !

```
npm run dev
```

**Félicitations !** 🎉 

Ouvrez votre navigateur et allez sur : **http://localhost:3000**

Pour arrêter le site, appuyez sur `Ctrl + C` dans le Terminal.

---

## 🌐 2. Mettre le site en ligne (serveur)

### Prérequis serveur

- Un serveur VPS (OVH, Scaleway, DigitalOcean, etc.)
- Système : Ubuntu 22.04 ou plus récent
- Au minimum : 2 Go de RAM, 20 Go de stockage

### Étape 1 : Se connecter au serveur

```
ssh root@VOTRE_IP_SERVEUR
```

(Remplacez `VOTRE_IP_SERVEUR` par l'adresse IP de votre serveur)

### Étape 2 : Installer les outils sur le serveur

```bash
# Mise à jour du système
sudo apt update && sudo apt upgrade -y

# Installer Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Installer PM2 (pour garder le site en ligne)
sudo npm install -g pm2

# Installer Nginx (pour gérer les connexions)
sudo apt install nginx -y
```

### Étape 3 : Copier le projet sur le serveur

```bash
# Créer le dossier
mkdir -p /var/www/trading-journal
cd /var/www/trading-journal

# Cloner le projet (ou transférer les fichiers)
git clone [URL_DU_REPO] .
```

### Étape 4 : Configurer l'environnement

1. Créez le fichier `.env` :
```bash
nano .env
```

2. Collez vos paramètres secrets (copiez depuis votre fichier local)

3. Appuyez sur `Ctrl + X`, puis `Y`, puis `Entrée` pour sauvegarder

### Étape 5 : Installer et construire

```bash
npm install
npm run build
```

### Étape 6 : Lancer avec PM2

```bash
pm2 start npm --name "trading-journal" -- start
pm2 save
pm2 startup
```

Le site tourne maintenant en permanence sur le port 3000 !

### Étape 7 : Configurer Nginx (accès depuis Internet)

```bash
sudo nano /etc/nginx/sites-available/trading-journal
```

Collez cette configuration (remplacez `votre-domaine.com`) :

```nginx
server {
    listen 80;
    server_name votre-domaine.com www.votre-domaine.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Activez la configuration :

```bash
sudo ln -s /etc/nginx/sites-available/trading-journal /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Étape 8 : Ajouter le HTTPS (certificat SSL)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d votre-domaine.com -d www.votre-domaine.com
```

Suivez les instructions à l'écran.

---

## 🔐 3. Gérer les paramètres secrets

### Où sont les secrets ?

Tous les paramètres sensibles sont dans le fichier `.env` à la racine du projet.

### Liste des paramètres

| Paramètre | Où le trouver | À quoi ça sert |
|-----------|---------------|----------------|
| `DATABASE_URL` | Supabase > Settings > Database | Connexion à la base de données |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase > Settings > API | URL de votre projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase > Settings > API | Clé publique Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase > Settings > API | Clé secrète (admin) |
| `STRIPE_SECRET_KEY` | Stripe Dashboard > Developers > API keys | Paiements |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard > Webhooks | Notifications de paiement |
| `OPENAI_API_KEY` | OpenAI Platform > API Keys | Transcription vocale |

### Comment modifier un paramètre ?

1. Connectez-vous au serveur
2. Allez dans le dossier du projet : `cd /var/www/trading-journal`
3. Éditez le fichier : `nano .env`
4. Modifiez la valeur souhaitée
5. Sauvegardez : `Ctrl + X`, puis `Y`, puis `Entrée`
6. Redémarrez le site : `pm2 restart trading-journal`

---

## 🔧 4. Maintenance quotidienne

### Vérifier que le site fonctionne

```bash
pm2 status
```

Vous devriez voir `trading-journal` avec le statut `online`.

### Voir les logs (journaux)

```bash
# Logs en temps réel
pm2 logs trading-journal

# Dernières 100 lignes
pm2 logs trading-journal --lines 100
```

Appuyez sur `Ctrl + C` pour sortir.

### Redémarrer le site

```bash
pm2 restart trading-journal
```

### Mettre à jour le site

Quand une nouvelle version est disponible :

```bash
cd /var/www/trading-journal
git pull origin main
npm install
npm run build
pm2 restart trading-journal
```

### Sauvegarder la base de données

Les sauvegardes sont gérées automatiquement par Supabase. Vous pouvez aussi :

1. Aller sur votre dashboard Supabase
2. Cliquer sur "Database" > "Backups"
3. Télécharger une sauvegarde manuelle

---

## 🚨 5. Que faire si ça plante ?

### Le site ne s'affiche plus

**Vérification 1 : Le site tourne-t-il ?**
```bash
pm2 status
```

Si le statut est `stopped` ou `errored` :
```bash
pm2 restart trading-journal
```

**Vérification 2 : Regarder les erreurs**
```bash
pm2 logs trading-journal --err --lines 50
```

**Vérification 3 : Nginx fonctionne-t-il ?**
```bash
sudo systemctl status nginx
```

Si Nginx est arrêté :
```bash
sudo systemctl start nginx
```

---

### Erreur "Cannot connect to database"

1. Vérifiez que votre `DATABASE_URL` dans `.env` est correct
2. Allez sur Supabase et vérifiez que votre projet est actif
3. Si le projet a été mis en pause (inactivité), réactivez-le

---

### Erreur "Out of memory"

Le serveur n'a plus assez de mémoire :

```bash
# Voir l'utilisation mémoire
free -h

# Redémarrer le site pour libérer la mémoire
pm2 restart trading-journal
```

Si le problème persiste, envisagez de passer à un serveur plus puissant.

---

### Le site est très lent

```bash
# Vérifier l'utilisation des ressources
htop
```

Solutions possibles :
1. Redémarrer le site : `pm2 restart trading-journal`
2. Nettoyer le cache : `pm2 flush`
3. Redémarrer le serveur : `sudo reboot` (⚠️ déconnecte tout le monde)

---

### Les paiements ne fonctionnent plus

1. Vérifiez votre clé Stripe dans `.env`
2. Assurez-vous que le webhook est configuré sur Stripe :
   - URL : `https://votre-domaine.com/api/stripe/webhook`
   - Events : `checkout.session.completed`, `customer.subscription.*`
3. Testez avec une carte de test Stripe

---

### Je veux tout recommencer à zéro

⚠️ **Attention : Cela supprime TOUTES les données !**

```bash
cd /var/www/trading-journal
rm -rf node_modules .next
npm install
npx prisma db push --force-reset
npm run build
pm2 restart trading-journal
```

---

## 📖 6. Glossaire des termes

| Terme | Explication simple |
|-------|---------------------|
| **Terminal** | Une application où vous tapez des commandes textuelles |
| **npm** | Un outil pour installer les pièces du puzzle (librairies) |
| **Node.js** | Le moteur qui fait tourner le site |
| **PM2** | Un gardien qui maintient le site en ligne 24h/24 |
| **Nginx** | Un policier qui dirige le trafic vers votre site |
| **Base de données** | L'endroit où sont stockées toutes les informations |
| **SSL/HTTPS** | Le cadenas vert qui sécurise les connexions |
| **Supabase** | Le service qui héberge votre base de données |
| **Stripe** | Le service qui gère les paiements |
| **.env** | Le fichier qui contient tous les mots de passe |
| **Build** | Préparer le site pour qu'il soit rapide en production |

---

## 📞 Support

Si vous êtes bloqué après avoir suivi ce guide :

1. Notez le message d'erreur exact
2. Notez les étapes que vous avez faites
3. Contactez le développeur avec ces informations

---

*Document créé par Quinn - Test Architect & Quality Advisor*  
*Version 1.0 - Janvier 2026*
