import { useEffect } from 'react';
import { getToken } from './api';
import { registerForPushNotifications, setupNotificationListeners } from './firebase';

/**
 * Hook pour initialiser les push notifications
 * À utiliser dans votre layout ou votre écran principal
 */
export function usePushNotifications() {
  useEffect(() => {
    const initPushNotifications = async () => {
      try {
        const token = await getToken();
        if (!token) {
          console.warn('Utilisateur non authentifié');
          return;
        }

        const expoToken = await registerForPushNotifications();
        if (expoToken) {
          console.log('✅ Token push enregistré avec succès');
        } else {
          console.warn('⚠️ Impossible d\'enregistrer le token');
        }

        setupNotificationListeners();
      } catch (error) {
        console.error('Erreur lors de l\'initialisation des notifications:', error);
      }
    };

    initPushNotifications();
  }, []);
}
