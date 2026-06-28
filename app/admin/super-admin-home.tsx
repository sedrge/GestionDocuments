import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import { useTenant } from "../../context/TenantContext";
import { supabase } from "../../lib/supabase";

const { width: SCREEN_W } = Dimensions.get("window");
const DRAWER_WIDTH = SCREEN_W * 0.76;

interface Stats {
  total: number;
  active: number;
  pending: number;
  users: number;
}

interface RecentEnterprise {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
}

const QUICK_ACTIONS = [
  { icon: "business-outline", label: "Gérer\nEntreprises", color: "#007AFF", bg: "#EBF5FF", bgDark: "#0A2B4D", route: "/admin/enterprises" },
  { icon: "shield-half-outline", label: "Config\nAccès Secret", color: "#FF9F0A", bg: "#FFF3E0", bgDark: "#3D2800", route: "/admin/super-admin-config" },
  { icon: "people-outline", label: "Tous les\nUtilisateurs", color: "#5AC8FA", bg: "#E8F7FE", bgDark: "#0A2535", route: "/admin/users" },
  { icon: "chatbubbles-outline", label: "Messages\nClients", color: "#34C759", bg: "#E8F8EE", bgDark: "#0A2E15", route: "/admin/chat" },
  { icon: "newspaper-outline", label: "Publications", color: "#AF52DE", bg: "#F5EEFF", bgDark: "#2B0A3D", route: "/admin/publications" },
  { icon: "call-outline", label: "Contact\nSupport", color: "#FF3B30", bg: "#FFEBE9", bgDark: "#3D0A09", route: "/admin/contact" },
];

const DRAWER_ITEMS = [
  { icon: "grid", label: "Tableau de bord", route: "/admin/super-admin-home" },
  { icon: "business", label: "Entreprises", route: "/admin/enterprises" },
  { icon: "shield-half", label: "Config Accès Secret", route: "/admin/super-admin-config" },
  { icon: "people", label: "Utilisateurs", route: "/admin/users" },
  { icon: "chatbubbles", label: "Messages clients", route: "/admin/chat" },
  { icon: "newspaper", label: "Publications", route: "/admin/publications" },
  { icon: "call", label: "Contact / Support", route: "/admin/contact" },
];

