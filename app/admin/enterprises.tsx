import {
  activateEnterprise,
  activateUser,
  deactivateEnterprise,
  deactivateUser,
  getActiveEnterprises,
  getActiveUsers,
  getPendingEnterprises,
  getPendingUsers,
} from "@/lib/multitenant";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { useTheme } from "../../context/ThemeContext";
import { useTenant } from "../../context/TenantContext";

export default function SuperAdminEnterprisesScreen() {
  const { theme, isDark } = useTheme();
  const { startImpersonation } = useTenant();
  const [tab, setTab] = useState<"pending" | "active">("pending");
  const [loading, setLoading] = useState(true);
  const [enterprises, setEnterprises] = useState<any[]>([]);
  const [selectedEnterprise, setSelectedEnterprise] = useState<any | null>(null);
  const [newPendingCount, setNewPendingCount] = useState(0);
  const tabRef = useRef(tab);
  tabRef.current = tab;

  useEffect(() => { loadEnterprises(); }, [tab]);

  // Abonnement Realtime : alerte le super admin quand une nouvelle entreprise s'inscrit
  useEffect(() => {
    const sub = supabase
      .channel("superadmin_new_enterprises")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "enterprises" },
        (payload) => {
          setNewPendingCount((n) => n + 1);
          if (tabRef.current !== "pending") {
            Alert.alert(
              "🏢 Nouvelle Entreprise",
              `"${payload.new.name}" vient de s'inscrire et attend votre activation.`,
              [
                { text: "Voir maintenant", onPress: () => setTab("pending") },
                { text: "OK" },
              ],
            );
          } else {
            loadEnterprises();
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const loadEnterprises = async () => {
    setLoading(true);
    try {
      const result = tab === "pending"
        ? await getPendingEnterprises()
        : await getActiveEnterprises();
      if (result.success) setEnterprises(result.enterprises);
      else Alert.alert("Erreur", result.error);
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (enterpriseId: string, enterpriseName: string) => {
    Alert.alert("Confirmer", `Activer "${enterpriseName}" ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Activer",
        onPress: async () => {
          const result = await activateEnterprise(enterpriseId, enterpriseName);
          if (result.success) { Alert.alert("Succès", "Entreprise activée — l'admin a été notifié."); loadEnterprises(); }
          else Alert.alert("Erreur", result.error);
        },
      },
    ]);
  };

  const handleDeactivate = async (enterpriseId: string, enterpriseName: string) => {
    Alert.alert("Confirmer", `Désactiver "${enterpriseName}" ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Désactiver",
        style: "destructive",
        onPress: async () => {
          const result = await deactivateEnterprise(enterpriseId, enterpriseName);
          if (result.success) { Alert.alert("Succès", "Entreprise désactivée — l'admin a été notifié."); loadEnterprises(); }
          else Alert.alert("Erreur", result.error);
        },
      },
    ]);
  };

  const handleImpersonate = (enterprise: any) => {
    Alert.alert(
      "Mode Dépannage",
      `Accéder au tableau de bord de "${enterprise.name}" pour l'aider ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Accéder",
          onPress: () => {
            startImpersonation(enterprise.id, enterprise.name);
            router.push("/admin/dashboard");
          },
        },
      ]
    );
  };

  if (selectedEnterprise && tab === "active") {
    return (
      <EnterpriseUsersView
        enterpriseId={selectedEnterprise.id}
        enterpriseName={selectedEnterprise.name}
        onBack={() => setSelectedEnterprise(null)}
        theme={theme}
        isDark={isDark}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.push("/admin/super-admin-home")} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Entreprises</Text>
          <Text style={[styles.headerSub, { color: theme.subText }]}>Gestion des entreprises</Text>
        </View>
        <View style={[styles.headerBadge, { backgroundColor: isDark ? "#0A3060" : "#EBF5FF" }]}>
          <Ionicons name="shield-checkmark" size={16} color={theme.primary} />
          <Text style={[styles.headerBadgeText, { color: theme.primary }]}>Super Admin</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        {(["pending", "active"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && { borderBottomColor: theme.primary, borderBottomWidth: 3 }]}
            onPress={() => { setTab(t); if (t === "pending") setNewPendingCount(0); }}
          >
            <View style={styles.tabInner}>
              <Ionicons
                name={t === "pending" ? "time-outline" : "checkmark-circle-outline"}
                size={16}
                color={tab === t ? theme.primary : theme.subText}
              />
              <Text style={[styles.tabText, { color: tab === t ? theme.primary : theme.subText, fontWeight: tab === t ? "700" : "400" }]}>
                {t === "pending" ? "En Attente" : "Actives"}
              </Text>
              {t === "pending" && newPendingCount > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{newPendingCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.subText }]}>Chargement…</Text>
        </View>
      ) : enterprises.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name={tab === "pending" ? "time-outline" : "business-outline"} size={52} color={theme.border} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            Aucune entreprise {tab === "pending" ? "en attente" : "active"}
          </Text>
          <Text style={[styles.emptyText, { color: theme.subText }]}>
            {tab === "pending" ? "Toutes les entreprises ont été traitées." : "Activez des entreprises depuis l'onglet En Attente."}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {enterprises.map((enterprise) => (
            <EnterpriseCard
              key={enterprise.id}
              enterprise={enterprise}
              tab={tab}
              theme={theme}
              isDark={isDark}
              onActivate={() => handleActivate(enterprise.id, enterprise.name)}
              onDeactivate={() => handleDeactivate(enterprise.id, enterprise.name)}
              onViewUsers={() => setSelectedEnterprise(enterprise)}
              onFeatures={() => router.push({ pathname: "/admin/enterprise_features", params: { enterpriseId: enterprise.id, enterpriseName: enterprise.name } })}
              onImpersonate={() => handleImpersonate(enterprise)}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function EnterpriseCard({ enterprise, tab, theme, isDark, onActivate, onDeactivate, onViewUsers, onFeatures, onImpersonate }: any) {
  const adminInfo = enterprise.enterprise_admins?.[0];
  const createdAt = new Date(enterprise.created_at).toLocaleDateString("fr-FR");

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      {/* Card header */}
      <View style={styles.cardTop}>
        <View style={[styles.cardAvatar, { backgroundColor: isDark ? "#0A2B4D" : "#EBF5FF" }]}>
          <Ionicons name="business" size={22} color={theme.primary} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.cardName, { color: theme.text }]} numberOfLines={1}>{enterprise.name}</Text>
          <View style={styles.codeRow}>
            <Text style={[styles.cardCode, { color: theme.subText }]}>#{enterprise.code}</Text>
            <Text style={[styles.cardDate, { color: theme.subText }]}>  ·  {createdAt}</Text>
          </View>
        </View>
        <View style={[styles.statusPill, { backgroundColor: tab === "active" ? "#34C75918" : "#FF9F0A18" }]}>
          <View style={[styles.statusDot, { backgroundColor: tab === "active" ? "#34C759" : "#FF9F0A" }]} />
          <Text style={[styles.statusText, { color: tab === "active" ? "#34C759" : "#FF9F0A" }]}>
            {tab === "active" ? "Actif" : "Attente"}
          </Text>
        </View>
      </View>

      {/* Admin info */}
      {adminInfo && (
        <View style={[styles.adminInfo, { backgroundColor: isDark ? "#FFFFFF08" : "#F5F5F7", borderColor: theme.border }]}>
          <Ionicons name="person-circle-outline" size={16} color={theme.subText} />
          <Text style={[styles.adminText, { color: theme.subText }]} numberOfLines={1}>
            {adminInfo.full_name}  ·  {adminInfo.email}
          </Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.cardActions}>
        {tab === "pending" ? (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#34C759" }]} onPress={onActivate}>
            <Ionicons name="checkmark-circle" size={16} color="#fff" />
            <Text style={styles.actionBtnText}>Activer</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#FF3B30" }]} onPress={onDeactivate}>
              <Ionicons name="close-circle" size={16} color="#fff" />
              <Text style={styles.actionBtnText}>Désactiver</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.primary }]} onPress={onViewUsers}>
              <Ionicons name="people" size={16} color="#fff" />
              <Text style={styles.actionBtnText}>Users</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#FF9F0A" }]} onPress={onFeatures}>
              <Ionicons name="flash" size={16} color="#fff" />
              <Text style={styles.actionBtnText}>Features</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Impersonation button — only on active */}
      {tab === "active" && (
        <TouchableOpacity style={[styles.depannageBtn, { backgroundColor: isDark ? "#2C1F6E" : "#F0EEFF", borderColor: "#5856D6" }]} onPress={onImpersonate} activeOpacity={0.75}>
          <Ionicons name="eye-outline" size={16} color="#5856D6" />
          <Text style={[styles.depannageBtnText, { color: "#5856D6" }]}>Dépanner cette entreprise</Text>
          <Ionicons name="chevron-forward" size={14} color="#5856D6" style={{ marginLeft: "auto" }} />
        </TouchableOpacity>
      )}
    </View>
  );
}

interface EnterpriseUsersViewProps {
  enterpriseId: string;
  enterpriseName: string;
  onBack: () => void;
  theme: any;
  isDark: boolean;
}

function EnterpriseUsersView({ enterpriseId, enterpriseName, onBack, theme, isDark }: EnterpriseUsersViewProps) {
  const [tab, setTab] = useState<"pending" | "active">("pending");
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => { loadUsers(); }, [tab]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const result = tab === "pending"
        ? await getPendingUsers(enterpriseId)
        : await getActiveUsers(enterpriseId);
      if (result.success) setUsers(result.users);
      else Alert.alert("Erreur", result.error);
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (userId: string) => {
    const result = await activateUser(userId, enterpriseId);
    if (result.success) { Alert.alert("Succès", "Utilisateur activé"); loadUsers(); }
    else Alert.alert("Erreur", result.error);
  };

  const handleDeactivate = async (userId: string) => {
    const result = await deactivateUser(userId, enterpriseId);
    if (result.success) { Alert.alert("Succès", "Utilisateur désactivé"); loadUsers(); }
    else Alert.alert("Erreur", result.error);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>{enterpriseName}</Text>
          <Text style={[styles.headerSub, { color: theme.subText }]}>Gestion des utilisateurs</Text>
        </View>
      </View>

      <View style={[styles.tabsContainer, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        {(["pending", "active"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && { borderBottomColor: theme.primary, borderBottomWidth: 3 }]}
            onPress={() => setTab(t)}
          >
            <View style={styles.tabInner}>
              <Ionicons
                name={t === "pending" ? "time-outline" : "person-circle-outline"}
                size={16}
                color={tab === t ? theme.primary : theme.subText}
              />
              <Text style={[styles.tabText, { color: tab === t ? theme.primary : theme.subText, fontWeight: tab === t ? "700" : "400" }]}>
                {t === "pending" ? "En Attente" : "Actifs"}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : users.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="people-outline" size={52} color={theme.border} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Aucun utilisateur {tab === "pending" ? "en attente" : "actif"}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {users.map((item) => (
            <View key={item.id} style={[styles.userCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={[styles.userAvatar, { backgroundColor: isDark ? "#0A2B4D" : "#EBF5FF" }]}>
                <Ionicons name="person" size={20} color={theme.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.userName, { color: theme.text }]}>
                  {item.auth_users?.user_metadata?.full_name || "Utilisateur"}
                </Text>
                <Text style={[styles.userEmail, { color: theme.subText }]}>{item.auth_users?.email}</Text>
              </View>
              {tab === "pending" ? (
                <TouchableOpacity style={[styles.userActionBtn, { backgroundColor: "#34C759" }]} onPress={() => handleActivate(item.user_id)}>
                  <Ionicons name="checkmark" size={14} color="#fff" />
                  <Text style={styles.userActionText}>Accepter</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.userActionBtn, { backgroundColor: "#FF3B30" }]} onPress={() => handleDeactivate(item.user_id)}>
                  <Ionicons name="close" size={14} color="#fff" />
                  <Text style={styles.userActionText}>Désactiver</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: { marginRight: 12, padding: 2 },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  headerSub: { fontSize: 11, marginTop: 2 },
  headerBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  headerBadgeText: { fontSize: 11, fontWeight: "700" },

  tabsContainer: { flexDirection: "row", borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 13, alignItems: "center" },
  tabInner: { flexDirection: "row", alignItems: "center", gap: 6 },
  tabText: { fontSize: 14 },
  tabBadge: {
    backgroundColor: "#FF3B30",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  tabBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },

  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 24 },
  loadingText: { fontSize: 14 },
  emptyTitle: { fontSize: 16, fontWeight: "600", textAlign: "center" },
  emptyText: { fontSize: 13, textAlign: "center", lineHeight: 20 },

  listContent: { padding: 16, gap: 12 },

  card: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  cardTop: { flexDirection: "row", alignItems: "center", padding: 16 },
  cardAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  cardName: { fontSize: 15, fontWeight: "700" },
  codeRow: { flexDirection: "row", alignItems: "center", marginTop: 3 },
  cardCode: { fontSize: 12 },
  cardDate: { fontSize: 12 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "700" },
  adminInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  adminText: { fontSize: 12, flex: 1 },
  cardActions: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 14 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  depannageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  depannageBtnText: { fontSize: 13, fontWeight: "700" },

  // Users view
  userCard: { flexDirection: "row", alignItems: "center", borderRadius: 14, padding: 14, borderWidth: 1 },
  userAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  userName: { fontSize: 14, fontWeight: "600" },
  userEmail: { fontSize: 12, marginTop: 2 },
  userActionBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  userActionText: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
