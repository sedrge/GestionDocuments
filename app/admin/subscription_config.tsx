// app/admin/subscription_config.tsx
//
// Configuration globale des abonnements (super-admin) :
//  - Tarifs : montants mensuel/annuel appliqués à toutes les entreprises
//    (`subscription_plan_prices`) — jamais codés en dur, éditables ici.
//  - Fonctionnalités Premium : les `feature_key` coupés automatiquement à la
//    fin du délai de grâce quand une entreprise a `auto_cutoff_enabled=true`
//    (`subscription_gated_features`). Vide = aucune coupure automatique.

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
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
import { ALL_FEATURE_KEYS, FEATURE_SECTIONS, FeatureSection } from '../../lib/enterpriseFeatures';
import {
  getSubscriptionGatedFeatures,
  getSubscriptionPlanPrices,
  setSubscriptionGatedFeatures,
  setSubscriptionPlanPrices,
} from '../../lib/enterpriseSubscription';

export default function SubscriptionConfigScreen() {
  const { isSuperAdmin } = useTenant();
  const { theme: rawTheme } = useTheme();
  const theme = {
    ...rawTheme,
    success: '#34C759',
    danger: '#FF3B30',
    warning: '#FF9F0A',
  };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [monthly, setMonthly] = useState('');
  const [annual, setAnnual] = useState('');
  const [gated, setGated] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ALL_FEATURE_KEYS.map((k) => [k, false])),
  );

  const loadConfig = async () => {
    setLoading(true);

    const priceResult = await getSubscriptionPlanPrices();
    if (priceResult.success) {
      setMonthly(priceResult.prices.monthly == null ? '' : String(priceResult.prices.monthly));
      setAnnual(priceResult.prices.annual == null ? '' : String(priceResult.prices.annual));
    } else {
      Alert.alert('Erreur', priceResult.error ?? 'Tarifs indisponibles.');
    }

    const gatedResult = await getSubscriptionGatedFeatures();
    if (gatedResult.success) {
      const base = Object.fromEntries(ALL_FEATURE_KEYS.map((k) => [k, false]));
      gatedResult.featureKeys.forEach((key) => {
        base[key] = true;
      });
      setGated(base);
    } else {
      Alert.alert('Erreur', gatedResult.error ?? 'Fonctionnalités premium indisponibles.');
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!isSuperAdmin) return;
    // Chargement initial au montage (même pattern que enterprise_features.tsx).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleKey = (key: string) => {
    setGated((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleSection = (section: FeatureSection) => {
    const allOn = section.items.every((i) => gated[i.key]);
    const updated = { ...gated };
    section.items.forEach((i) => {
      updated[i.key] = !allOn;
    });
    setGated(updated);
  };

  const handleSave = async () => {
    const parsedMonthly = monthly.trim() === '' ? 0 : Number(monthly);
    const parsedAnnual = annual.trim() === '' ? 0 : Number(annual);

    if (!Number.isFinite(parsedMonthly) || parsedMonthly < 0 || !Number.isFinite(parsedAnnual) || parsedAnnual < 0) {
      return Alert.alert('Tarif invalide', 'Indiquez des montants positifs (en XOF).');
    }

    setSaving(true);

    const priceResult = await setSubscriptionPlanPrices({
      monthly: parsedMonthly,
      annual: parsedAnnual,
    });
    if (!priceResult.success) {
      setSaving(false);
      return Alert.alert('Erreur', priceResult.error ?? 'Échec de la sauvegarde des tarifs.');
    }

    const featureKeys = ALL_FEATURE_KEYS.filter((k) => gated[k]);
    const gatedResult = await setSubscriptionGatedFeatures(featureKeys);
    setSaving(false);
    if (!gatedResult.success) {
      return Alert.alert('Erreur', gatedResult.error ?? 'Échec de la sauvegarde des fonctionnalités.');
    }

    Alert.alert('Succès', 'Configuration des abonnements mise à jour.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  if (!isSuperAdmin) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.bg }]}>
        <Ionicons name="lock-closed" size={48} color={theme.subText} />
        <Text style={{ color: theme.subText, marginTop: 12 }}>Accès refusé</Text>
      </View>
    );
  }

  const gatedCount = ALL_FEATURE_KEYS.filter((k) => gated[k]).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* ── Header ── */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 14 }}>
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Abonnements</Text>
          <Text style={[styles.headerSub, { color: theme.subText }]} numberOfLines={1}>
            Tarifs & fonctionnalités premium
          </Text>
        </View>
      </View>

      {/* ── Bandeau info ── */}
      <View
        style={[
          styles.infoBand,
          { backgroundColor: theme.warning + '1A', borderBottomColor: theme.warning + '33' },
        ]}
      >
        <Ionicons name="information-circle-outline" size={15} color={theme.warning} />
        <Text style={[styles.infoText, { color: theme.warning }]}>
          {gatedCount === 0
            ? 'Aucune fonctionnalité premium · aucune coupure automatique'
            : `${gatedCount} fonctionnalité(s) coupée(s) automatiquement après le délai de grâce`}
        </Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 110 }}>
            {/* ── Tarifs ── */}
            <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={[styles.sectionHeader, { backgroundColor: theme.nav, borderBottomColor: theme.border }]}>
                <Ionicons name="pricetag-outline" size={18} color={theme.primary} />
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Tarifs</Text>
              </View>

              <View style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemLabel, { color: theme.text }]}>Abonnement mensuel</Text>
                  <Text style={[styles.itemDesc, { color: theme.subText }]}>Montant en XOF par mois</Text>
                </View>
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
                  value={monthly}
                  onChangeText={(t) => setMonthly(t.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={theme.subText}
                />
              </View>

              <View style={[styles.fieldRow, { borderBottomWidth: 0 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemLabel, { color: theme.text }]}>Abonnement annuel</Text>
                  <Text style={[styles.itemDesc, { color: theme.subText }]}>Montant en XOF par an</Text>
                </View>
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
                  value={annual}
                  onChangeText={(t) => setAnnual(t.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={theme.subText}
                />
              </View>
            </View>

            {/* ── Fonctionnalités Premium ── */}
            <View style={[styles.noticeCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Ionicons name="lock-closed-outline" size={16} color={theme.subText} />
              <Text style={[styles.itemDesc, { color: theme.subText, flex: 1, marginTop: 0 }]}>
                Les fonctionnalités cochées ci-dessous sont désactivées automatiquement pour une
                entreprise dont l&apos;abonnement est expiré depuis plus que son délai de grâce
                (uniquement si sa coupure automatique est activée). Elles sont réactivées dès
                réception du paiement.
              </Text>
            </View>

            {FEATURE_SECTIONS.map((section) => {
              const allOn = section.items.every((i) => gated[i.key]);
              const gatedInSection = section.items.filter((i) => gated[i.key]).length;

              return (
                <View key={section.id} style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <TouchableOpacity
                    style={[styles.sectionHeader, { backgroundColor: theme.nav, borderBottomColor: theme.border }]}
                    onPress={() => toggleSection(section)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={section.icon as any} size={18} color={theme.primary} />
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>{section.label}</Text>
                    <View style={[styles.badge, { backgroundColor: theme.border }]}>
                      <Text style={[styles.badgeText, { color: theme.subText }]}>
                        {gatedInSection}/{section.items.length}
                      </Text>
                    </View>
                    <Switch
                      value={allOn}
                      onValueChange={() => toggleSection(section)}
                      trackColor={{ false: '#38383A', true: theme.warning + '66' }}
                      thumbColor={allOn ? theme.warning : '#555'}
                    />
                  </TouchableOpacity>

                  {section.items.map((item, idx) => {
                    const isLast = idx === section.items.length - 1;
                    return (
                      <View
                        key={item.key}
                        style={[
                          styles.itemRow,
                          { borderBottomColor: theme.border },
                          isLast && { borderBottomWidth: 0 },
                        ]}
                      >
                        <Ionicons
                          name={item.icon as any}
                          size={16}
                          color={gated[item.key] ? theme.warning : theme.subText}
                        />
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.itemLabel,
                              { color: gated[item.key] ? theme.text : theme.subText },
                            ]}
                          >
                            {item.label}
                          </Text>
                          <Text style={[styles.itemDesc, { color: theme.subText }]}>
                            {item.description}
                          </Text>
                        </View>
                        <Switch
                          value={!!gated[item.key]}
                          onValueChange={() => toggleKey(item.key)}
                          trackColor={{ false: '#38383A', true: theme.primary + '55' }}
                          thumbColor={gated[item.key] ? theme.primary : '#555'}
                        />
                      </View>
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
                  <Text style={styles.saveBtnText}>Enregistrer la configuration</Text>
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
  infoBand: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  infoText: { fontSize: 13, flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  sectionCard: {
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  sectionTitle: { flex: 1, fontSize: 15, fontWeight: '700' },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '600' },

  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  input: {
    width: 130,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
    textAlign: 'right',
  },

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
