import { supabase } from "@/lib/supabase";
import { useTheme } from "@/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const EXTRA = {
  green: "#34C759",
  whatsapp: "#25D366",
  accent: "#FF6B00",
};

interface EnterpriseContactInfo {
  id: string;
  description: string | null;
  whatsapp: string | null;
  phone1: string | null;
  phone2: string | null;
  email: string | null;
  address: string | null;
  localisation: string | null;
  website: string | null;
}

export default function ContactScreen() {
  const { theme } = useTheme();
  const { enterprise_id, enterprise_name } = useLocalSearchParams<{
    enterprise_id?: string;
    enterprise_name?: string;
  }>();
  const [contact, setContact] = useState<EnterpriseContactInfo | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enterprise_id) {
      setLoading(false);
      return;
    }
    // Récupérer le logo de l'entreprise et les infos de contact en parallèle
    Promise.all([
      supabase
        .from("enterprises")
        .select("logo_url")
        .eq("id", enterprise_id)
        .single(),
      supabase
        .from("enterprise_contacts")
        .select("*")
        .eq("enterprise_id", enterprise_id)
        .maybeSingle(),
    ]).then(([logoRes, contactRes]) => {
      if (logoRes.data?.logo_url) setLogoUrl(logoRes.data.logo_url);
      setContact(contactRes.data ?? null);
      setLoading(false);
    });
  }, [enterprise_id]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!enterprise_id) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <Ionicons name="business-outline" size={48} color={theme.subText} />
        <Text style={[styles.noInfo, { color: theme.subText }]}>
          Aucune entreprise spécifiée.
        </Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: theme.primary, fontSize: 15, marginTop: 16 }}>
            ← Retour
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!contact) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <Ionicons name="call-outline" size={48} color={theme.subText} />
        <Text style={[styles.noInfo, { color: theme.subText }]}>
          {enterprise_name ?? "Cette entreprise"} n'a pas encore renseigné ses informations de contact.
        </Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: theme.primary, fontSize: 15, marginTop: 16 }}>
            ← Retour
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const open = (url: string) => Linking.openURL(url);

  const openGPS = async () => {
    if (!contact.localisation) return;
    const parts = contact.localisation.split(",").map(Number);
    if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return;
    const [lat, lng] = parts;
    const mapsUrl =
      Platform.OS === "ios"
        ? `maps://maps.apple.com/?daddr=${lat},${lng}`
        : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    const canOpen = await Linking.canOpenURL(mapsUrl);
    Linking.openURL(
      canOpen
        ? mapsUrl
        : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    );
  };

  type ContactRow = {
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    label: string;
    value: string;
    onPress: () => void;
  };

  const rows: ContactRow[] = [
    contact.whatsapp && {
      icon: "logo-whatsapp" as const,
      color: EXTRA.whatsapp,
      label: "WhatsApp",
      value: contact.whatsapp,
      onPress: () => open(`https://wa.me/${contact.whatsapp!.replace(/\D/g, "")}`),
    },
    contact.phone1 && {
      icon: "call-outline" as const,
      color: EXTRA.green,
      label: "Téléphone principal",
      value: contact.phone1,
      onPress: () => open(`tel:${contact.phone1}`),
    },
    contact.phone2 && {
      icon: "call-outline" as const,
      color: EXTRA.green,
      label: "Téléphone secondaire",
      value: contact.phone2,
      onPress: () => open(`tel:${contact.phone2}`),
    },
    contact.email && {
      icon: "mail-outline" as const,
      color: theme.primary,
      label: "Email",
      value: contact.email,
      onPress: () => open(`mailto:${contact.email}`),
    },
    contact.website && {
      icon: "globe-outline" as const,
      color: theme.primary,
      label: "Site web",
      value: contact.website,
      onPress: () => open(contact.website!),
    },
  ].filter(Boolean) as ContactRow[];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.content}
    >
      {/* Retour */}
      <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
        <Ionicons name="arrow-back" size={22} color={theme.primary} />
        <Text style={{ color: theme.primary, fontSize: 16, fontWeight: "600" }}>
          Retour
        </Text>
      </TouchableOpacity>

      {/* Logo ou icône de l'entreprise */}
      {logoUrl ? (
        <Image
          source={{ uri: logoUrl }}
          style={styles.logo}
          resizeMode="cover"
        />
      ) : (
        <Text style={styles.emoji}>📞</Text>
      )}
      <Text style={[styles.title, { color: theme.text }]}>
        {enterprise_name ?? "Contacts de l'entreprise"}
      </Text>

      {/* Description */}
      {contact.description ? (
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.description, { color: theme.text }]}>
            {contact.description}
          </Text>
        </View>
      ) : null}

      {/* Lignes de contact */}
      {rows.length > 0 && (
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {rows.map((row, i) => (
            <TouchableOpacity
              key={i}
              style={[
                styles.row,
                i < rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border },
              ]}
              onPress={row.onPress}
              activeOpacity={0.75}
            >
              <Ionicons name={row.icon} size={22} color={row.color} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, { color: theme.subText }]}>{row.label}</Text>
                <Text style={[styles.rowValue, { color: row.color === theme.primary || row.color === EXTRA.whatsapp ? row.color : theme.text }]}>
                  {row.value}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.border} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Adresse */}
      {contact.address ? (
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.row}>
            <Ionicons name="location-outline" size={22} color={theme.subText} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: theme.subText }]}>Adresse</Text>
              <Text style={[styles.rowValue, { color: theme.text }]}>{contact.address}</Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* GPS */}
      {contact.localisation ? (
        <TouchableOpacity
          style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={openGPS}
          activeOpacity={0.75}
        >
          <View style={styles.row}>
            <Ionicons name="navigate-outline" size={22} color={EXTRA.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: theme.subText }]}>Position GPS</Text>
              <Text style={[styles.rowValue, { color: EXTRA.accent }]}>Ouvrir dans Maps</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.border} />
          </View>
        </TouchableOpacity>
      ) : null}

      {/* Chat en direct */}
      {enterprise_id && (
        <TouchableOpacity
          style={[styles.chatBtn, { backgroundColor: "#5856D6" }]}
          onPress={() =>
            router.push({
              pathname: "/chat",
              params: { enterprise_id, enterprise_name: enterprise_name ?? "Entreprise" },
            } as any)
          }
          activeOpacity={0.85}
        >
          <Ionicons name="chatbubbles-outline" size={22} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.chatBtnTitle}>Chat en direct</Text>
            <Text style={styles.chatBtnSub}>Discutez directement avec l'équipe</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      )}
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  noInfo: { fontSize: 15, textAlign: "center", marginTop: 12 },
  content: { padding: 20, paddingBottom: 48 },
  backRow: {
    flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 28,
  },
  logo: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignSelf: "center",
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.08)",
  },
  emoji: { fontSize: 64, textAlign: "center", marginBottom: 12 },
  title: {
    fontSize: 24, fontWeight: "bold", textAlign: "center", marginBottom: 24,
  },
  card: {
    borderRadius: 16, borderWidth: 1, marginBottom: 16, overflow: "hidden",
  },
  description: { fontSize: 15, lineHeight: 24, padding: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16 },
  rowLabel: { fontSize: 12, marginBottom: 3 },
  rowValue: { fontSize: 15, fontWeight: "500" },
  chatBtn: {
    flexDirection: "row", alignItems: "center", gap: 14,
    padding: 18, borderRadius: 16, marginBottom: 16,
  },
  chatBtnTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  chatBtnSub: { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 },
});
