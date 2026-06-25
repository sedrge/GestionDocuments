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
import { supabase } from '../../lib/supabase';

// ─── Définition de tous les éléments de menu contrôlables ────────────────────

type MenuSection = {
  id: string;
  label: string;
  icon: string;
  items: { key: string; label: string; icon: string }[];
};

const MENU_SECTIONS: MenuSection[] = [
  {
    id: 'fichier',
    label: 'Fichier',
    icon: 'folder-outline',
    items: [
      { key: 'fichier.nouveau_dossier',  label: 'Nouveau Dossier',   icon: 'folder-outline' },
      { key: 'fichier.importer_fichier', label: 'Importer Fichier',  icon: 'document-attach-outline' },
      { key: 'fichier.prendre_photo',    label: 'Prendre Photo',     icon: 'camera-outline' },
      { key: 'fichier.filmer_video',     label: 'Filmer Vidéo',      icon: 'videocam-outline' },
      { key: 'fichier.registre',         label: 'Registre',          icon: 'clipboard-outline' },
      { key: 'fichier.decharge',         label: 'Décharge',          icon: 'document-text-outline' },
    ],
  },
  {
    id: 'gestion',
    label: 'Gestion',
    icon: 'settings-outline',
    items: [
      { key: 'gestion.moto',         label: 'Moto',        icon: 'bicycle-outline' },
      { key: 'gestion.catalogue',    label: 'Catalogue',   icon: 'albums-outline' },
      { key: 'gestion.vente',        label: 'Vente',       icon: 'clipboard-outline' },
      { key: 'gestion.recu',         label: 'Réçu',        icon: 'receipt-outline' },
      { key: 'gestion.rendez_vous',  label: 'Rendez-Vous', icon: 'calendar-outline' },
    ],
  },
  {
    id: 'parametres',
    label: 'Paramètres',
    icon: 'cog-outline',
    items: [
      { key: 'parametres.logo',   label: 'Changer le Logo',   icon: 'image-outline' },
      { key: 'parametres.entete', label: 'Entête facture',    icon: 'business-outline' },
      { key: 'parametres.pin',    label: 'Changer le PIN',    icon: 'keypad-outline' },
    ],
  },
  {
    id: 'affichage',
    label: 'Affichage',
    icon: 'eye-outline',
    items: [
      { key: 'affichage.list',    label: 'Vue Liste',    icon: 'list-outline' },
      { key: 'affichage.details', label: 'Vue Détails',  icon: 'reorder-four-outline' },
      { key: 'affichage.grid',    label: 'Vue Grille',   icon: 'grid-outline' },
    ],
  },
];

const ALL_KEYS = MENU_SECTIONS.flatMap((s) => s.items.map((i) => i.key));

const theme = {
  bg:      '#F2F2F7',
  card:    '#FFFFFF',
  text:    '#1C1C1E',
  subText: '#8E8E93',
  primary: '#007AFF',
  border:  '#E5E5EA',
  success: '#34C759',
};

