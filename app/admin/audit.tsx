import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTenant } from '../../context/TenantContext';
import {
  ACTION_COLORS,
  ACTION_LABELS,
  AuditAction,
  ENTITY_LABELS,
  EntityType,
} from '../../lib/auditLog';
import { supabase } from '../../lib/supabase';

type AuditLog = {
  id: string;
  user_id: string;
  user_name: string | null;
  action: AuditAction;
  entity_type: EntityType;
  entity_id: string | null;
  entity_name: string | null;
  details: Record<string, any> | null;
  created_at: string;
};

type FilterAction = AuditAction | 'ALL';

const FILTER_OPTIONS: { key: FilterAction; label: string }[] = [
  { key: 'ALL',        label: 'Tout' },
  { key: 'CREATE',     label: 'Création' },
  { key: 'UPLOAD',     label: 'Import' },
  { key: 'UPDATE',     label: 'Modification' },
  { key: 'DELETE',     label: 'Suppression' },
  { key: 'LOGIN',      label: 'Connexion' },
  { key: 'APPROVE',    label: 'Approbation' },
  { key: 'DEACTIVATE', label: 'Désactivation' },
];

const theme = {
  bg:      '#F2F2F7',
  card:    '#FFFFFF',
  text:    '#1C1C1E',
  subText: '#8E8E93',
  primary: '#007AFF',
  border:  '#E5E5EA',
};

