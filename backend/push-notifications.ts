// backend/push-notifications.ts
// Utiliser Expo Push Service pour envoyer les notifications via les tokens Expo

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface PushMessage {
  to: string; // Token Expo
  sound?: string;
  title?: string;
  body?: string;
  data?: Record<string, string>;
  badge?: number;
  priority?: "default" | "normal" | "high";
}

/**
 * Envoie une notification via Expo Push Service
 */
export async function sendExpoPushNotification(
  expoToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<any> {
  const message: PushMessage = {
    to: expoToken,
    title,
    body,
    sound: "default",
    data,
    priority: "high",
  };

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    console.log("Push envoyé:", result);
    return result;
  } catch (error) {
    console.error("Erreur Expo Push:", error);
    throw error;
  }
}

/**
 * Envoie une notification à un utilisateur depuis la base de données
 */
export async function sendNotificationToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
) {
  // À intégrer avec votre DB (Supabase)
  // const { data: tokens } = await supabase
  //   .from("user_push_tokens")
  //   .select("expo_token")
  //   .eq("user_id", userId);

  // if (!tokens || tokens.length === 0) {
  //   console.warn(`Aucun token trouvé pour ${userId}`);
  //   return;
  // }

  // const promises = tokens.map((t) =>
  //   sendExpoPushNotification(t.expo_token, title, body, data)
  // );

  // return Promise.all(promises);
}
