# 🔐 Guide : Configuration Google OAuth pour Supabase

> **Epic 8.1 : Social Login** — Configuration Google Provider  
> **Status** : ✅ Guide complet  
> **Date** : 2026-01-08

---

## 📋 Prérequis

- Compte Google (Gmail ou Google Workspace)
- Accès à [Google Cloud Console](https://console.cloud.google.com/)
- Accès au [Supabase Dashboard](https://app.supabase.com/) du projet
- Informations du projet Supabase :
  - **Project ID** : `ioqqiyluatbcckuuprcc`
  - **Production Domain** : `tradingpathjournal.com`
  - **Auth Callback URL** : `https://ioqqiyluatbcckuuprcc.supabase.co/auth/v1/callback`

---

## 🚀 Étapes de Configuration dans Google Cloud Console

### Étape 1 : Créer ou sélectionner un projet Google Cloud

1. Accédez à [Google Cloud Console](https://console.cloud.google.com/)
2. **Option A** : Sélectionner un projet existant (menu déroulant en haut)
3. **Option B** : Créer un nouveau projet
   - Cliquez sur **"New Project"**
   - Nom : `Trading Path Journal` (ou votre choix)
   - Organisation : Sélectionnez ou laissez par défaut
   - Cliquez sur **"Create"**

⚠️ **Note** : Attendre 30-60 secondes que le projet soit créé avant de continuer.

---

### Étape 2 : Configurer l'écran de consentement OAuth

1. Dans le menu de navigation, allez à **"APIs & Services"** → **"OAuth consent screen"**

2. **Type d'utilisateur** :
   - ✅ **External** (pour permettre à n'importe quel utilisateur Google de se connecter)
   - Si vous avez Google Workspace : **Internal** (limité à votre organisation)

3. **Informations de l'application** :
   - **App name** : `Trading Path Journal`
   - **User support email** : Votre email
   - **App logo** : (Optionnel) Upload votre logo `cttp-logo.png`
   - **App domain** :
     - **Application home page** : `https://tradingpathjournal.com`
     - **Application privacy policy link** : `https://tradingpathjournal.com/privacy` (à créer)
     - **Application terms of service link** : `https://tradingpathjournal.com/terms` (à créer)
   - **Authorized domains** :
     - `tradingpathjournal.com`
     - `supabase.co` (pour le callback Supabase)

4. **Scopes** :
   - Par défaut, `openid`, `email`, `profile` sont automatiquement ajoutés
   - ✅ Cliquez sur **"Add or Remove Scopes"**
   - Vérifiez que ces scopes sont sélectionnés :
     - `.../auth/userinfo.email` (Voir votre adresse email)
     - `.../auth/userinfo.profile` (Voir vos informations de profil de base)
   - Cliquez sur **"Update"** puis **"Save and Continue"**

5. **Test users** (si en mode "Testing") :
   - Ajoutez votre email pour tester avant de publier
   - Cliquez sur **"Add Users"** puis **"Save and Continue"**

6. **Summary** :
   - Vérifiez toutes les informations
   - Cliquez sur **"Back to Dashboard"**

---

### Étape 3 : Créer les credentials OAuth 2.0

1. Dans le menu, allez à **"APIs & Services"** → **"Credentials"**

2. Cliquez sur **"+ Create Credentials"** → **"OAuth client ID"**

3. **Si c'est la première fois** :
   - Google vous demandera de configurer l'écran de consentement
   - Cliquez sur **"Configure Consent Screen"** et suivez l'Étape 2 ci-dessus
   - Retournez ensuite aux Credentials

4. **Application type** : Sélectionnez **"Web application"**

5. **Name** : `Trading Path Journal - Supabase OAuth`

6. **Authorized JavaScript origins** :
   ```
   https://ioqqiyluatbcckuuprcc.supabase.co
   https://tradingpathjournal.com
   http://localhost:3000
   ```

7. **Authorized redirect URIs** :
   ```
   https://ioqqiyluatbcckuuprcc.supabase.co/auth/v1/callback
   http://localhost:3000/auth/callback
   ```

   ⚠️ **CRITIQUE** : L'URL de callback Supabase DOIT être exactement :
   ```
   https://ioqqiyluatbcckuuprcc.supabase.co/auth/v1/callback
   ```
   (Pas de slash final, pas de paramètres supplémentaires)

8. Cliquez sur **"Create"**

9. **⚠️ IMPORTANT** : Google affichera une popup avec :
   - **Client ID** : `xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com`
   - **Client Secret** : `GOCSPX-xxxxxxxxxxxxxxxxxxxxx`
   
   **➡️ COPIEZ CES DEUX VALEURS IMMÉDIATEMENT** (le secret n'est affiché qu'une seule fois !)

---

### Étape 4 : Configuration dans Supabase Dashboard

1. Accédez à [Supabase Dashboard](https://app.supabase.com/)
2. Sélectionnez votre projet : `ioqqiyluatbcckuuprcc`
3. Dans le menu de gauche, allez à **"Authentication"** → **"Providers"**
4. Trouvez **"Google"** dans la liste des providers
5. Activez le toggle **"Enable Google provider"**

6. **Remplissez les champs** :
   - **Client ID (for OAuth)** : Collez le Client ID copié à l'Étape 3
   - **Client Secret (for OAuth)** : Collez le Client Secret copié à l'Étape 3

7. Cliquez sur **"Save"**

✅ **Google OAuth est maintenant configuré !**

---

## ✅ Vérification et Tests

### Test Local (Development)

1. **Décommentez le bouton Google** dans `src/components/auth/social-login-buttons.tsx` :
   ```tsx
   {/* Google - DISABLED: Provider not configured yet */}
   <Button
     variant="outline"
     type="button"
     onClick={() => signInWithProvider('google')}
     disabled={anyLoading}
     className="w-full bg-white text-black hover:bg-gray-100 border-gray-300"
   >
     {isLoading('google') ? (
       <Loader2 className="mr-2 h-4 w-4 animate-spin" />
     ) : (
       <GoogleIcon className="mr-2 h-4 w-4" />
     )}
     {t('continueWithGoogle')}
   </Button>
   ```

2. Démarrez votre serveur dev :
   ```bash
   npm run dev
   ```

3. Testez sur `http://localhost:3000/login`
   - Cliquez sur "Continue with Google"
   - Vous devriez être redirigé vers Google pour autoriser
   - Après autorisation, vous serez redirigé vers `/auth/callback`
   - Vérifiez que l'utilisateur est créé dans la table `public.users`

### Test Production

1. Déployez votre code (avec le bouton Google décommenté)
2. Testez sur `https://tradingpathjournal.com/login`
3. Vérifiez que le flow OAuth fonctionne correctement

---

## 🔧 Configuration Supabase Auth Settings (Bonus)

Pour que les redirects fonctionnent correctement, vérifiez aussi :

1. **Supabase Dashboard** → **Authentication** → **URL Configuration** :

   - **Site URL** : `https://tradingpathjournal.com`
   
   - **Additional Redirect URLs** :
     ```
     http://localhost:3000/auth/callback
     https://tradingpathjournal.com/auth/callback
     ```

2. Cliquez sur **"Save"**

---

## 🐛 Troubleshooting

### Erreur : "redirect_uri_mismatch"

**Cause** : L'URI de redirection dans Google Cloud Console ne correspond pas exactement.

**Solution** :
- Vérifiez que dans Google Cloud Console → Credentials → OAuth 2.0 Client ID, vous avez bien :
  ```
  https://ioqqiyluatbcckuuprcc.supabase.co/auth/v1/callback
  ```
- Pas de slash final, pas de paramètres
- Vérifiez que l'origin `https://ioqqiyluatbcckuuprcc.supabase.co` est dans "Authorized JavaScript origins"

### Erreur : "Access blocked: This app's request is invalid"

**Cause** : L'écran de consentement OAuth n'est pas configuré ou l'app est en mode "Testing".

**Solution** :
- Vérifiez que l'écran de consentement est complété (Étape 2)
- Si en mode "Testing", ajoutez votre email dans "Test users"
- Ou publiez l'app (soumettez pour vérification Google si nécessaire)

### Erreur : "invalid_client"

**Cause** : Client ID ou Client Secret incorrect dans Supabase.

**Solution** :
- Vérifiez que vous avez copié le bon Client ID et Secret
- Regénérez les credentials si nécessaire dans Google Cloud Console
- Mettez à jour dans Supabase Dashboard

### Utilisateur non créé dans `public.users`

**Cause** : Le callback `/auth/callback` ne crée pas l'utilisateur correctement.

**Solution** :
- Vérifiez `src/app/auth/callback/route.ts`
- Le code devrait créer l'utilisateur automatiquement via `prisma.user.create()` si non existant
- Vérifiez les logs Supabase pour les erreurs SQL

---

## 📚 Ressources

- [Supabase Auth - Google Provider](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Cloud Console](https://console.cloud.google.com/)

---

## ✅ Checklist de Configuration

- [ ] Projet Google Cloud créé/sélectionné
- [ ] Écran de consentement OAuth configuré
- [ ] OAuth 2.0 credentials créés (Client ID + Secret)
- [ ] Authorized redirect URIs configurés dans Google Cloud
- [ ] Client ID et Secret ajoutés dans Supabase Dashboard
- [ ] Google provider activé dans Supabase
- [ ] Bouton Google décommenté dans le code
- [ ] Test local réussi
- [ ] Test production réussi

---

**Dernière mise à jour** : 2026-01-08
