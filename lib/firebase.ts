import Constants from "expo-constants";
import { supabase } from "./supabase";

const PROJECT_ID = "senmoto-a2f1e";
const MESSAGING_SENDER_ID = "522344635234";

export const fcmConfig = {
  projectId: PROJECT_ID,
  messagingSenderId: MESSAGING_SENDER_ID,
};

// expo-notifications ne fonctionne pas dans Expo Go depuis SDK 53.
// On charge le module dynamiquement pour éviter le crash au démarrage.
const isExpoGo = Constants.appOwnership === "expo";

let Notifications: typeof import("expo-notifications") | null = null;

if (!isExpoGo) {
  try {
    Notifications = require("expo-notifications");
  } catch (e) {
    console.warn("expo-notifications non disponible:", e);
  }
}

export async function registerForPushNotifications(
  userId: string,
): Promise<string | null> {
  if (!Notifications) {
    console.warn(
      "Push notifications non disponibles (Expo Go ou module manquant).",
    );
    return null;
  }

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.warn("Permissions de notification refusées");
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.error("Project ID manquant dans app.json");
      return null;
    }

    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    console.log("Expo Push Token:", token.data);

    await supabase.from("user_push_tokens").upsert(
      {
        user_id: userId,
        expo_token: token.data,
        created_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    return token.data;
  } catch (error) {
    console.error("Erreur lors de l'enregistrement du token:", error);
    return null;
  }
}

export function setupNotificationListeners() {
  if (!Notifications) return;

  Notifications.addNotificationResponseListener((response) => {
    console.log("Notification tappée:", response.notification.request.content);
  });
}

export async function removeDeviceToken(userId: string) {
  await supabase.from("user_push_tokens").delete().eq("user_id", userId);
}