export default function SuperAdminHomeScreen() {
  const { theme, isDark, toggleTheme } = useTheme();
  const { tenant } = useTenant();
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, pending: 0, users: 0 });
  const [recents, setRecents] = useState<RecentEnterprise[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [
        { count: total },
        { count: active },
        { count: pending },
        { count: users },
        { data: recent },
      ] = await Promise.all([
        supabase.from("enterprises").select("*", { count: "exact", head: true }),
        supabase.from("enterprises").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("enterprises").select("*", { count: "exact", head: true }).eq("is_active", false),
        supabase.from("enterprise_users").select("*", { count: "exact", head: true }),
        supabase.from("enterprises").select("id, name, code, is_active, created_at").order("created_at", { ascending: false }).limit(6),
      ]);
      setStats({ total: total ?? 0, active: active ?? 0, pending: pending ?? 0, users: users ?? 0 });
      setRecents(recent ?? []);
    } catch (e) {
      console.warn("SuperAdminHome:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => { setRefreshing(true); loadData(); };

  const openDrawer = () => {
    setDrawerOpen(true);
    Animated.timing(drawerAnim, { toValue: 1, duration: 280, useNativeDriver: false }).start();
  };

  const closeDrawer = () => {
    Animated.timing(drawerAnim, { toValue: 0, duration: 250, useNativeDriver: false }).start(() =>
      setDrawerOpen(false)
    );
  };

  const handleLogout = () => {
    closeDrawer();
    setTimeout(() => {
      Alert.alert("Déconnexion", "Voulez-vous vraiment vous déconnecter ?", [
        { text: "Annuler", style: "cancel" },
        {
          text: "Déconnecter",
          style: "destructive",
          onPress: async () => {
            await supabase.auth.signOut();
          },
        },
      ]);
    }, 10);
  };

  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const drawerTranslate = drawerAnim.interpolate({ inputRange: [0, 1], outputRange: [-DRAWER_WIDTH, 0] });
  const backdropOpacity = drawerAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] });

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>

        {/* ──────────── HEADER ──────────── */}
        <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <TouchableOpacity style={styles.iconBtn} onPress={openDrawer} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="menu" size={26} color={theme.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Super Admin</Text>
            <Text style={[styles.headerSub, { color: theme.subText }]}>Panneau de contrôle</Text>
          </View>
          <TouchableOpacity style={styles.iconBtn} onPress={toggleTheme} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={22} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, styles.logoutBtn]} onPress={handleLogout} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="log-out-outline" size={22} color="#FF3B30" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />}
          showsVerticalScrollIndicator={false}
        >

          {/* ──────────── WELCOME BANNER ──────────── */}
          <View style={[styles.welcomeBanner, { backgroundColor: isDark ? "#0A3060" : "#1564C0" }]}>
            <View style={styles.welcomeRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.welcomeHi}>Bienvenue,</Text>
                <Text style={styles.welcomeName}>Super Administrateur</Text>
                <Text style={styles.welcomeDate}>{today}</Text>
              </View>
              <View style={styles.shieldCircle}>
                <Ionicons name="shield-checkmark" size={40} color="rgba(255,255,255,0.9)" />
              </View>
            </View>
            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Système SenMoto · Opérationnel</Text>
            </View>
          </View>

          {/* ──────────── STATS ──────────── */}
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={theme.primary} size="large" />
            </View>
          ) : (
            <View style={styles.statsGrid}>
              <StatCard value={stats.total} label="Entreprises" icon="business" color="#007AFF" theme={theme} />
              <StatCard value={stats.active} label="Actives" icon="checkmark-circle" color="#34C759" theme={theme} />
              <StatCard value={stats.pending} label="En attente" icon="time" color="#FF9F0A" theme={theme} />
              <StatCard value={stats.users} label="Utilisateurs" icon="people" color="#AF52DE" theme={theme} />
            </View>
          )}

          {/* ──────────── QUICK ACTIONS ──────────── */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Actions rapides</Text>
            <View style={styles.qaGrid}>
              {QUICK_ACTIONS.map((a) => (
                <TouchableOpacity
                  key={a.route}
                  style={[styles.qaCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={() => router.push(a.route as any)}
                  activeOpacity={0.72}
                >
                  <View style={[styles.qaIconCircle, { backgroundColor: isDark ? a.bgDark : a.bg }]}>
                    <Ionicons name={a.icon as any} size={24} color={a.color} />
                  </View>
                  <Text style={[styles.qaLabel, { color: theme.text }]}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ──────────── ENTREPRISES RÉCENTES ──────────── */}
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Entreprises récentes</Text>
              <TouchableOpacity onPress={() => router.push("/admin/enterprises")}>
                <Text style={[styles.seeAll, { color: theme.primary }]}>Voir tout →</Text>
              </TouchableOpacity>
            </View>
            {recents.map((e) => (
              <TouchableOpacity
                key={e.id}
                style={[styles.enterpriseRow, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => router.push("/admin/enterprises")}
                activeOpacity={0.72}
              >
                <View style={[styles.entAvatar, { backgroundColor: e.is_active ? "#34C75920" : "#FF9F0A20" }]}>
                  <Ionicons name="business" size={18} color={e.is_active ? "#34C759" : "#FF9F0A"} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.entName, { color: theme.text }]} numberOfLines={1}>{e.name}</Text>
                  <Text style={[styles.entCode, { color: theme.subText }]}>Code: {e.code}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: e.is_active ? "#34C75918" : "#FF9F0A18" }]}>
                  <Text style={[styles.badgeText, { color: e.is_active ? "#34C759" : "#FF9F0A" }]}>
                    {e.is_active ? "Actif" : "Attente"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.subText} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            ))}
            {recents.length === 0 && !loading && (
              <Text style={[styles.emptyText, { color: theme.subText }]}>Aucune entreprise enregistrée</Text>
            )}
          </View>

        </ScrollView>
      </SafeAreaView>

      {/* ──────────── BACKDROP ──────────── */}
      {drawerOpen && (
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} pointerEvents="auto">
          <Pressable style={StyleSheet.absoluteFill} onPress={closeDrawer} />
        </Animated.View>
      )}

      {/* ──────────── DRAWER ──────────── */}
      <Animated.View
        style={[styles.drawer, { width: DRAWER_WIDTH, transform: [{ translateX: drawerTranslate }], backgroundColor: theme.card }]}
        pointerEvents={drawerOpen ? "auto" : "none"}
      >
        <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
          {/* Drawer header */}
          <View style={[styles.drawerHeader, { backgroundColor: isDark ? "#0A3060" : "#1564C0" }]}>
            <View style={styles.drawerAvatarCircle}>
              <Ionicons name="shield-checkmark" size={30} color="#fff" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.drawerName}>Super Admin</Text>
              <Text style={styles.drawerRole}>Administrateur Système</Text>
            </View>
            <TouchableOpacity onPress={closeDrawer} style={{ padding: 4 }}>
              <Ionicons name="close" size={22} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.drawerSectionLabel, { color: theme.subText }]}>NAVIGATION</Text>
            {DRAWER_ITEMS.map((item) => (
              <TouchableOpacity
                key={item.route}
                style={[styles.drawerItem, { borderBottomColor: theme.border }]}
                onPress={() => { closeDrawer(); setTimeout(() => router.push(item.route as any), 10); }}
                activeOpacity={0.7}
              >
                <View style={[styles.drawerItemIcon, { backgroundColor: isDark ? "#1E3A5F22" : "#EBF5FF" }]}>
                  <Ionicons name={item.icon as any} size={18} color={theme.primary} />
                </View>
                <Text style={[styles.drawerItemLabel, { color: theme.text }]}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={14} color={theme.subText} style={{ marginLeft: "auto" }} />
              </TouchableOpacity>
            ))}

            <View style={[styles.drawerDivider, { backgroundColor: theme.border }]} />
            <Text style={[styles.drawerSectionLabel, { color: theme.subText }]}>PRÉFÉRENCES</Text>

            <TouchableOpacity
              style={[styles.drawerItem, { borderBottomColor: theme.border }]}
              onPress={() => { toggleTheme(); }}
              activeOpacity={0.7}
            >
              <View style={[styles.drawerItemIcon, { backgroundColor: isDark ? "#2E2800" : "#FFF3E0" }]}>
                <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={18} color="#FF9F0A" />
              </View>
              <Text style={[styles.drawerItemLabel, { color: theme.text }]}>{isDark ? "Mode Clair" : "Mode Sombre"}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.drawerItem, { borderBottomColor: theme.border }]}
              onPress={() => { closeDrawer(); setTimeout(handleLogout, 10); }}
              activeOpacity={0.7}
            >
              <View style={[styles.drawerItemIcon, { backgroundColor: "#FF3B3015" }]}>
                <Ionicons name="log-out-outline" size={18} color="#FF3B30" />
              </View>
              <Text style={[styles.drawerItemLabel, { color: "#FF3B30" }]}>Déconnexion</Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

