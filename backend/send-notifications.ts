// backend/api/send-notification.ts
// Exemple d'endpoint pour envoyer une notification push

import { sendExpoPushNotification } from '../push-notifications';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // Utiliser la clé service, pas la clé publique
);

/**
 * Envoie une notification à un utilisateur spécifique
 * POST /api/send-notification
 */
export async function sendNotificationToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
) {
  try {
    // Récupérer le token push de l'utilisateur
    const { data: tokens, error } = await supabase
      .from('user_push_tokens')
      .select('expo_token')
      .eq('user_id', userId);

    if (error || !tokens || tokens.length === 0) {
      console.warn(`Aucun token pour l'utilisateur ${userId}`);
      return { success: false, error: 'No token found' };
    }

    // Envoyer à tous les appareils de l'utilisateur
    const results = await Promise.all(
      tokens.map((t) =>
        sendExpoPushNotification(t.expo_token, title, body, data)
      )
    );

    return { success: true, sent: results.length };
  } catch (err) {
    console.error('Erreur lors de l\'envoi:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Envoyer une notification quand un rendez-vous est modifié
 */
export async function notifyRdvModification(
  userId: string,
  rdvTitle: string
) {
  return sendNotificationToUser(
    userId,
    '📝 Rendez-vous modifié',
    `Votre rendez-vous "${rdvTitle}" a été modifié`,
    { type: 'rdv_modification' }
  );
}

/**
 * Envoyer un rappel pour un rendez-vous
 */
export async function notifyRdvReminder(
  userId: string,
  rdvTitle: string,
  daysUntil: number
) {
  const title = daysUntil === 0
    ? '⏰ Rendez-vous aujourd\'hui !'
    : `⏰ Rendez-vous dans ${daysUntil} jour(s)`;

  return sendNotificationToUser(
    userId,
    title,
    `${rdvTitle}`,
    { type: `rdv_rappel_j${daysUntil}` }
  );
}
