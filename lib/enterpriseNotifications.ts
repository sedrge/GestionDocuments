import { supabase } from "./supabase";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: "default" | null;
  priority?: "default" | "normal" | "high";
}

async function sendExpoPush(messages: ExpoPushMessage[]): Promise<void> {
  if (messages.length === 0) return;
  try {
    await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(messages),
    });
  } catch (error) {
    console.error("[Push] sendExpoPush error:", error);
  }
}

// Notifie tous les super admins qu'une nouvelle entreprise vient de s'inscrire
export async function notifySuperAdminNewEnterprise(
  enterpriseName: string,
  enterpriseCode: string,
): Promise<void> {
  try {
    const { data: tokens } = await supabase.rpc("get_super_admin_push_tokens");
    if (!tokens || tokens.length === 0) return;

    await sendExpoPush(
      tokens.map((t: { expo_token: string }) => ({
        to: t.expo_token,
        title: "🏢 Nouvelle Entreprise",
        body: `"${enterpriseName}" (${enterpriseCode}) attend votre activation.`,
        data: { type: "enterprise_created", code: enterpriseCode },
        sound: "default" as const,
        priority: "high" as const,
      })),
    );
  } catch (error) {
    console.error("[Push] notifySuperAdminNewEnterprise:", error);
  }
}

// Notifie l'admin d'une entreprise que son entreprise a été activée
export async function notifyEnterpriseAdminActivated(
  enterpriseId: string,
  enterpriseName: string,
): Promise<void> {
  try {
    const { data: tokens } = await supabase.rpc(
      "get_enterprise_admin_push_tokens",
      { p_enterprise_id: enterpriseId },
    );
    if (!tokens || tokens.length === 0) return;

    await sendExpoPush(
      tokens.map((t: { expo_token: string }) => ({
        to: t.expo_token,
        title: "✅ Entreprise Activée",
        body: `"${enterpriseName}" est maintenant active. Connectez-vous !`,
        data: { type: "enterprise_activated", enterprise_id: enterpriseId },
        sound: "default" as const,
        priority: "high" as const,
      })),
    );
  } catch (error) {
    console.error("[Push] notifyEnterpriseAdminActivated:", error);
  }
}

// Notifie l'admin d'une entreprise que son entreprise a été désactivée
export async function notifyEnterpriseAdminDeactivated(
  enterpriseId: string,
  enterpriseName: string,
): Promise<void> {
  try {
    const { data: tokens } = await supabase.rpc(
      "get_enterprise_admin_push_tokens",
      { p_enterprise_id: enterpriseId },
    );
    if (!tokens || tokens.length === 0) return;

    await sendExpoPush(
      tokens.map((t: { expo_token: string }) => ({
        to: t.expo_token,
        title: "⚠️ Entreprise Désactivée",
        body: `"${enterpriseName}" a été désactivée. Contactez l'administrateur.`,
        data: { type: "enterprise_deactivated", enterprise_id: enterpriseId },
        sound: "default" as const,
        priority: "high" as const,
      })),
    );
  } catch (error) {
    console.error("[Push] notifyEnterpriseAdminDeactivated:", error);
  }
}

// Notifie les admins d'un chat d'un nouveau message client
// À appeler depuis l'app cliente après envoi de message
export async function notifyAdminNewChatMessage(
  chatId: string,
  clientName: string,
  message: string,
): Promise<void> {
  try {
    const { data: tokens } = await supabase.rpc("get_chat_push_tokens", {
      p_chat_id: chatId,
    });
    if (!tokens || tokens.length === 0) return;

    const preview = message.startsWith("📸 ")
      ? "📸 Photo"
      : message.length > 80
        ? message.slice(0, 80) + "…"
        : message;

    await sendExpoPush(
      tokens.map((t: { expo_token: string }) => ({
        to: t.expo_token,
        title: `💬 ${clientName}`,
        body: preview,
        data: { type: "chat_message", chat_id: chatId },
        sound: "default" as const,
        priority: "high" as const,
      })),
    );
  } catch (error) {
    console.error("[Push] notifyAdminNewChatMessage:", error);
  }
}

// Notifie le client qu'un admin a répondu (si le client a enregistré son token Expo)
export async function notifyChatClientReply(
  chatId: string,
  enterpriseName: string,
  message: string,
): Promise<void> {
  try {
    const { data: token } = await supabase.rpc("get_chat_client_expo_token", {
      p_chat_id: chatId,
    });
    if (!token) return;

    const preview = message.startsWith("📸 ")
      ? "📸 Photo"
      : message.length > 80
        ? message.slice(0, 80) + "…"
        : message;

    await sendExpoPush([
      {
        to: token,
        title: `💬 ${enterpriseName}`,
        body: preview,
        data: { type: "chat_reply", chat_id: chatId },
        sound: "default",
        priority: "high",
      },
    ]);
  } catch (error) {
    console.error("[Push] notifyChatClientReply:", error);
  }
}
