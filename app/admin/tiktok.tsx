import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
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
import { getFunctionErrorMessage } from "@/lib/functionsError";
import { FeatureGate } from "../../components/FeatureGate";

type ConnectedAccount = {
  external_account_name: string | null;
  connected_at: string;
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function AdminTikTokContent() {
  const { theme } = useTheme();
  const { tenant } = useTenant();
  const [connectedAccount, setConnectedAccount] = useState<ConnectedAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchConnection = useCallback(async () => {
    if (!tenant?.enterprise_id) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("enterprise_social_connections_public")
      .select("external_account_name, connected_at")
      .eq("enterprise_id", tenant.enterprise_id)
      .eq("platform", "tiktok")
      .maybeSingle();
    setConnectedAccount((data as ConnectedAccount) ?? null);
    setLoading(false);
  }, [tenant?.enterprise_id]);

  // useFocusEffect seul ne suffit pas : il ne se redéclenche que sur un événement
  // de navigation, pas quand tenant.enterprise_id devient disponible après un login
  // en cours pendant que cet écran est déjà affiché (bug rencontré sur l'écran Facebook).
  useEffect(() => { fetchConnection(); }, [fetchConnection]);
  useFocusEffect(useCallback(() => { fetchConnection(); }, [fetchConnection]));

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("tiktok-oauth-start");
      if (error || !data?.authUrl) {
        throw new Error(
          await getFunctionErrorMessage(error, "Impossible de démarrer la connexion TikTok.")
        );
      }

      const result = await WebBrowser.openAuthSessionAsync(
        data.authUrl,
        "docvault://tiktok-connect-result"
      );

      if (result.type === "success" && result.url) {
        const { queryParams } = Linking.parse(result.url);
        if (queryParams?.status === "success") {
          Alert.alert("✅ Connecté", `Compte TikTok connecté : ${queryParams.account_name ?? ""}`);
        } else {
          Alert.alert(
            "Erreur",
            `Connexion TikTok impossible (${queryParams?.message ?? "erreur inconnue"}).`
          );
        }
      }
    } catch (e: any) {
      Alert.alert("Erreur", e.message || "Échec de la connexion à TikTok.");
    } finally {
      setConnecting(false);
      fetchConnection();
    }
  };

  const handleDisconnect = () => {
    if (!tenant?.enterprise_id) return;
    Alert.alert(
      "Déconnecter TikTok",
      "Les publications ne pourront plus être poussées sur ce compte tant qu'il n'est pas reconnecté.",
      [
        { text: "Annuler" },
        {
          text: "Déconnecter",
          style: "destructive",
          onPress: async () => {
            setDisconnecting(true);
            const { error } = await supabase
              .from("enterprise_social_connections")
              .delete()
              .eq("enterprise_id", tenant.enterprise_id)
              .eq("platform", "tiktok");
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
          <Text style={[styles.headerTitle, { color: theme.text }]}>Compte TikTok</Text>
          <Text style={[styles.headerSub, { color: theme.subText }]}>
            Publication automatique sur votre compte TikTok
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
              Connectez le compte TikTok de votre entreprise pour pouvoir publier vos
              publications (avec au moins une image) directement dessus depuis l'écran{" "}
              <Text style={{ color: theme.text, fontWeight: "600" }}>Publications</Text>.
              Tant que l'application n'a pas été validée par TikTok, les publications
              restent visibles uniquement par le compte connecté.
            </Text>
          </View>

          {connectedAccount ? (
            <View style={[styles.accountCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={[styles.accountIcon, { backgroundColor: "#000000" }]}>
                <Ionicons name="logo-tiktok" size={28} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.accountName, { color: theme.text }]}>
                  {connectedAccount.external_account_name ?? "Compte TikTok"}
                </Text>
                <Text style={[styles.accountDate, { color: theme.subText }]}>
                  Connecté le {formatDate(connectedAccount.connected_at)}
                </Text>
              </View>
            </View>
          ) : null}

          {connectedAccount ? (
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
              style={[styles.actionBtn, { backgroundColor: "#000000", opacity: connecting ? 0.7 : 1 }]}
              onPress={handleConnect}
              disabled={connecting}
            >
              {connecting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="logo-tiktok" size={18} color="#fff" />
                  <Text style={styles.connectBtnText}>Connecter mon compte TikTok</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

export default function AdminTikTokScreen() {
  return (
    <FeatureGate featureKey="publications.tiktok" featureName="Publication sur TikTok">
      <AdminTikTokContent />
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
  infoText: { flex: 1, flexShrink: 1, fontSize: 13, lineHeight: 20 },
  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
  },
  accountIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  accountName: { fontSize: 16, fontWeight: "700" },
  accountDate: { fontSize: 12, marginTop: 3 },
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
