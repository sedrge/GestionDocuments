// Panel de l'admin d'entreprise : CRUD des utilisateurs
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  activateUser,
  createUserInEnterprise,
  deactivateUser,
  getActiveUsers,
  getPendingUsers,
  removeUserFromEnterprise,
} from '../../lib/multitenant';
import { useTenant } from '../../context/TenantContext';

const theme = {
  bg: '#121212',
  card: '#1E1E1E',
  text: '#FFFFFF',
  subText: '#A1A1A1',
  primary: '#0A84FF',
  border: '#38383A',
  danger: '#FF3B30',
  success: '#34C759',
};

interface UserItem {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone?: string;
}

export default function EnterpriseAdminUsersScreen() {
  const { tenant, isEnterpriseAdmin } = useTenant();
  const [tab, setTab] = useState<'pending' | 'active'>('pending');
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserItem[]>([]);

  // Modal créer utilisateur
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!isEnterpriseAdmin || !tenant?.enterprise_id) {
      router.replace('/home');
      return;
    }
    loadUsers();
  }, [tab, isEnterpriseAdmin]);

  const loadUsers = async () => {
    if (!tenant?.enterprise_id) return;
    setLoading(true);
    try {
      const result =
        tab === 'pending'
          ? await getPendingUsers(tenant.enterprise_id)
          : await getActiveUsers(tenant.enterprise_id);

      if (result.success) {
        setUsers(result.users);
      } else {
        Alert.alert('Erreur', result.error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId: string) => {
    if (!tenant?.enterprise_id) return;
    const result = await activateUser(userId, tenant.enterprise_id);
    if (result.success) {
      Alert.alert('Succès', 'Utilisateur approuvé');
      loadUsers();
    } else {
      Alert.alert('Erreur', result.error);
    }
  };

  const handleDeactivate = async (userId: string) => {
    Alert.alert('Confirmer', 'Désactiver cet utilisateur ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Désactiver',
        style: 'destructive',
        onPress: async () => {
          if (!tenant?.enterprise_id) return;
          const result = await deactivateUser(userId, tenant.enterprise_id);
          if (result.success) {
            loadUsers();
          } else {
            Alert.alert('Erreur', result.error);
          }
        },
      },
    ]);
  };

  const handleRemove = (userId: string, name: string) => {
    Alert.alert(
      'Retirer l\'utilisateur',
      `Retirer "${name}" de l'entreprise ? Son compte restera actif.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: async () => {
            if (!tenant?.enterprise_id) return;
            const result = await removeUserFromEnterprise(userId, tenant.enterprise_id);
            if (result.success) {
              Alert.alert('Succès', 'Utilisateur retiré de l\'entreprise.');
              loadUsers();
            } else {
              Alert.alert('Erreur', result.error);
            }
          },
        },
      ]
    );
  };

  const handleCreate = async () => {
    if (!newName.trim() || !newEmail.includes('@') || newPassword.length < 6) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs (mot de passe : 6 caractères min.)');
      return;
    }
    if (!tenant?.enterprise_id) return;
    setCreating(true);
    const result = await createUserInEnterprise({
      fullName: newName.trim(),
      email: newEmail.trim().toLowerCase(),
      phone: newPhone.trim() || undefined,
      password: newPassword,
      enterpriseId: tenant.enterprise_id,
    });
    setCreating(false);
    if (result.success) {
      Alert.alert('Succès', 'Utilisateur créé et ajouté à l\'entreprise.');
      setShowCreateModal(false);
      setNewName(''); setNewEmail(''); setNewPhone(''); setNewPassword('');
      setTab('active');
    } else {
      Alert.alert('Erreur', result.error);
    }
  };

  const resetCreateModal = () => {
    setShowCreateModal(false);
    setNewName(''); setNewEmail(''); setNewPhone(''); setNewPassword('');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 14 }}>
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
        </TouchableOpacity>
        <View>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Gestion des Utilisateurs</Text>
          <Text style={[styles.headerSub, { color: theme.subText }]}>{tenant?.enterprise_name}</Text>
        </View>
      </View>

      {/* Onglets */}
      <View style={[styles.tabs, { borderBottomColor: theme.border }]}>
        {(['pending', 'active'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && { borderBottomColor: theme.primary, borderBottomWidth: 3 }]}
            onPress={() => setTab(t)}
          >
            <Text style={[
              styles.tabText,
              { color: tab === t ? theme.primary : theme.subText, fontWeight: tab === t ? '600' : '400' }
            ]}>
              {t === 'pending' ? 'En Attente' : 'Actifs'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Contenu */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : users.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ color: theme.subText, fontSize: 14 }}>
            Aucun utilisateur {tab === 'pending' ? 'en attente' : 'actif'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.cardTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.userName, { color: theme.text }]}>
                    {item.full_name || 'Utilisateur'}
                  </Text>
                  <Text style={[styles.userEmail, { color: theme.subText }]}>{item.email}</Text>
                  {item.phone ? (
                    <Text style={[styles.userEmail, { color: theme.subText }]}>{item.phone}</Text>
                  ) : null}
                </View>
                {/* Bouton supprimer */}
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => handleRemove(item.user_id, item.full_name || item.email)}
                >
                  <Ionicons name="trash-outline" size={18} color={theme.danger} />
                </TouchableOpacity>
              </View>

              <View style={styles.actions}>
                {tab === 'pending' ? (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: theme.success }]}
                    onPress={() => handleApprove(item.user_id)}
                  >
                    <Ionicons name="checkmark-circle" size={16} color="#fff" />
                    <Text style={styles.actionText}>Approuver</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: theme.primary }]}
                      onPress={() =>
                        router.push(
                          `/admin/user_permissions?userId=${item.user_id}&userName=${encodeURIComponent(item.full_name || '')}&userEmail=${encodeURIComponent(item.email)}` as any
                        )
                      }
                    >
                      <Ionicons name="shield-checkmark-outline" size={16} color="#fff" />
                      <Text style={styles.actionText}>Permissions</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: theme.danger }]}
                      onPress={() => handleDeactivate(item.user_id)}
                    >
                      <Ionicons name="close-circle" size={16} color="#fff" />
                      <Text style={styles.actionText}>Désactiver</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          )}
        />
      )}

      {/* FAB — Créer un utilisateur */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={() => setShowCreateModal(true)}
      >
        <Ionicons name="person-add" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Modal créer utilisateur */}
      <Modal visible={showCreateModal} transparent animationType="slide" onRequestClose={resetCreateModal}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Nouvel Utilisateur</Text>
              <TouchableOpacity onPress={resetCreateModal}>
                <Ionicons name="close" size={24} color={theme.subText} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, color: theme.text, borderColor: theme.border }]}
              placeholder="Nom complet *"
              placeholderTextColor={theme.subText}
              value={newName}
              onChangeText={setNewName}
            />
            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, color: theme.text, borderColor: theme.border }]}
              placeholder="Email *"
              placeholderTextColor={theme.subText}
              keyboardType="email-address"
              autoCapitalize="none"
              value={newEmail}
              onChangeText={setNewEmail}
            />
            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, color: theme.text, borderColor: theme.border }]}
              placeholder="Téléphone (optionnel)"
              placeholderTextColor={theme.subText}
              keyboardType="phone-pad"
              value={newPhone}
              onChangeText={setNewPhone}
            />
            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, color: theme.text, borderColor: theme.border }]}
              placeholder="Mot de passe * (6 car. min.)"
              placeholderTextColor={theme.subText}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />

            <TouchableOpacity
              style={[styles.createBtn, { backgroundColor: theme.primary, opacity: creating ? 0.7 : 1 }]}
              onPress={handleCreate}
              disabled={creating}
            >
              {creating
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.createBtnText}>Créer l'utilisateur</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  headerSub: { fontSize: 13, marginTop: 2 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabText: { fontSize: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start' },
  userName: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  userEmail: { fontSize: 12, marginBottom: 2 },
  removeBtn: { padding: 6, marginLeft: 8 },
  actions: { marginTop: 12, flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: 8, gap: 6,
  },
  actionText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  fab: {
    position: 'absolute', bottom: 30, right: 20,
    width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center',
    elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 4,
  },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  input: {
    borderWidth: 1, borderRadius: 10, padding: 14,
    marginBottom: 12, fontSize: 14,
  },
  createBtn: {
    marginTop: 8, padding: 15, borderRadius: 12, alignItems: 'center',
  },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
