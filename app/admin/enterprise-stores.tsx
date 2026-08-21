// app/admin/enterprise-stores.tsx
//
// Magasins d'une entreprise, côté super-admin : drill-down depuis la liste des
// entreprises. Un magasin est une entreprise enfant, donc son activation /
// désactivation réutilise telles quelles activateEnterprise/deactivateEnterprise
// de lib/multitenant.ts (action super-admin, comme pour toute entreprise).

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTenant } from '../../context/TenantContext';
import { useTheme } from '../../context/ThemeContext';
import { Store, getStores } from '../../lib/enterpriseStores';
import { activateEnterprise, deactivateEnterprise } from '../../lib/multitenant';

export default function EnterpriseStoresScreen() {
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

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadStores = useCallback(async () => {
    if (!enterpriseId) return;
    const result = await getStores(enterpriseId);
    if (result.success) setStores(result.stores);
    else Alert.alert('Erreur', result.error ?? 'Magasins indisponibles.');
  }, [enterpriseId]);

  useEffect(() => {
    (async () => {
      await loadStores();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enterpriseId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadStores();
    setRefreshing(false);
  };

  const handleToggleActive = (store: Store) => {
    const activating = !store.is_active;
    Alert.alert(
      'Confirmer',
      `${activating ? 'Activer' : 'Désactiver'} le magasin "${store.name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: activating ? 'Activer' : 'Désactiver',
          style: activating ? 'default' : 'destructive',
          onPress: async () => {
            setBusyId(store.id);
            const result = activating
              ? await activateEnterprise(store.id)
              : await deactivateEnterprise(store.id);
            setBusyId(null);
            if (!result.success) {
              return Alert.alert('Erreur', result.error ?? 'Action impossible.');
            }
            await loadStores();
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* ── Header ── */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 14 }}>
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Magasins</Text>
          <Text style={[styles.headerSub, { color: theme.subText }]} numberOfLines={1}>
            {enterpriseName || 'Entreprise'}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 14, paddingBottom: 30 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
          }
        >
          {stores.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Ionicons name="storefront-outline" size={44} color={theme.border} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Aucun magasin</Text>
              <Text style={[styles.emptyText, { color: theme.subText }]}>
                Cette entreprise n&apos;a pas encore créé de magasin. Ses magasins sont
                créés par son propre administrateur et sont actifs immédiatement.
              </Text>
            </View>
          ) : (
            stores.map((store) => (
              <View
                key={store.id}
                style={[styles.storeCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              >
                <View style={styles.storeTop}>
                  <View style={[styles.storeAvatar, { backgroundColor: theme.primary + '1A' }]}>
                    <Ionicons name="storefront" size={20} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.storeName, { color: theme.text }]} numberOfLines={1}>
                      {store.name}
                    </Text>
                    <Text style={[styles.storeCode, { color: theme.subText }]} numberOfLines={1}>
                      #{store.code}
                      {store.phone ? `  ·  ${store.phone}` : ''}
                      {store.email ? `  ·  ${store.email}` : ''}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: (store.is_active ? theme.success : theme.danger) + '22' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        { color: store.is_active ? theme.success : theme.danger },
                      ]}
                    >
                      {store.is_active ? 'Actif' : 'Inactif'}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    { backgroundColor: store.is_active ? theme.danger : theme.success },
                  ]}
                  onPress={() => handleToggleActive(store)}
                  disabled={busyId === store.id}
                  activeOpacity={0.85}
                >
                  {busyId === store.id ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons
                        name={store.is_active ? 'close-circle' : 'checkmark-circle'}
                        size={16}
                        color="#fff"
                      />
                      <Text style={styles.actionBtnText}>
                        {store.is_active ? 'Désactiver' : 'Activer'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  emptyBox: {
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700' },
  emptyText: { fontSize: 12, textAlign: 'center', lineHeight: 18 },

  storeCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
    overflow: 'hidden',
  },
  storeTop: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  storeAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storeName: { fontSize: 15, fontWeight: '700' },
  storeCode: { fontSize: 12, marginTop: 2 },
  statusPill: { borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },

  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 14,
    marginBottom: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
