import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Updates from 'expo-updates';
import * as ExpoInAppUpdates from 'expo-in-app-updates';

/**
 * Deux mécanismes complémentaires, tous les deux non bloquants :
 *
 * - OTA JS (EAS Update) : bundle déjà compatible avec le binaire natif
 *   installé (même fingerprint natif) — téléchargé en tâche de fond, on
 *   affiche notre propre bannière pour laisser l'utilisateur choisir quand
 *   redémarrer.
 * - Mise à jour native flexible (Play Store) : l'utilisateur continue
 *   d'utiliser l'app pendant le téléchargement ; une fois prêt, c'est Play
 *   Core lui-même (pas nous) qui invite au redémarrage — jamais de mode
 *   "immediate" (écran bloquant), toujours flexible.
 */
export function useAppUpdates() {
  const [jsUpdateReady, setJsUpdateReady] = useState(false);

  useEffect(() => {
    if (__DEV__ || Platform.OS === 'web') return;

    (async () => {
      try {
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) {
          await Updates.fetchUpdateAsync();
          setJsUpdateReady(true);
        }
      } catch {
        // Pas de réseau / service EAS Update injoignable : silencieux, l'app
        // continue de fonctionner sur le bundle déjà installé.
      }
    })();

    if (Platform.OS === 'android') {
      (async () => {
        try {
          const { updateAvailable, flexibleAllowed } = await ExpoInAppUpdates.checkForUpdate();
          if (updateAvailable && flexibleAllowed !== false) {
            await ExpoInAppUpdates.startUpdate(false);
          }
        } catch {
          // Play Store/Play Services indisponible (build de test, émulateur
          // sans Play Store, etc.) : pas grave, on ignore.
        }
      })();
    }
  }, []);

  return {
    jsUpdateReady,
    applyJsUpdate: () => Updates.reloadAsync(),
  };
}