export default function UserPermissionsScreen() {
  const { userId, userName, userEmail } = useLocalSearchParams<{
    userId: string;
    userName: string;
    userEmail: string;
  }>();
  const { tenant, isEnterpriseAdmin } = useTenant();

  // Map key → is_enabled (true = visible)
  const [permissions, setPermissions] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ALL_KEYS.map((k) => [k, true]))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasCustomPerms, setHasCustomPerms] = useState(false);

  useEffect(() => {
    if (!userId || !tenant?.enterprise_id || !isEnterpriseAdmin) return;
    loadPermissions();
  }, [userId, tenant?.enterprise_id]);

  const loadPermissions = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('user_menu_permissions')
      .select('menu_key, is_enabled')
      .eq('enterprise_id', tenant!.enterprise_id)
      .eq('user_id', userId);

    if (data && data.length > 0) {
      setHasCustomPerms(true);
      // Partir d'une base "tout désactivé" puis activer selon les entrées
      const map: Record<string, boolean> = Object.fromEntries(
        ALL_KEYS.map((k) => [k, false])
      );
      data.forEach((row) => {
        if (row.menu_key in map) map[row.menu_key] = row.is_enabled;
      });
      setPermissions(map);
    } else {
      // Aucune restriction → tout est activé
      setHasCustomPerms(false);
      setPermissions(Object.fromEntries(ALL_KEYS.map((k) => [k, true])));
    }
    setLoading(false);
  };

  const toggleKey = (key: string) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
    if (!hasCustomPerms) setHasCustomPerms(true);
  };

  const toggleSection = (section: MenuSection) => {
    const allOn = section.items.every((i) => permissions[i.key]);
    const updated = { ...permissions };
    section.items.forEach((i) => { updated[i.key] = !allOn; });
    setPermissions(updated);
    if (!hasCustomPerms) setHasCustomPerms(true);
  };

  const handleSave = async () => {
    if (!userId || !tenant?.enterprise_id) return;
    setSaving(true);

    // Supprimer les anciennes entrées, réinsérer les nouvelles
    await supabase
      .from('user_menu_permissions')
      .delete()
      .eq('enterprise_id', tenant.enterprise_id)
      .eq('user_id', userId);

    const rows = ALL_KEYS.map((key) => ({
      enterprise_id: tenant.enterprise_id,
      user_id:       userId,
      menu_key:      key,
      is_enabled:    permissions[key],
    }));

    const { error } = await supabase.from('user_menu_permissions').insert(rows);

    setSaving(false);
    if (error) {
      Alert.alert('Erreur', error.message);
    } else {
      Alert.alert('Succès', 'Permissions mises à jour.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    }
  };

  const handleReset = () => {
    Alert.alert(
      'Réinitialiser',
      'Supprimer toutes les restrictions pour cet utilisateur (il verra tout) ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réinitialiser',
          style: 'destructive',
          onPress: async () => {
            if (!userId || !tenant?.enterprise_id) return;
            await supabase
              .from('user_menu_permissions')
              .delete()
              .eq('enterprise_id', tenant.enterprise_id)
              .eq('user_id', userId);
            setHasCustomPerms(false);
            setPermissions(Object.fromEntries(ALL_KEYS.map((k) => [k, true])));
          },
        },
      ]
    );
  };

  if (!isEnterpriseAdmin) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: theme.subText }}>Accès refusé</Text>
      </View>
    );
  }

  const displayName = userName || userEmail || 'Utilisateur';
  const enabledCount = Object.values(permissions).filter(Boolean).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 14 }}>
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Permissions du menu</Text>
          <Text style={styles.headerSub} numberOfLines={1}>{displayName}</Text>
        </View>
        {hasCustomPerms && (
          <TouchableOpacity onPress={handleReset} style={{ padding: 4 }}>
            <Ionicons name="refresh-outline" size={22} color="#FF3B30" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <>
          {/* ── Info banner ─────────────────────────────────────────────── */}
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle-outline" size={16} color={theme.primary} />
            <Text style={styles.infoText}>
              {hasCustomPerms
                ? `Restrictions actives · ${enabledCount}/${ALL_KEYS.length} éléments visibles`
                : 'Aucune restriction · l\'utilisateur voit tout le menu'}
            </Text>
          </View>

          <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 100 }}>
            {MENU_SECTIONS.map((section) => {
              const allOn = section.items.every((i) => permissions[i.key]);
              const someOn = section.items.some((i) => permissions[i.key]);

              return (
                <View key={section.id} style={styles.sectionCard}>
                  {/* En-tête de section avec toggle tout/rien */}
                  <TouchableOpacity
                    style={styles.sectionHeader}
                    onPress={() => toggleSection(section)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={section.icon as any} size={18} color={theme.primary} />
                    <Text style={styles.sectionTitle}>{section.label}</Text>
                    <View style={styles.sectionBadge}>
                      <Text style={styles.sectionBadgeText}>
                        {section.items.filter((i) => permissions[i.key]).length}/{section.items.length}
                      </Text>
                    </View>
                    <Switch
                      value={allOn}
                      onValueChange={() => toggleSection(section)}
                      trackColor={{ false: '#E5E5EA', true: theme.success + '88' }}
                      thumbColor={allOn ? theme.success : '#ccc'}
                    />
                  </TouchableOpacity>

                  {/* Éléments */}
                  {section.items.map((item, idx) => (
                    <View
                      key={item.key}
                      style={[
                        styles.itemRow,
                        idx === section.items.length - 1 && { borderBottomWidth: 0 },
                      ]}
                    >
                      <Ionicons
                        name={item.icon as any}
                        size={16}
                        color={permissions[item.key] ? theme.text : '#ccc'}
                      />
                      <Text
                        style={[
                          styles.itemLabel,
                          !permissions[item.key] && { color: '#ccc' },
                        ]}
                      >
                        {item.label}
                      </Text>
                      <Switch
                        value={permissions[item.key]}
                        onValueChange={() => toggleKey(item.key)}
                        trackColor={{ false: '#E5E5EA', true: theme.primary + '66' }}
                        thumbColor={permissions[item.key] ? theme.primary : '#ccc'}
                      />
                    </View>
                  ))}
                </View>
              );
            })}
          </ScrollView>

          {/* ── Bouton Enregistrer ──────────────────────────────────────── */}
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
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.saveBtnText}>Enregistrer les permissions</Text>
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
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1C1C1E' },
  headerSub:   { fontSize: 12, color: '#8E8E93', marginTop: 1 },
  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center' },

  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF4FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C9E2FF',
  },
  infoText: { fontSize: 13, color: '#007AFF', flex: 1 },

  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
    gap: 10,
    backgroundColor: '#FAFAFA',
  },
  sectionTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#1C1C1E' },
  sectionBadge: {
    backgroundColor: '#E5E5EA',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sectionBadgeText: { fontSize: 11, fontWeight: '600', color: '#555' },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
    gap: 12,
  },
  itemLabel: { flex: 1, fontSize: 14, color: '#1C1C1E' },

  saveBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 14,
    paddingVertical: 15,
    gap: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
