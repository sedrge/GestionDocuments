import { useEffect } from 'react';
import { registerForPushNotifications, setupNotificationListeners } from './firebase';
import { supabase } from './supabase';

/**
 * Hook pour initialiser les push notifications
 * À utiliser dans votre layout ou votre écran principal
 */
export function usePushNotifications() {
  useEffect(() => {
    const initPushNotifications = async () => {
      try {
        // Récupérer l'utilisateur courant
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
          console.warn('Utilisateur non authentifié');
          return;
        }

        // Enregistrer le token push
        const token = await registerForPushNotifications(user.id);
        if (token) {
          console.log('✅ Token push enregistré avec succès');
        } else {
          console.warn('⚠️ Impossible d\'enregistrer le token');
        }

        // Configurer les listeners
        setupNotificationListeners();
      } catch (error) {
        console.error('Erreur lors de l\'initialisation des notifications:', error);
      }
    };

    initPushNotifications();
  }, []);
}

/**
 * Hook pour nettoyer les notifications quand l'utilisateur se déconnecte
 */
export function useCleanupOnLogout() {
  useEffect(() => {
    const subscription = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        console.log('Utilisateur déconnecté - nettoyage des tokens');
        // Vous pouvez ajouter d'autres actions de nettoyage ici
      }
    });

    return () => subscription.data.subscription?.unsubscribe();
  }, []);
}