function parseDMY(s: string): Date | null {
  const p = s.split('/');
  if (p.length !== 3) return null;
  const d = new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]));
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('fr-FR', {
    day:    '2-digit',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

function buildSentence(log: AuditLog): string {
  const action = ACTION_LABELS[log.action] ?? log.action;
  const entity = ENTITY_LABELS[log.entity_type] ?? log.entity_type;
  if (log.action === 'LOGIN' || log.action === 'LOGOUT') return action;
  const name = log.entity_name ? ` "${log.entity_name}"` : '';
  return `${action} ${entity}${name}`.trim();
}

export default function AuditScreen() {
  const { tenant, isEnterpriseAdmin } = useTenant();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterAction>('ALL');
  const [uniqueUsers, setUniqueUsers] = useState<{ id: string; name: string }[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | 'ALL'>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchLogs = useCallback(async () => {
    if (!tenant?.enterprise_id || !isEnterpriseAdmin) return;

    let query = supabase
      .from('audit_logs')
      .select('*')
      .eq('enterprise_id', tenant.enterprise_id)
      .order('created_at', { ascending: false })
      .limit(500);

    if (filter !== 'ALL') query = query.eq('action', filter);
    if (selectedUser !== 'ALL') query = query.eq('user_id', selectedUser);

    const fromDate = parseDMY(dateFrom);
    if (fromDate) query = query.gte('created_at', fromDate.toISOString());
    const toDate = parseDMY(dateTo);
    if (toDate) { toDate.setHours(23, 59, 59, 999); query = query.lte('created_at', toDate.toISOString()); }

    const { data } = await query;
    if (data) {
      setLogs(data as AuditLog[]);

      // Construire la liste des utilisateurs uniques
      const seen = new Map<string, string>();
      (data as AuditLog[]).forEach((l) => {
        if (!seen.has(l.user_id)) seen.set(l.user_id, l.user_name ?? l.user_id);
      });
      setUniqueUsers(Array.from(seen.entries()).map(([id, name]) => ({ id, name })));
    }
    setLoading(false);
    setRefreshing(false);
  }, [tenant?.enterprise_id, isEnterpriseAdmin, filter, selectedUser, dateFrom, dateTo]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const onRefresh = () => { setRefreshing(true); fetchLogs(); };

  if (!isEnterpriseAdmin) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: theme.subText }}>Accès refusé</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 14 }}>
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Journal d'activité</Text>
          <Text style={styles.headerSub}>{tenant?.enterprise_name}</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={{ padding: 4 }}>
          <Ionicons name="refresh-outline" size={22} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {/* ── Filtres action ──────────────────────────────────────────────── */}
      <FlatList
        data={FILTER_OPTIONS}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(i) => i.key}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.chip, filter === item.key && styles.chipActive]}
            onPress={() => setFilter(item.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, filter === item.key && styles.chipTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* ── Filtre utilisateur ─────────────────────────────────────────── */}
      {uniqueUsers.length > 0 && (
        <FlatList
          data={[{ id: 'ALL', name: 'Tous les utilisateurs' }, ...uniqueUsers]}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(i) => i.id}
          contentContainerStyle={[styles.filterRow, { paddingTop: 0 }]}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.chip,
                styles.chipUser,
                selectedUser === item.id && styles.chipUserActive,
              ]}
              onPress={() => setSelectedUser(item.id)}
              activeOpacity={0.7}
            >
              <Ionicons
                name="person-circle-outline"
                size={13}
                color={selectedUser === item.id ? '#fff' : theme.subText}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.chipText,
                  { fontSize: 12 },
                  selectedUser === item.id && styles.chipTextActive,
                ]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* ── Filtre par plage de dates ──────────────────────────────────── */}
      <View style={styles.customDateContainer}>
        <View style={styles.customDateRow}>
          <View style={styles.customDateField}>
            <Text style={styles.customDateLabel}>Du (JJ/MM/AAAA)</Text>
            <TextInput
              style={[styles.customDateInput, dateFrom && !parseDMY(dateFrom) && styles.customDateInputError]}
              value={dateFrom}
              onChangeText={(t) => {
                let v = t.replace(/[^0-9]/g, '');
                if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
                if (v.length > 5) v = v.slice(0, 5) + '/' + v.slice(5);
                setDateFrom(v.slice(0, 10));
              }}
              placeholder="01/01/2025"
              keyboardType="numeric"
              maxLength={10}
              placeholderTextColor="#bbb"
            />
          </View>
          <View style={styles.customDateField}>
            <Text style={styles.customDateLabel}>Au (JJ/MM/AAAA)</Text>
            <TextInput
              style={[styles.customDateInput, dateTo && !parseDMY(dateTo) && styles.customDateInputError]}
              value={dateTo}
              onChangeText={(t) => {
                let v = t.replace(/[^0-9]/g, '');
                if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
                if (v.length > 5) v = v.slice(0, 5) + '/' + v.slice(5);
                setDateTo(v.slice(0, 10));
              }}
              placeholder="31/12/2025"
              keyboardType="numeric"
              maxLength={10}
              placeholderTextColor="#bbb"
            />
          </View>
          {(dateFrom || dateTo) && (
            <TouchableOpacity
              style={styles.clearDateBtn}
              onPress={() => { setDateFrom(''); setDateTo(''); }}
              activeOpacity={0.7}
            >
              <Text style={styles.clearDateText}>Effacer</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Liste ──────────────────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={40} color="#ccc" />
              <Text style={{ color: theme.subText, marginTop: 10 }}>Aucune activité trouvée</Text>
            </View>
          }
          renderItem={({ item }) => {
            const color = ACTION_COLORS[item.action] ?? theme.primary;
            return (
              <View style={styles.logCard}>
                {/* Bande colorée gauche */}
                <View style={[styles.colorBar, { backgroundColor: color }]} />

                <View style={{ flex: 1 }}>
                  {/* Utilisateur + date */}
                  <View style={styles.logTopRow}>
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarText}>
                        {(item.user_name ?? '?')[0].toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.logUserName} numberOfLines={1}>
                        {item.user_name ?? 'Utilisateur inconnu'}
                      </Text>
                      <Text style={styles.logDate}>{formatDate(item.created_at)}</Text>
                    </View>
                    <View style={[styles.actionBadge, { backgroundColor: color + '22' }]}>
                      <Text style={[styles.actionBadgeText, { color }]}>
                        {item.action}
                      </Text>
                    </View>
                  </View>

                  {/* Phrase d'action */}
                  <Text style={styles.logSentence}>{buildSentence(item)}</Text>

                  {/* Type d'entité */}
                  <View style={styles.logFooter}>
                    <Ionicons
                      name={entityIcon(item.entity_type)}
                      size={12}
                      color={theme.subText}
                    />
                    <Text style={styles.logEntityType}>{item.entity_type}</Text>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

function entityIcon(type: EntityType): any {
  const map: Record<EntityType, string> = {
    document:   'document-outline',
    categorie:  'folder-outline',
    moto:       'bicycle-outline',
    vente:      'bag-check-outline',
    rendezvous: 'calendar-outline',
    registre:   'clipboard-outline',
    decharge:   'document-text-outline',
    recu:       'receipt-outline',
    user:       'person-outline',
    session:    'log-in-outline',
  };
  return map[type] ?? 'ellipse-outline';
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

  filterRow: { paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  chipActive:     { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  chipUser:       { backgroundColor: '#fff', borderColor: '#E5E5EA' },
  chipUserActive: { backgroundColor: '#5856D6', borderColor: '#5856D6' },
  chipText:       { fontSize: 13, fontWeight: '600', color: '#666' },
  chipTextActive: { color: '#fff' },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty:    { alignItems: 'center', paddingTop: 60 },

  logCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  colorBar: { width: 4 },

  logTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingBottom: 6,
    gap: 10,
  },
  avatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText:    { fontSize: 14, fontWeight: '700', color: '#555' },
  logUserName:   { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  logDate:       { fontSize: 11, color: '#8E8E93', marginTop: 1 },

  actionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  actionBadgeText: { fontSize: 10, fontWeight: '700' },

  logSentence: {
    fontSize: 13,
    color: '#3C3C3C',
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  logFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 4,
  },
  logEntityType: { fontSize: 11, color: '#8E8E93' },

  customDateContainer: { paddingHorizontal: 14, paddingBottom: 10 },
  customDateRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  customDateField: { flex: 1 },
  customDateLabel: { fontSize: 11, color: '#8E8E93', fontWeight: '600', marginBottom: 4 },
  customDateInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1C1C1E',
  },
  customDateInputError: { borderColor: '#FF3B30' },
  clearDateBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    marginBottom: 0,
  },
  clearDateText: { fontSize: 12, fontWeight: '600', color: '#666' },
});
