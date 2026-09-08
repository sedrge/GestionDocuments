import * as Updates from "expo-updates";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

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
    if (__DEV__ || Platform.OS === "web") return;

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
  }, []);

  return {
    jsUpdateReady,
    applyJsUpdate: () => Updates.reloadAsync(),
  };
}
