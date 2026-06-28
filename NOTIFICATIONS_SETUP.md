# 📱 Configuration Complète - Push Notifications Firebase + Expo

## 🎯 Architecture

```
Client (Expo) → Token Expo Push → Supabase
                                   ↓
                           user_push_tokens table
                                   ↓
Backend → Expo Push Service → Notification affichée sur le téléphone
```

## 📋 Checklist de Configuration

### ✅ Étape 1 : Préparation Firebase & Supabase

- [x] Créer un projet Firebase (senmoto-a2f1e)
- [x] Télécharger google-services.json
- [x] Générer une clé privée (Admin SDK)
- [x] Configurer Supabase

### ✅ Étape 2 : Dépendances NPM

```bash
# Vérifier que vous avez expo-notifications
npm list expo-notifications

# Installer si manquant
npm install expo-notifications expo-constants

# Pour le backend (optionnel si vous utilisez juste Expo Push Service)
npm install firebase-admin --save-dev
```

### ✅ Étape 3 : Configuration Base de Données

1. Allez dans **Supabase Dashboard**
2. Allez dans **SQL Editor**
3. Créez une nouvelle query
4. Collez le contenu de `db_tokens_setup.sql`
5. Cliquez sur **Run**

```sql
-- Vérifier que la table est créée
SELECT * FROM user_push_tokens LIMIT 5;
```

### ✅ Étape 4 : Configuration Client (Expo)

**Fichier : `app/_layout.tsx`** ✅ Déjà modifié

Vérifiez que vous avez l'initialisation des push notifications :

```typescript
import { registerForPushNotifications, setupNotificationListeners } from '@/lib/firebase';

useEffect(() => {
  const initPushNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const token = await registerForPushNotifications(user.id);
      setupNotificationListeners();
    }
  };
  
  initPushNotifications();
}, []);
```

### ✅ Étape 5 : Vérifier le Token

1. **Lancez l'app Expo**
   ```bash
   npm start
   # Scannez le QR code avec Expo Go
   ```

2. **Connectez-vous** avec votre compte

3. **Vérifiez les logs** dans Expo :
   ```
   ✅ Token push enregistré: ExponentPushToken[xxxxxx...]
   ```

4. **Vérifiez Supabase** :
   - Allez dans `user_push_tokens`
   - Vous devez voir une ligne avec votre token

### ✅ Étape 6 : Tester une Notification

**Option A : Test via cURL**

```bash
curl -X POST https://exp.host/--/api/v2/push/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "ExponentPushToken[xxxxx...]",
    "title": "Test",
    "body": "Cela fonctionne !",
    "sound": "default"
  }'
```

**Option B : Test via Node.js**

```typescript
// Dans un fichier backend test.ts
import { sendExpoPushNotification } from './backend/push-notifications';

const token = 'ExponentPushToken[xxxxx...]'; // Récupérez depuis Supabase

await sendExpoPushNotification(
  token,
  'Test Push Notification',
  'Cela vient du backend !',
  { action: 'open_app' }
);
```

### ✅ Étape 7 : Intégrer avec Vos Rendez-vous

**Exemple : Notifier quand un RDV est modifié**

```typescript
// Dans votre route de modification de RDV
import { notifyRdvModification } from '@/backend/send-notifications';

async function updateRendezVous(rdvId: string, newData: any) {
  // ... votre logique de mise à jour
  
  // Envoyer la notification
  await notifyRdvModification(userId, 'Client: Jean Dupont');
}
```

## 🔧 Configuration Avancée

### Utiliser Firebase Cloud Messaging (FCM) au lieu d'Expo Push Service

Si vous préférez utiliser Firebase directement :

1. **Installer firebase-admin** (côté backend) :
   ```bash
   npm install firebase-admin
   ```

2. **Initialiser Firebase Admin** :
   ```typescript
   import * as admin from 'firebase-admin';
   
   admin.initializeApp({
     credential: admin.credential.cert(require('./firebase-key.json')),
   });
   
   const messaging = admin.messaging();
   ```

3. **Envoyer une notification** :
   ```typescript
   await messaging.send({
     notification: { title: 'Test', body: 'Message' },
     token: expoToken,
   });
   ```

## 📊 Structure des Fichiers

```
SenMoto/
├── app/
│   ├── _layout.tsx ✅ (modifié - initialise les push)
│   ├── notifications.tsx ✅ (centre de notifications)
│   └── ...
├── lib/
│   ├── firebase.ts ✅ (gestion du token)
│   ├── notifications.ts ✅ (notifications locales)
│   └── supabase.ts
├── backend/
│   ├── push-notifications.ts ✅ (Expo Push Service)
│   ├── send-notifications.ts ✅ (API d'envoi)
│   └── firebase-admin.ts (optionnel)
├── db_tokens_setup.sql ✅ (migration)
├── google-services.json ✅ (Firebase config)
└── senmoto-a2f1e-firebase-adminsdk-*.json ✅ (Firebase key)
```

## ⚠️ Dépannage

### "Token introuvable"
- ✅ Vérifiez que l'utilisateur est connecté
- ✅ Vérifiez que les permissions sont acceptées
- ✅ Vérifiez que le projectId dans app.json est correct

### "Notification non reçue"
- ✅ Vérifiez que l'app Expo est ouverte (ou en arrière-plan avec permissions)
- ✅ Vérifiez le token dans Supabase
- ✅ Testez via cURL d'abord

### "Erreur de permission DB"
- ✅ Vérifiez que RLS est activée sur `user_push_tokens`
- ✅ Vérifiez que les policies sont correctes

## 🚀 Prochaines Étapes

1. **Configurer les webhooks Supabase** pour envoyer automatiquement des notifications
2. **Mettre en place les rappels** J-3, J-2, J-0 pour les RDV
3. **Tracker les envois** (table `notification_logs`)
4. **Ajouter des actions** dans les notifications (deep linking)

## 📚 Ressources

- [Expo Notifications Docs](https://docs.expo.dev/push-notifications/overview/)
- [Expo Push Service API](https://docs.expo.dev/push-notifications/push-notification-setup/)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
