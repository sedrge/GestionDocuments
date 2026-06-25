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
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const themes = {
  light: {
    bg: "#F5F5F7",
    card: "#FFFFFF",
    text: "#1C1C1E",
    subText: "#8E8E93",
    primary: "#007AFF",
    border: "#D1D1D6",
  },
  dark: {
    bg: "#121112",
    card: "#1E1E1E",
    text: "#FFFFFF",
    subText: "#A1A1A1",
    primary: "#0A84FF",
    border: "#38383A",
  },
};

export default function SuperAdminEnterprisesScreen() {
  const isDark = true;
  const theme = isDark ? themes.dark : themes.light;
  const [tab, setTab] = useState<"pending" | "active">("pending");
  const [loading, setLoading] = useState(true);
  const [enterprises, setEnterprises] = useState<any[]>([]);
  const [selectedEnterprise, setSelectedEnterprise] = useState<string | null>(
    null,
  );

  useEffect(() => {
    loadEnterprises();
  }, [tab]);

  const loadEnterprises = async () => {
    setLoading(true);
    try {
      let result;
      if (tab === "pending") {
        result = await getPendingEnterprises();
      } else {
        result = await getActiveEnterprises();
      }

      if (result.success) {
        setEnterprises(result.enterprises);
      } else {
        Alert.alert("Erreur", result.error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (enterpriseId: string) => {
    Alert.alert("Confirmer", "Activer cette entreprise ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Activer",
        onPress: async () => {
          const result = await activateEnterprise(enterpriseId);
          if (result.success) {
            Alert.alert("Succès", "Entreprise activée");
            loadEnterprises();
          } else {
            Alert.alert("Erreur", result.error);
          }
        },
      },
    ]);
  };

  const handleDeactivate = async (enterpriseId: string) => {
    Alert.alert("Confirmer", "Désactiver cette entreprise ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Désactiver",
        onPress: async () => {
          const result = await deactivateEnterprise(enterpriseId);
          if (result.success) {
            Alert.alert("Succès", "Entreprise désactivée");
            loadEnterprises();
          } else {
            Alert.alert("Erreur", result.error);
          }
        },
      },
    ]);
  };

  const EnterpriseCard = ({ enterprise }: { enterprise: any }) => (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.enterpriseName, { color: theme.text }]}>
            {enterprise.name}
          </Text>
          <Text style={[styles.cardMeta, { color: theme.subText }]}>
            Code: {enterprise.code}
          </Text>
          {enterprise.enterprise_admins &&
            enterprise.enterprise_admins.length > 0 && (
              <>
                <Text style={[styles.cardMeta, { color: theme.subText }]}>
                  Admin: {enterprise.enterprise_admins[0].full_name}
                </Text>
                <Text style={[styles.cardMeta, { color: theme.subText }]}>
                  Email: {enterprise.enterprise_admins[0].email}
                </Text>
              </>
            )}
          <Text style={[styles.cardMeta, { color: theme.subText }]}>
            Créée: {new Date(enterprise.created_at).toLocaleDateString("fr-FR")}
          </Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        {tab === "pending" ? (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#34C759" }]}
            onPress={() => handleActivate(enterprise.id)}
          >
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Activer</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#FF3B30" }]}
            onPress={() => handleDeactivate(enterprise.id)}
          >
            <Ionicons name="close-circle" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Désactiver</Text>
          </TouchableOpacity>
        )}
        {tab === "active" && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.primary }]}
            onPress={() => setSelectedEnterprise(enterprise.id)}
          >
            <Ionicons name="people" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Users</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (selectedEnterprise && tab === "active") {
    return (
      <EnterpriseUsersView
        enterpriseId={selectedEnterprise}
        onBack={() => setSelectedEnterprise(null)}
        theme={theme}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.card, borderBottomColor: theme.border },
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <Text style={[styles.title, { color: theme.text }]}>Super-Admin</Text>
            <Text style={[styles.subtitle, { color: theme.subText }]}>
              Gestion des Entreprises
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/admin/contact")}
            style={{ padding: 8 }}
          >
            <Ionicons name="call-outline" size={24} color={theme.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            tab === "pending" && {
              borderBottomColor: theme.primary,
              borderBottomWidth: 3,
            },
          ]}
          onPress={() => setTab("pending")}
        >
          <Text
            style={[
              styles.tabText,
              {
                color: tab === "pending" ? theme.primary : theme.subText,
                fontWeight: tab === "pending" ? "600" : "400",
              },
            ]}
          >
            En Attente
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            tab === "active" && {
              borderBottomColor: theme.primary,
              borderBottomWidth: 3,
            },
          ]}
          onPress={() => setTab("active")}
        >
          <Text
            style={[
              styles.tabText,
              {
                color: tab === "active" ? theme.primary : theme.subText,
                fontWeight: tab === "active" ? "600" : "400",
              },
            ]}
          >
            Actives
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : enterprises.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={[styles.emptyText, { color: theme.subText }]}>
            Aucune entreprise {tab === "pending" ? "en attente" : "active"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={enterprises}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <EnterpriseCard enterprise={item} />}
          contentContainerStyle={styles.listContent}
          scrollEnabled={false}
        />
      )}
    </SafeAreaView>
  );
}

