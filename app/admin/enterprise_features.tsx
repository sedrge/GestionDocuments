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
  disableAllFeatures,
  enableAllFeatures,
  getEnterpriseFeatures,
  setEnterpriseFeatures,
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
    setSaving(true);
    const result = await setEnterpriseFeatures(enterpriseId, features);
    setSaving(false);
    if (result.error) {
      Alert.alert('Erreur', result.error);
    } else {
      Alert.alert('Succès', 'Fonctionnalités mises à jour.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    }
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
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginRight: 14 }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Fonctionnalités</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
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
      <View style={styles.progressBar}>
        <Ionicons name="flash-outline" size={15} color={theme.primary} />
        <Text style={styles.progressText}>
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
                <View key={section.id} style={styles.sectionCard}>
                  {/* En-tête de section */}
                  <TouchableOpacity
                    style={styles.sectionHeader}
                    onPress={() => toggleSection(section)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={section.icon as any}
                      size={18}
                      color={theme.primary}
                    />
                    <Text style={styles.sectionTitle}>{section.label}</Text>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
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
                  {section.items.map((item, idx) => (
                    <View
                      key={item.key}
                      style={[
                        styles.itemRow,
                        idx === section.items.length - 1 && {
                          borderBottomWidth: 0,
                        },
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
                            !features[item.key] && { color: theme.subText },
                          ]}
                        >
                          {item.label}
                        </Text>
                        <Text style={styles.itemDesc}>{item.description}</Text>
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
                  ))}
                </View>
              );
            })}
          </ScrollView>

          {/* ── Bouton Enregistrer ── */}
          <View style={styles.saveBar}>
            <TouchableOpacity
              style={[styles.saveBtn, { opacity: saving ? 0.7 : 1 }]}
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
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#38383A',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  headerSub: { fontSize: 12, color: '#A1A1A1', marginTop: 1 },
  quickBtn: {
    padding: 8,
    borderRadius: 8,
  },
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A2A3A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#0A84FF33',
  },
  progressText: { fontSize: 13, color: '#0A84FF', flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  sectionCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#38383A',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#38383A',
    gap: 10,
    backgroundColor: '#252525',
  },
  sectionTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  badge: {
    backgroundColor: '#38383A',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#A1A1A1' },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2C2C2E',
    gap: 12,
  },
  itemLabel: { fontSize: 14, color: '#FFFFFF', fontWeight: '500' },
  itemDesc: { fontSize: 11, color: '#6E6E73', marginTop: 2 },

  saveBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#1E1E1E',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#38383A',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A84FF',
    borderRadius: 14,
    paddingVertical: 15,
    gap: 10,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
