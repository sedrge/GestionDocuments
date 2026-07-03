import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useTenant } from "@/context/TenantContext";
import { useTheme } from "@/context/ThemeContext";
import { FeatureGate } from "../../components/FeatureGate";

type ConnectedPage = {
  fb_page_id: string;
  fb_page_name: string;
  connected_at: string;
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function AdminFacebookContent() {
  const { theme } = useTheme();
  const { tenant } = useTenant();
  const [connectedPage, setConnectedPage] = useState<ConnectedPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchConnection = useCallback(async () => {
    if (!tenant?.enterprise_id) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("enterprise_facebook_pages_public")
      .select("fb_page_id, fb_page_name, connected_at")
      .eq("enterprise_id", tenant.enterprise_id)
      .maybeSingle();
    setConnectedPage((data as ConnectedPage) ?? null);
    setLoading(false);
  }, [tenant?.enterprise_id]);

  useFocusEffect(useCallback(() => { fetchConnection(); }, [fetchConnection]));

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("fb-oauth-start");
      if (error || !data?.authUrl) {
        throw new Error(error?.message ?? "Impossible de démarrer la connexion Facebook.");
      }

      const result = await WebBrowser.openAuthSessionAsync(
        data.authUrl,
        "docvault://fb-connect-result"
      );

      if (result.type === "success" && result.url) {
        const { queryParams } = Linking.parse(result.url);
        if (queryParams?.status === "success") {
          Alert.alert("✅ Connecté", `Page Facebook connectée : ${queryParams.page_name ?? ""}`);
        } else {
          Alert.alert(
            "Erreur",
            `Connexion Facebook impossible (${queryParams?.message ?? "erreur inconnue"}).`
          );
        }
      }
    } catch (e: any) {
      Alert.alert("Erreur", e.message || "Échec de la connexion à Facebook.");
    } finally {
      setConnecting(false);
      fetchConnection();
    }
  };

  const handleDisconnect = () => {
    if (!tenant?.enterprise_id) return;
    Alert.alert(
      "Déconnecter Facebook",
      "Les publications ne pourront plus être poussées sur cette Page tant qu'elle n'est pas reconnectée.",
      [
        { text: "Annuler" },
        {
          text: "Déconnecter",
          style: "destructive",
          onPress: async () => {
            setDisconnecting(true);
            const { error } = await supabase
              .from("enterprise_facebook_pages")
              .delete()
              .eq("enterprise_id", tenant.enterprise_id);
            setDisconnecting(false);
            if (error) Alert.alert("Erreur", error.message);
            fetchConnection();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Page Facebook</Text>
          <Text style={[styles.headerSub, { color: theme.subText }]}>
            Publication automatique sur votre Page Facebook
          </Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={theme.primary} />
      ) : (
        <View style={styles.content}>
          <View style={[styles.infoBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="information-circle-outline" size={18} color={theme.primary} />
            <Text style={[styles.infoText, { color: theme.subText }]}>
              Connectez la Page Facebook de votre entreprise pour pouvoir publier vos
              publications directement dessus depuis l'écran{" "}
              <Text style={{ color: theme.text, fontWeight: "600" }}>Publications</Text>.
            </Text>
          </View>

          {connectedPage ? (
            <View style={[styles.pageCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={[styles.pageIcon, { backgroundColor: "#1877F2" }]}>
                <Ionicons name="logo-facebook" size={28} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.pageName, { color: theme.text }]}>{connectedPage.fb_page_name}</Text>
                <Text style={[styles.pageDate, { color: theme.subText }]}>
                  Connectée le {formatDate(connectedPage.connected_at)}
                </Text>
              </View>
            </View>
          ) : null}

          {connectedPage ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.disconnectBtn, { opacity: disconnecting ? 0.6 : 1 }]}
              onPress={handleDisconnect}
              disabled={disconnecting}
            >
              {disconnecting ? (
                <ActivityIndicator color="#FF3B30" />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={18} color="#FF3B30" />
                  <Text style={styles.disconnectBtnText}>Déconnecter</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#1877F2", opacity: connecting ? 0.7 : 1 }]}
              onPress={handleConnect}
              disabled={connecting}
            >
              {connecting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="logo-facebook" size={18} color="#fff" />
                  <Text style={styles.connectBtnText}>Connecter ma Page Facebook</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

export default function AdminFacebookScreen() {
  return (
    <FeatureGate featureKey="publications.facebook" featureName="Publication sur Facebook">
      <AdminFacebookContent />
    </FeatureGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: "bold" },
  headerSub: { fontSize: 12, marginTop: 2 },
  content: { padding: 16 },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  infoText: { flex: 1, fontSize: 13, lineHeight: 20 },
  pageCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
  },
  pageIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  pageName: { fontSize: 16, fontWeight: "700" },
  pageDate: { fontSize: 12, marginTop: 3 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 15,
  },
  connectBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  disconnectBtn: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "#FF3B30",
  },
  disconnectBtnText: { color: "#FF3B30", fontSize: 15, fontWeight: "700" },
});