function StatCard({ value, label, icon, color, theme }: { value: number; label: string; icon: string; color: string; theme: any }) {
  return (
    <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={[styles.statIconWrap, { backgroundColor: color + "20" }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.subText }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  headerSub: { fontSize: 11, marginTop: 1 },
  iconBtn: { padding: 6 },
  logoutBtn: { marginLeft: 4 },

  // Welcome
  welcomeBanner: {
    margin: 16,
    borderRadius: 20,
    padding: 20,
    overflow: "hidden",
  },
  welcomeRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  welcomeHi: { color: "rgba(255,255,255,0.75)", fontSize: 14, fontWeight: "500" },
  welcomeName: { color: "#fff", fontSize: 20, fontWeight: "800", marginTop: 2 },
  welcomeDate: { color: "rgba(255,255,255,0.65)", fontSize: 12, marginTop: 6, textTransform: "capitalize" },
  shieldCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(52,199,89,0.2)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: "flex-start",
    gap: 6,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#34C759" },
  statusText: { color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "600" },

  // Stats
  loadingRow: { height: 120, justifyContent: "center", alignItems: "center" },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 4,
  },
  statCard: {
    width: (SCREEN_W - 48) / 2,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    alignItems: "flex-start",
    gap: 8,
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  statValue: { fontSize: 26, fontWeight: "800" },
  statLabel: { fontSize: 12, fontWeight: "500" },

  // Section
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  seeAll: { fontSize: 13, fontWeight: "600" },

  // Quick Actions
  qaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  qaCard: {
    width: (SCREEN_W - 52) / 3,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    alignItems: "center",
    gap: 10,
  },
  qaIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  qaLabel: { fontSize: 11, fontWeight: "600", textAlign: "center", lineHeight: 16 },

  // Enterprises
  enterpriseRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
  },
  entAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  entName: { fontSize: 14, fontWeight: "600" },
  entCode: { fontSize: 11, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  emptyText: { textAlign: "center", paddingVertical: 20, fontSize: 14 },

  // Backdrop & Drawer
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    zIndex: 9,
  },
  drawer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 12,
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  drawerAvatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  drawerName: { color: "#fff", fontSize: 16, fontWeight: "700" },
  drawerRole: { color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 2 },
  drawerSectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 14,
  },
  drawerItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  drawerItemLabel: { fontSize: 14, fontWeight: "600", flex: 1 },
  drawerDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 20, marginVertical: 8 },
});
