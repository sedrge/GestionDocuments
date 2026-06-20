// backend/test-push.ts
// Script de test pour les notifications push
// Utilisez-le pour vérifier que tout fonctionne

import { sendExpoPushNotification } from './push-notifications';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

/**
 * Test 1: Envoyer une notification à un token spécifique
 */
export async function testSendToToken(expoToken: string) {
  console.log('📤 Test d\'envoi à un token spécifique...');
  try {
    const result = await sendExpoPushNotification(
      expoToken,
      '🧪 Test Push Notification',
      'Ceci est un message de test depuis le backend',
      {
        action: 'test',
        timestamp: new Date().toISOString(),
      }
    );
    console.log('✅ Résultat:', result);
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

/**
 * Test 2: Envoyer une notification à un utilisateur
 */
export async function testSendToUser(userId: string) {
  console.log(`📤 Test d\'envoi à l\'utilisateur ${userId}...`);
  try {
    const { data: tokens, error } = await supabase
      .from('user_push_tokens')
      .select('expo_token')
      .eq('user_id', userId);

    if (error || !tokens || tokens.length === 0) {
      console.error('❌ Aucun token trouvé pour cet utilisateur');
      return;
    }

    console.log(`📱 Tokens trouvés: ${tokens.length}`);

    for (const token of tokens) {
      await sendExpoPushNotification(
        token.expo_token,
        '🎉 Bienvenue !',
        'Test de notification utilisateur',
        { userId }
      );
    }

    console.log('✅ Notifications envoyées');
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

/**
 * Test 3: Lister tous les tokens enregistrés
 */
export async function listAllTokens() {
  console.log('📋 Récupération de tous les tokens...');
  try {
    const { data, error } = await supabase
      .from('user_push_tokens')
      .select('user_id, expo_token, created_at');

    if (error) {
      console.error('❌ Erreur:', error);
      return;
    }

    console.log(`📊 Total: ${data?.length} tokens`);
    data?.forEach((row: any, i: number) => {
      console.log(`  ${i + 1}. ${row.user_id}: ${row.expo_token.substring(0, 30)}...`);
    });
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

/**
 * Test 4: Vérifier que l'API Expo Push répond
 */
export async function testExpoPushAPI() {
  console.log('🔌 Test de connexion à Expo Push Service...');
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: 'ExponentPushToken[invalid-test]', // Token invalide volontairement
        title: 'Test',
        body: 'Test',
      }),
    });

    const result = await response.json();
    console.log('✅ Expo Push Service répond:', response.status);
    console.log('Response:', result);
  } catch (error) {
    console.error('❌ Erreur de connexion:', error);
  }
}

/**
 * Lancer les tests
 */
async function runTests() {
  console.log('🚀 Démarrage des tests de notifications push...\n');

  // Test 1
  await testExpoPushAPI();
  console.log('\n---\n');

  // Test 2
  await listAllTokens();
  console.log('\n---\n');

  // Vous pouvez décommenter pour envoyer un test réel :
  // await testSendToUser('votre-user-id');

  console.log('\n✨ Tests terminés');
}

// Lancer si exécuté directement
if (require.main === module) {
  runTests().catch(console.error);
}

export { runTests };
