import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import { useTheme } from '../../context/ThemeContext';

type SecretType = 'taps' | 'phrase';

export default function SuperAdminConfigScreen() {
  const { isSuperAdmin } = useTenant();
  const { theme, isDark } = useTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);
  const [secretType, setSecretType] = useState<SecretType>('taps');
  const [tapCount, setTapCount] = useState('11');
  const [secretPhrase, setSecretPhrase] = useState('');

  useEffect(() => {
    if (isSuperAdmin) loadConfig();
  }, [isSuperAdmin]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('super_admin_config')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();
      if (data) {
        setConfigId(data.id);
        setSecretType(data.secret_type as SecretType);
        setTapCount(String(data.tap_count ?? 11));
        setSecretPhrase(data.secret_phrase ?? '');
      }
    } catch {
      // Pas de config existante
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (secretType === 'taps') {
      const n = parseInt(tapCount, 10);
      if (isNaN(n) || n < 3 || n > 50) {
        Alert.alert('Erreur', 'Le nombre de tapotements doit être entre 3 et 50.');
        return;
      }
    } else {
      if (secretPhrase.trim().length < 4) {
        Alert.alert('Erreur', 'La phrase secrète doit faire au moins 4 caractères.');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        secret_type: secretType,
        tap_count: secretType === 'taps' ? parseInt(tapCount, 10) : null,
        secret_phrase: secretType === 'phrase' ? secretPhrase.trim() : null,
        updated_at: new Date().toISOString(),
      };

      let error;
      if (configId) {
        ({ error } = await supabase.from('super_admin_config').update(payload).eq('id', configId));
      } else {
        const { data, error: insertError } = await supabase
          .from('super_admin_config')
          .insert(payload)
          .select('id')
          .single();
        error = insertError;
        if (data) setConfigId(data.id);
      }

      if (error) Alert.alert('Erreur', error.message);
      else Alert.alert('Enregistré', "La règle d'accès secret a été mise à jour.");
    } finally {
      setSaving(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.bg }]}>
        <Ionicons name="lock-closed" size={48} color={theme.subText} />
        <Text style={{ color: theme.subText, marginTop: 12 }}>Accès refusé</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.push('/admin/super-admin-home')} style={{ marginRight: 14 }}>
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Règle d'accès secret</Text>
          <Text style={[styles.headerSub, { color: theme.subText }]}>Contrôle d'accès inscription Super Admin</Text>
        </View>
        <Ionicons name="shield-half" size={22} color="#FF9F0A" />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>

          {/* Info banner */}
          <View style={[styles.infoCard, { borderColor: "#FF9F0A55", backgroundColor: "#FF9F0A11" }]}>
            <Ionicons name="information-circle-outline" size={18} color="#FF9F0A" />
            <Text style={[styles.infoText, { color: "#FF9F0A" }]}>
              Cette règle contrôle comment accéder à la page d'inscription Super Admin depuis l'écran d'accueil.
              Changez-la régulièrement pour empêcher un accès non autorisé.
            </Text>
          </View>

          {/* Type selection */}
          <Text style={[styles.sectionLabel, { color: theme.subText }]}>Type de règle</Text>
          <View style={styles.typeRow}>
            {(['taps', 'phrase'] as SecretType[]).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typeBtn,
                  secretType === type
                    ? { backgroundColor: theme.primary, borderColor: theme.primary }
                    : { backgroundColor: theme.card, borderColor: theme.border },
                ]}
                onPress={() => setSecretType(type)}
              >
                <Ionicons
                  name={type === 'taps' ? 'finger-print-outline' : 'chatbubble-ellipses-outline'}
                  size={22}
                  color={secretType === type ? '#fff' : theme.subText}
                />
                <Text style={[styles.typeBtnLabel, { color: secretType === type ? '#fff' : theme.subText }]}>
                  {type === 'taps' ? 'Tapotements' : 'Phrase secrète'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Taps config */}
          {secretType === 'taps' && (
            <View style={[styles.configCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.configLabel, { color: theme.text }]}>Nombre de tapotements requis</Text>
              <Text style={[styles.configDesc, { color: theme.subText }]}>
                L'utilisateur devra tapoter le titre "SenMoto" ce nombre de fois d'affilée (dans les 2 secondes) pour déclencher la page d'inscription.
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.bg, color: theme.text, borderColor: theme.border }]}
                placeholder="Ex: 11"
                placeholderTextColor={theme.subText}
                keyboardType="number-pad"
                value={tapCount}
                onChangeText={setTapCount}
                maxLength={2}
              />
              <Text style={[styles.hint, { color: theme.subText }]}>Entre 3 et 50 tapotements</Text>
            </View>
          )}

          {/* Phrase config */}
          {secretType === 'phrase' && (
            <View style={[styles.configCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.configLabel, { color: theme.text }]}>Phrase secrète</Text>
              <Text style={[styles.configDesc, { color: theme.subText }]}>
                En tapant sur "SenMoto", une boîte de dialogue s'ouvrira demandant cette phrase exacte.
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.bg, color: theme.text, borderColor: theme.border }]}
                placeholder="Entrez votre phrase secrète"
                placeholderTextColor={theme.subText}
                value={secretPhrase}
                onChangeText={setSecretPhrase}
                autoCapitalize="none"
              />
              <Text style={[styles.hint, { color: theme.subText }]}>Minimum 4 caractères. Sensible à la casse.</Text>
            </View>
          )}

          {/* Preview */}
          <View style={[styles.previewCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.previewTitle, { color: theme.subText }]}>Aperçu de la règle active</Text>
            <View style={styles.previewRow}>
              <Ionicons
                name={secretType === 'taps' ? 'finger-print' : 'chatbubble-ellipses'}
                size={16}
                color={theme.primary}
              />
              <Text style={[styles.previewText, { color: theme.text }]}>
                {secretType === 'taps'
                  ? `Tapoter "${parseInt(tapCount, 10) || '?'}" fois le titre SenMoto`
                  : secretPhrase
                    ? `Entrer la phrase : "${secretPhrase}"`
                    : 'Phrase non définie'}
              </Text>
            </View>
          </View>

        </ScrollView>
      )}

      {/* Save bar */}
      {!loading && (
        <View style={[styles.saveBar, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: theme.primary, opacity: saving ? 0.7 : 1 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color="#fff" />
                <Text style={styles.saveBtnText}>Enregistrer la règle</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  headerSub: { fontSize: 11, marginTop: 1 },
  infoCard: {
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  infoText: { flex: 1, fontSize: 12, lineHeight: 18 },
  sectionLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  typeRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  typeBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  typeBtnLabel: { fontSize: 13, fontWeight: '600' },
  configCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 16,
    gap: 10,
  },
  configLabel: { fontSize: 15, fontWeight: '600' },
  configDesc: { fontSize: 12, lineHeight: 18 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
  },
  hint: { fontSize: 11 },
  previewCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 10,
  },
  previewTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewText: { fontSize: 14, fontWeight: '500' },
  saveBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 15,
    gap: 10,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
