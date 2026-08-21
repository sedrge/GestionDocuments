// app/admin/my-stores.tsx
//
// "Mes magasins" — écran de l'admin d'une entreprise parente : liste de ses
// magasins (entreprises enfants), bascule vers l'un d'eux et création.
//
// Réservé à l'admin d'une entreprise de premier niveau : le responsable d'un
// magasin (tenant courant avec `parent_enterprise_id`) ne gère pas de magasins,
// et un simple membre non plus.

import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
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

export default function MyStoresScreen() {
  const { tenant, isEnterpriseAdmin, switchTenant } = useTenant();
  const { theme: rawTheme } = useTheme();
  const theme = {
    ...rawTheme,
    success: '#34C759',
    danger: '#FF3B30',
    warning: '#FF9F0A',
  };

  const enterpriseId = tenant?.enterprise_id ?? '';
  // Un magasin ne peut pas lui-même avoir de magasins (une seule profondeur).
  const canManageStores = isEnterpriseAdmin && !tenant?.parent_enterprise_id;

  const [loading, setLoading] = useState(canManageStores && !!enterpriseId);
  const [refreshing, setRefreshing] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const loadStores = useCallback(async () => {
    if (!enterpriseId || !canManageStores) return;
    const result = await getStores(enterpriseId);
    if (result.success) setStores(result.stores);
    else Alert.alert('Erreur', result.error ?? 'Magasins indisponibles.');
  }, [enterpriseId, canManageStores]);

  // Rechargement à chaque affichage : un magasin créé depuis create-store.tsx
  // doit apparaître au retour sur cet écran.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (!enterpriseId || !canManageStores) {
          if (active) setLoading(false);
          return;
        }
        await loadStores();
        if (active) setLoading(false);
      })();
      return () => {
        active = false;
      };
    }, [enterpriseId, canManageStores, loadStores]),
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadStores();
    setRefreshing(false);
  };

  const handleSwitch = (store: Store) => {
    Alert.alert(
      'Basculer de magasin',
      `Travailler sur "${store.name}" ? Toutes les données affichées seront celles de ce magasin.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Basculer',
          onPress: async () => {
            setSwitchingId(store.id);
            await switchTenant(store.id);
            setSwitchingId(null);
            router.replace('/home');
          },
        },
      ],
    );
  };

  // ── Accès réservé ───────────────────────────────────────────────────────────
  if (!canManageStores) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
        <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 14 }}>
            <Ionicons name="arrow-back" size={24} color={theme.primary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Mes magasins</Text>
        </View>
        <View style={styles.centered}>
          <Ionicons name="lock-closed" size={48} color={theme.subText} />
          <Text style={{ color: theme.text, marginTop: 12, fontWeight: '700' }}>Accès réservé</Text>
          <Text style={{ color: theme.subText, marginTop: 6, textAlign: 'center', paddingHorizontal: 30 }}>
            Seul l&apos;administrateur de l&apos;entreprise principale peut gérer les
            magasins.
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
          <Text style={[styles.headerTitle, { color: theme.text }]}>Mes magasins</Text>
          <Text style={[styles.headerSub, { color: theme.subText }]} numberOfLines={1}>
            {tenant?.enterprise_name || 'Mon entreprise'}
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
          {/* Entreprise principale — rappel du contexte courant */}
          <View style={[styles.currentBox, { backgroundColor: theme.primary + '14', borderColor: theme.primary + '33' }]}>
            <Ionicons name="business-outline" size={16} color={theme.primary} />
            <Text style={[styles.currentText, { color: theme.subText }]}>
              Vous travaillez sur l&apos;entreprise principale{' '}
              <Text style={{ fontWeight: '700', color: theme.text }}>{tenant?.enterprise_name}</Text>.
            </Text>
          </View>

          {stores.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Ionicons name="storefront-outline" size={44} color={theme.border} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Aucun magasin</Text>
              <Text style={[styles.emptyText, { color: theme.subText }]}>
                Créez un magasin pour séparer les entrées et sorties de chacune de vos
                boutiques, tout en gardant une vue d&apos;ensemble.
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
                  style={[styles.switchBtn, { borderColor: theme.primary, backgroundColor: theme.primary + '12' }]}
                  onPress={() => handleSwitch(store)}
                  disabled={switchingId === store.id}
                  activeOpacity={0.8}
                >
                  {switchingId === store.id ? (
                    <ActivityIndicator color={theme.primary} />
                  ) : (
                    <>
                      <Ionicons name="swap-horizontal-outline" size={16} color={theme.primary} />
                      <Text style={[styles.switchBtnText, { color: theme.primary }]}>
                        Basculer vers ce magasin
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={14}
                        color={theme.primary}
                        style={{ marginLeft: 'auto' }}
                      />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ))
          )}

          <TouchableOpacity
            style={[styles.createBtn, { backgroundColor: theme.primary }]}
            onPress={() => router.push('/admin/create-store')}
            activeOpacity={0.85}
          >
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.createBtnText}>Créer un magasin</Text>
          </TouchableOpacity>
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

  currentBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    marginBottom: 14,
  },
  currentText: { flex: 1, fontSize: 12, lineHeight: 17 },

  emptyBox: {
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    marginBottom: 14,
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

  switchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 14,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  switchBtnText: { fontSize: 13, fontWeight: '700' },

  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 15,
    gap: 10,
    marginTop: 4,
  },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
