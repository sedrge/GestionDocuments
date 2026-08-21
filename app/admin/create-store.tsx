// app/admin/create-store.tsx
//
// Création d'un magasin (entreprise enfant) par l'admin de l'entreprise
// parente. Formulaire volontairement plus simple que
// onboarding/create-enterprise.tsx : aucun champ "administrateur", car le
// responsable du magasin est désigné séparément, en l'invitant sur le magasin
// avec le rôle "admin". Le magasin est actif immédiatement (l'entreprise
// parente est déjà validée par le super-admin).

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTenant } from '../../context/TenantContext';
import { useTheme } from '../../context/ThemeContext';
import { createStore } from '../../lib/enterpriseStores';

export default function CreateStoreScreen() {
  // L'entreprise parente est celle du tenant courant ; le paramètre de route
  // permet à un autre point d'entrée (super-admin) de la préciser.
  const { enterpriseId: enterpriseIdParam } = useLocalSearchParams<{
    enterpriseId?: string;
  }>();
  const { tenant, isEnterpriseAdmin, refreshTenant } = useTenant();
  const { theme } = useTheme();

  const parentEnterpriseId = enterpriseIdParam || tenant?.enterprise_id || '';
  const canCreate =
    !!parentEnterpriseId && (isEnterpriseAdmin || !!enterpriseIdParam);

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    code: '',
    phone: '',
    email: '',
  });

  const setField = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (!parentEnterpriseId) {
      return Alert.alert('Erreur', 'Entreprise parente introuvable.');
    }
    if (!form.name.trim()) {
      return Alert.alert('Nom requis', 'Indiquez le nom du magasin.');
    }
    if (!form.code.trim()) {
      return Alert.alert(
        'Code requis',
        'Indiquez un code unique pour ce magasin (il servira à vos employés pour le rejoindre).',
      );
    }
    if (form.email.trim() !== '' && !form.email.includes('@')) {
      return Alert.alert('Email invalide', "Indiquez un email valide ou laissez le champ vide.");
    }

    setLoading(true);
    const result = await createStore(parentEnterpriseId, {
      name: form.name.trim(),
      code: form.code.trim(),
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
    });
    setLoading(false);

    if (!result.success) {
      return Alert.alert('Erreur', result.error ?? 'Impossible de créer le magasin.');
    }

    // Recharge /auth/me pour que le magasin apparaisse tout de suite dans la
    // liste des entreprises accessibles (et donc dans "Mes magasins").
    await refreshTenant();

    Alert.alert(
      'Magasin créé',
      `"${form.name.trim()}" est actif immédiatement. Invitez son responsable depuis l'écran Équipe du magasin.`,
      [{ text: 'OK', onPress: () => router.back() }],
    );
  };

  if (!canCreate) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
        <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 14 }}>
            <Ionicons name="arrow-back" size={24} color={theme.primary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Nouveau magasin</Text>
        </View>
        <View style={styles.centered}>
          <Ionicons name="lock-closed" size={48} color={theme.subText} />
          <Text style={{ color: theme.text, marginTop: 12, fontWeight: '700' }}>Accès réservé</Text>
          <Text style={{ color: theme.subText, marginTop: 6, textAlign: 'center', paddingHorizontal: 30 }}>
            Seul l&apos;administrateur de l&apos;entreprise peut créer un magasin.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* ── Header ── */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 14 }}>
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Nouveau magasin</Text>
          <Text style={[styles.headerSub, { color: theme.subText }]} numberOfLines={1}>
            {tenant?.enterprise_name || 'Mon entreprise'}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.cardHeader, { backgroundColor: theme.nav, borderBottomColor: theme.border }]}>
              <Ionicons name="storefront-outline" size={18} color={theme.primary} />
              <Text style={[styles.cardTitle, { color: theme.text }]}>Informations du magasin</Text>
            </View>

            <View style={{ padding: 16 }}>
              <Text style={[styles.label, { color: theme.text }]}>Nom du magasin</Text>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
                placeholder="Ex : Boutique Cotonou"
                placeholderTextColor={theme.subText}
                value={form.name}
                onChangeText={(t) => setField('name', t)}
              />

              <Text style={[styles.label, { color: theme.text }]}>Code du magasin</Text>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
                placeholder="Ex : COTONOU01"
                placeholderTextColor={theme.subText}
                autoCapitalize="characters"
                autoCorrect={false}
                value={form.code}
                onChangeText={(t) => setField('code', t)}
              />
              <Text style={[styles.hint, { color: theme.subText }]}>
                Unique pour toutes les entreprises. Vos employés l&apos;utiliseront pour
                rejoindre ce magasin.
              </Text>

              <Text style={[styles.label, { color: theme.text }]}>Téléphone (optionnel)</Text>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
                placeholder="+229 01 23 45 67"
                placeholderTextColor={theme.subText}
                keyboardType="phone-pad"
                value={form.phone}
                onChangeText={(t) => setField('phone', t)}
              />

              <Text style={[styles.label, { color: theme.text }]}>Email (optionnel)</Text>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
                placeholder="contact@monmagasin.com"
                placeholderTextColor={theme.subText}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={form.email}
                onChangeText={(t) => setField('email', t)}
              />
            </View>
          </View>

          <View style={[styles.infoBox, { backgroundColor: theme.primary + '14', borderColor: theme.primary + '33' }]}>
            <Ionicons name="information-circle-outline" size={16} color={theme.primary} />
            <Text style={[styles.infoText, { color: theme.subText }]}>
              Le magasin sera actif immédiatement. L&apos;abonnement et les
              fonctionnalités restent ceux de l&apos;entreprise parente. Pour désigner
              son responsable, invitez-le sur le magasin avec le rôle administrateur.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: theme.primary, opacity: loading ? 0.7 : 1 }]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={20} color="#fff" />
                <Text style={styles.submitBtnText}>Créer le magasin</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  card: {
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700' },

  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    marginBottom: 14,
  },
  hint: { fontSize: 11, marginTop: -10, marginBottom: 14, lineHeight: 16 },

  infoBox: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    marginBottom: 16,
  },
  infoText: { flex: 1, fontSize: 12, lineHeight: 17 },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 15,
    gap: 10,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
