import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useTenant } from '../context/TenantContext';

const theme = {
  bg: '#121212',
  card: '#1E1E1E',
  text: '#FFFFFF',
  subText: '#A1A1A1',
  primary: '#0A84FF',
  border: '#38383A',
};

function getPendingInfo(pendingState: string | null, enterpriseName?: string) {
  switch (pendingState) {
    case 'enterprise_pending':
      return {
        icon: '⏳',
        title: 'Entreprise en attente d\'activation',
        message: `Votre entreprise "${enterpriseName || 'votre boutique'}" a été créée avec succès.\n\nElle sera fonctionnelle après activation par le concepteur de la plateforme.\n\nVous pouvez déjà partager votre code entreprise avec vos employés.`,
      };
    case 'user_pending':
      return {
        icon: '👤',
        title: 'Compte en attente d\'approbation',
        message: `Votre compte a bien été créé et est en attente d\'approbation par l\'administrateur de l\'entreprise "${enterpriseName}".\n\nVeuillez contacter votre administrateur pour accélérer la validation.`,
      };
    case 'no_enterprise':
      return {
        icon: '🏢',
        title: 'Aucune entreprise assignée',
        message: 'Votre compte n\'est pas encore rattaché à une entreprise.\n\nRejoignez une entreprise avec un code, ou contactez votre administrateur.',
      };
    default:
      return {
        icon: '⏳',
        title: 'Accès en cours de validation',
        message: 'Votre accès est en cours de validation. Veuillez patienter.',
      };
  }
}

export default function PendingScreen() {
  const { tenant, pendingState, refreshTenant } = useTenant();
  const info = getPendingInfo(pendingState, tenant?.enterprise_name);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    await SecureStore.deleteItemAsync('LAST_USER_ID');
    router.replace('/onboarding');
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.icon}>{info.icon}</Text>
      <Text style={[styles.title, { color: theme.text }]}>{info.title}</Text>

      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.message, { color: theme.text }]}>{info.message}</Text>

        {tenant?.enterprise_code ? (
          <View style={[styles.codeBox, { backgroundColor: theme.bg, borderColor: theme.border }]}>
            <Text style={[styles.codeLabel, { color: theme.subText }]}>Code entreprise</Text>
            <Text style={[styles.code, { color: theme.primary }]}>{tenant.enterprise_code}</Text>
          </View>
        ) : null}
      </View>

      <TouchableOpacity
        style={[styles.refreshBtn, { borderColor: theme.primary }]}
        onPress={refreshTenant}
      >
        <Text style={[styles.refreshText, { color: theme.primary }]}>🔄 Vérifier le statut</Text>
      </TouchableOpacity>

      {pendingState === 'enterprise_pending' && (
        <TouchableOpacity
          style={[styles.joinBtn, { backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: theme.primary }]}
          onPress={() => router.push('/contact')}
        >
          <Text style={[styles.joinBtnText, { color: theme.primary }]}>📞 Contacter le concepteur</Text>
        </TouchableOpacity>
      )}

      {pendingState === 'no_enterprise' && (
        <TouchableOpacity
          style={[styles.joinBtn, { backgroundColor: theme.primary }]}
          onPress={() => router.push('/onboarding/join-enterprise')}
        >
          <Text style={styles.joinBtnText}>Rejoindre une entreprise</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Se déconnecter</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, alignItems: 'center', paddingTop: 80 },
  icon: { fontSize: 80, marginBottom: 24 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 24, textAlign: 'center' },
  card: {
    width: '100%', borderRadius: 16, padding: 20,
    borderWidth: 1, marginBottom: 24,
  },
  message: { fontSize: 15, lineHeight: 24, textAlign: 'center' },
  codeBox: {
    borderRadius: 10, padding: 14, borderWidth: 1,
    marginTop: 20, alignItems: 'center',
  },
  codeLabel: { fontSize: 12, marginBottom: 6 },
  code: { fontSize: 22, fontWeight: 'bold', letterSpacing: 3 },
  refreshBtn: {
    borderWidth: 1.5, borderRadius: 12,
    paddingVertical: 13, paddingHorizontal: 28, marginBottom: 14,
  },
  refreshText: { fontSize: 15, fontWeight: '600' },
  joinBtn: {
    width: '100%', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginBottom: 14,
  },
  joinBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  signOutBtn: { paddingVertical: 12 },
  signOutText: { color: '#FF3B30', fontSize: 15, fontWeight: '600' },
});