interface EnterpriseUsersViewProps {
  enterpriseId: string;
  onBack: () => void;
  theme: any;
}

function EnterpriseUsersView({
  enterpriseId,
  onBack,
  theme,
}: EnterpriseUsersViewProps) {
  const [tab, setTab] = useState<"pending" | "active">("pending");
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    loadUsers();
  }, [tab]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      let result;
      if (tab === "pending") {
        result = await getPendingUsers(enterpriseId);
      } else {
        result = await getActiveUsers(enterpriseId);
      }

      if (result.success) {
        setUsers(result.users);
      } else {
        Alert.alert("Erreur", result.error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (userId: string) => {
    const result = await activateUser(userId, enterpriseId);
    if (result.success) {
      Alert.alert("Succès", "User activé");
      loadUsers();
    } else {
      Alert.alert("Erreur", result.error);
    }
  };

  const handleDeactivate = async (userId: string) => {
    const result = await deactivateUser(userId, enterpriseId);
    if (result.success) {
      Alert.alert("Succès", "User désactivé");
      loadUsers();
    } else {
      Alert.alert("Erreur", result.error);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header with back button */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.card, borderBottomColor: theme.border },
        ]}
      >
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>Users</Text>
          <Text style={[styles.subtitle, { color: theme.subText }]}>
            Gestion des utilisateurs
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            tab === "pending" && {
              borderBottomColor: theme.primary,
              borderBottomWidth: 3,
            },
          ]}
          onPress={() => setTab("pending")}
        >
          <Text
            style={[
              styles.tabText,
              {
                color: tab === "pending" ? theme.primary : theme.subText,
                fontWeight: tab === "pending" ? "600" : "400",
              },
            ]}
          >
            En Attente
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            tab === "active" && {
              borderBottomColor: theme.primary,
              borderBottomWidth: 3,
            },
          ]}
          onPress={() => setTab("active")}
        >
          <Text
            style={[
              styles.tabText,
              {
                color: tab === "active" ? theme.primary : theme.subText,
                fontWeight: tab === "active" ? "600" : "400",
              },
            ]}
          >
            Actifs
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : users.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={[styles.emptyText, { color: theme.subText }]}>
            Aucun utilisateur {tab === "pending" ? "en attente" : "actif"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View
              style={[
                styles.card,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.userName, { color: theme.text }]}>
                {item.auth_users?.user_metadata?.full_name || "Utilisateur"}
              </Text>
              <Text style={[styles.cardMeta, { color: theme.subText }]}>
                {item.auth_users?.email}
              </Text>
              <View style={styles.cardActions}>
                {tab === "pending" ? (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: "#34C759" }]}
                    onPress={() => handleActivate(item.user_id)}
                  >
                    <Text style={styles.actionBtnText}>Accepter</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: "#FF3B30" }]}
                    onPress={() => handleDeactivate(item.user_id)}
                  >
                    <Text style={styles.actionBtnText}>Désactiver</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
          contentContainerStyle={styles.listContent}
          scrollEnabled={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    marginRight: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  tabsContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  tabText: {
    fontSize: 14,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
  },
  listContent: {
    padding: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  cardHeader: {
    marginBottom: 12,
  },
  enterpriseName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  userName: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  cardMeta: {
    fontSize: 12,
    marginBottom: 4,
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  actionBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
});
