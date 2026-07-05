import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTenant } from '../../context/TenantContext';
import { useTheme } from '../../context/ThemeContext';
import {
  ALL_FEATURE_KEYS,
  FEATURE_SECTIONS,
  FeatureSection,
  QUOTA_FEATURE_KEYS,
  disableAllFeatures,
  enableAllFeatures,
  getEnterpriseFeatures,
  getEnterpriseQuotas,
  getEnterpriseUsageToday,
  setEnterpriseFeatures,
  setEnterpriseQuota,
} from '../../lib/enterpriseFeatures';

export default function EnterpriseFeaturesScreen() {
  const { enterpriseId, enterpriseName } = useLocalSearchParams<{
    enterpriseId: string;
    enterpriseName: string;
  }>();
  const { isSuperAdmin } = useTenant();
  const { theme: rawTheme } = useTheme();
  const theme = {
    ...rawTheme,
    success: '#34C759',
    danger: '#FF3B30',
    warning: '#FF9F0A',
  };

  const [features, setFeatures] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ALL_FEATURE_KEYS.map((k) => [k, true])),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasConfig, setHasConfig] = useState(false);
  // Valeurs texte des inputs de quota (clé -> string). Vide = illimité.
  const [quotaInputs, setQuotaInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(QUOTA_FEATURE_KEYS.map((k) => [k, ''])),
  );
  const [usageToday, setUsageToday] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!enterpriseId || !isSuperAdmin) return;
    loadFeatures();
  }, [enterpriseId]);

  const loadFeatures = async () => {
    setLoading(true);
    const result = await getEnterpriseFeatures(enterpriseId);
    if (result.success) {
      if (result.features === null) {
        // Pas de config = tout activé
        setHasConfig(false);
        setFeatures(Object.fromEntries(ALL_FEATURE_KEYS.map((k) => [k, true])));
      } else {
        setHasConfig(true);
        // Compléter les clés manquantes avec false
        const base = Object.fromEntries(ALL_FEATURE_KEYS.map((k) => [k, false]));
        Object.assign(base, result.features);
        setFeatures(base);
      }
    } else {
      Alert.alert('Erreur', result.error);
    }

    const quotaResult = await getEnterpriseQuotas(enterpriseId);
    const inputs: Record<string, string> = {};
    QUOTA_FEATURE_KEYS.forEach((key) => {
      const limit = quotaResult.quotas[key];
      inputs[key] = limit == null ? '' : String(limit);
    });
    setQuotaInputs(inputs);

    const usageResult = await getEnterpriseUsageToday(enterpriseId);
    setUsageToday(usageResult.usage);

    setLoading(false);
  };

  const toggleKey = (key: string) => {
    setFeatures((prev) => ({ ...prev, [key]: !prev[key] }));
    if (!hasConfig) setHasConfig(true);
  };

  const toggleSection = (section: FeatureSection) => {
    const allOn = section.items.every((i) => features[i.key]);
    const updated = { ...features };
    section.items.forEach((i) => {
      updated[i.key] = !allOn;
    });
    setFeatures(updated);
    if (!hasConfig) setHasConfig(true);
  };

  const handleSave = async () => {
    if (!enterpriseId) return;

    // Valider les quotas : vide = illimité, sinon entier positif
    const parsedQuotas: Record<string, number | null> = {};
    for (const key of QUOTA_FEATURE_KEYS) {
      const raw = (quotaInputs[key] ?? '').trim();
      if (raw === '') {
        parsedQuotas[key] = null;
        continue;
      }
      const n = parseInt(raw, 10);
      if (!Number.isFinite(n) || n <= 0) {
        return Alert.alert(
          'Quota invalide',
          "Indiquez un nombre entier positif pour la limite quotidienne, ou laissez le champ vide pour illimité.",
        );
      }
      parsedQuotas[key] = n;
    }

    setSaving(true);
    const result = await setEnterpriseFeatures(enterpriseId, features);
    if (result.error) {
      setSaving(false);
      return Alert.alert('Erreur', result.error);
    }

    for (const key of QUOTA_FEATURE_KEYS) {
      const quotaResult = await setEnterpriseQuota(enterpriseId, key, parsedQuotas[key]);
      if (quotaResult.error) {
        setSaving(false);
        return Alert.alert('Erreur', quotaResult.error);
      }
    }

    setSaving(false);
    Alert.alert('Succès', 'Fonctionnalités mises à jour.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  const handleEnableAll = () => {
    Alert.alert(
      'Tout activer',
      `Activer toutes les fonctionnalités pour ${enterpriseName} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Tout activer',
          onPress: async () => {
            setSaving(true);
            const result = await enableAllFeatures(enterpriseId);
            setSaving(false);
            if (result.success) {
              setFeatures(Object.fromEntries(ALL_FEATURE_KEYS.map((k) => [k, true])));
              setHasConfig(true);
            } else {
              Alert.alert('Erreur', result.error);
            }
          },
        },
      ],
    );
  };

  const handleDisableAll = () => {
    Alert.alert(
      'Tout désactiver',
      `Désactiver toutes les fonctionnalités pour ${enterpriseName} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Tout désactiver',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            const result = await disableAllFeatures(enterpriseId);
            setSaving(false);
            if (result.success) {
              setFeatures(Object.fromEntries(ALL_FEATURE_KEYS.map((k) => [k, false])));
              setHasConfig(true);
            } else {
              Alert.alert('Erreur', result.error);
            }
          },
        },
      ],
    );
  };

  if (!isSuperAdmin) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.bg }]}>
        <Ionicons name="lock-closed" size={48} color={theme.subText} />
        <Text style={{ color: theme.subText, marginTop: 12 }}>Accès refusé</Text>
      </View>
    );
  }

  const enabledCount = Object.values(features).filter(Boolean).length;
  const totalCount = ALL_FEATURE_KEYS.length;
  const progressPct = Math.round((enabledCount / totalCount) * 100);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* ── Header ── */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginRight: 14 }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Fonctionnalités</Text>
          <Text style={[styles.headerSub, { color: theme.subText }]} numberOfLines={1}>
            {enterpriseName || 'Entreprise'}
          </Text>
        </View>
        {/* Boutons rapides */}
        <TouchableOpacity
          onPress={handleEnableAll}
          style={[styles.quickBtn, { backgroundColor: theme.success + '22' }]}
        >
          <Ionicons name="checkmark-done" size={18} color={theme.success} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleDisableAll}
          style={[styles.quickBtn, { backgroundColor: theme.danger + '22', marginLeft: 6 }]}
        >
          <Ionicons name="close-circle" size={18} color={theme.danger} />
        </TouchableOpacity>
      </View>

      {/* ── Barre de progression ── */}
      <View style={[styles.progressBar, { backgroundColor: theme.primary + '1A', borderBottomColor: theme.primary + '33' }]}>
        <Ionicons name="flash-outline" size={15} color={theme.primary} />
        <Text style={[styles.progressText, { color: theme.primary }]}>
          {hasConfig
            ? `${enabledCount}/${totalCount} fonctionnalités activées (${progressPct}%)`
            : 'Aucune restriction · tout est activé par défaut'}
        </Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 110 }}>
            {FEATURE_SECTIONS.map((section) => {
              const allOn = section.items.every((i) => features[i.key]);
              const enabledInSection = section.items.filter(
                (i) => features[i.key],
              ).length;

              return (
                <View key={section.id} style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  {/* En-tête de section */}
                  <TouchableOpacity
                    style={[styles.sectionHeader, { backgroundColor: theme.nav, borderBottomColor: theme.border }]}
                    onPress={() => toggleSection(section)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={section.icon as any}
                      size={18}
                      color={theme.primary}
                    />
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>{section.label}</Text>
                    <View style={[styles.badge, { backgroundColor: theme.border }]}>
                      <Text style={[styles.badgeText, { color: theme.subText }]}>
                        {enabledInSection}/{section.items.length}
                      </Text>
                    </View>
                    <Switch
                      value={allOn}
                      onValueChange={() => toggleSection(section)}
                      trackColor={{ false: '#38383A', true: theme.success + '66' }}
                      thumbColor={allOn ? theme.success : '#555'}
                    />
                  </TouchableOpacity>

                  {/* Items */}
                  {section.items.map((item, idx) => {
                    const isLast = idx === section.items.length - 1;
                    const showQuota = !!item.hasQuota && features[item.key];
                    return (
                      <React.Fragment key={item.key}>
                        <View
                          style={[
                            styles.itemRow,
                            { borderBottomColor: theme.border },
                            isLast && !showQuota && { borderBottomWidth: 0 },
                          ]}
                        >
                          <Ionicons
                            name={item.icon as any}
                            size={16}
                            color={features[item.key] ? theme.primary : theme.subText}
                          />
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.itemLabel,
                                { color: features[item.key] ? theme.text : theme.subText },
                              ]}
                            >
                              {item.label}
                            </Text>
                            <Text style={[styles.itemDesc, { color: theme.subText }]}>{item.description}</Text>
                          </View>
                          <Switch
                            value={features[item.key]}
                            onValueChange={() => toggleKey(item.key)}
                            trackColor={{
                              false: '#38383A',
                              true: theme.primary + '55',
                            }}
                            thumbColor={features[item.key] ? theme.primary : '#555'}
                          />
                        </View>
                        {showQuota && (
                          <View
                            style={[
                              styles.quotaRow,
                              { backgroundColor: theme.bg, borderBottomColor: theme.border },
                              isLast && { borderBottomWidth: 0 },
                            ]}
                          >
                            <Ionicons name="speedometer-outline" size={14} color={theme.subText} />
                            <Text style={[styles.quotaLabel, { color: theme.subText }]}>
                              Limite par jour
                              {usageToday[item.key] ? `  ·  ${usageToday[item.key]} utilisé(s) aujourd'hui` : ''}
                            </Text>
                            <TextInput
                              style={[
                                styles.quotaInput,
                                { color: theme.text, borderColor: theme.border, backgroundColor: theme.card },
                              ]}
                              value={quotaInputs[item.key] ?? ''}
                              onChangeText={(t) =>
                                setQuotaInputs((prev) => ({
                                  ...prev,
                                  [item.key]: t.replace(/[^0-9]/g, ''),
                                }))
                              }
                              keyboardType="number-pad"
                              placeholder="Illimité"
                              placeholderTextColor={theme.subText}
                            />
                          </View>
                        )}
                      </React.Fragment>
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>

          {/* ── Bouton Enregistrer ── */}
          <View style={[styles.saveBar, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: theme.primary, opacity: saving ? 0.7 : 1 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={20} color="#fff" />
                  <Text style={styles.saveBtnText}>
                    Enregistrer la configuration
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
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
  quickBtn: {
    padding: 8,
    borderRadius: 8,
  },
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  progressText: { fontSize: 13, flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  sectionCard: {
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 11, fontWeight: '600' },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  itemLabel: { fontSize: 14, fontWeight: '500' },
  itemDesc: { fontSize: 11, marginTop: 2 },

  quotaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingLeft: 40,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  quotaLabel: { flex: 1, fontSize: 12 },
  quotaInput: {
    width: 90,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    textAlign: 'right',
  },

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
