import { api } from "@/lib/api";
import { useTheme } from "@/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const WHATSAPP = "#25D366";

interface SupportContactInfo {
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  address: string | null;
}

interface HelpItem {
  id: string;
  type: "video" | "text" | "audio";
  title: string;
  body: string | null;
  media_url: string | null;
  is_active: boolean;
}

function AudioPlayer({ uri }: { uri: string }) {
  const { theme } = useTheme();
  const player = useVideoPlayer({ uri }, () => {});
  const [playing, setPlaying] = useState(false);

  return (
    <TouchableOpacity
      style={[styles.audioBtn, { borderColor: theme.border }]}
      onPress={() => {
        if (playing) player.pause();
        else player.play();
        setPlaying(!playing);
      }}
      activeOpacity={0.75}
    >
      <Ionicons
        name={playing ? "pause-circle" : "play-circle"}
        size={36}
        color={theme.primary}
      />
      <Text style={[styles.audioLabel, { color: theme.text }]}>
        {playing ? "Lecture en cours…" : "Écouter"}
      </Text>
    </TouchableOpacity>
  );
}

function VideoPlayerInline({ uri }: { uri: string }) {
  const player = useVideoPlayer({ uri }, (p) => {
    p.play();
  });

  return (
    <VideoView
      player={player}
      style={styles.video}
      contentFit="contain"
      nativeControls
    />
  );
}

function HelpItemCard({ item }: { item: HelpItem }) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const iconByType = {
    video: "play-circle-outline",
    audio: "musical-notes-outline",
    text: "document-text-outline",
  } as const;

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <TouchableOpacity
        style={styles.row}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.75}
      >
        <Ionicons name={iconByType[item.type]} size={22} color={theme.primary} />
        <Text style={[styles.rowValue, { color: theme.text, flex: 1 }]}>{item.title}</Text>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={theme.subText}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.expandedContent}>
          {item.type === "text" && item.body ? (
            <Text style={[styles.bodyText, { color: theme.text }]}>{item.body}</Text>
          ) : null}
          {item.type === "video" && item.media_url ? (
            <VideoPlayerInline uri={item.media_url} />
          ) : null}
          {item.type === "audio" && item.media_url ? (
            <AudioPlayer uri={item.media_url} />
          ) : null}
        </View>
      )}
    </View>
  );
}

export default function AideScreen() {
  const { theme } = useTheme();
  const [contact, setContact] = useState<SupportContactInfo | null>(null);
  const [helpItems, setHelpItems] = useState<HelpItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getSupportContact().catch(() => null),
      api.getHelpItems().catch(() => []),
    ]).then(([contactData, items]) => {
      setContact(contactData ?? null);
      setHelpItems((items ?? []).filter((i: HelpItem) => i.is_active));
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const open = (url: string) => Linking.openURL(url);

  const hasContact = !!(
    contact?.whatsapp || contact?.phone || contact?.email || contact?.website || contact?.address
  );

  type ContactRow = {
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    label: string;
    value: string;
    onPress: () => void;
  };

  const contactRows: ContactRow[] = [
    contact?.whatsapp && {
      icon: "logo-whatsapp" as const,
      color: WHATSAPP,
      label: "WhatsApp",
      value: contact.whatsapp,
      onPress: () => open(`https://wa.me/${contact.whatsapp!.replace(/\D/g, "")}`),
    },
    contact?.phone && {
      icon: "call-outline" as const,
      color: "#34C759",
      label: "Téléphone",
      value: contact.phone,
      onPress: () => open(`tel:${contact.phone}`),
    },
    contact?.email && {
      icon: "mail-outline" as const,
      color: theme.primary,
      label: "Email",
      value: contact.email,
      onPress: () => open(`mailto:${contact.email}`),
    },
    contact?.website && {
      icon: "globe-outline" as const,
      color: theme.primary,
      label: "Site web",
      value: contact.website,
      onPress: () => open(contact.website!),
    },
    contact?.address && {
      icon: "location-outline" as const,
      color: theme.subText,
      label: "Adresse",
      value: contact.address,
      onPress: () => {},
    },
  ].filter(Boolean) as ContactRow[];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <Ionicons name="arrow-back" size={22} color={theme.primary} />
          <Text style={{ color: theme.primary, fontSize: 16, fontWeight: "600" }}>Retour</Text>
        </TouchableOpacity>

        <Text style={styles.emoji}>❓</Text>
        <Text style={[styles.title, { color: theme.text }]}>Aide</Text>

        {helpItems.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: theme.subText }]}>
              Guide d'utilisation
            </Text>
            {helpItems.map((item) => (
              <HelpItemCard key={item.id} item={item} />
            ))}
          </>
        )}

        <Text style={[styles.sectionLabel, { color: theme.subText }]}>Nous contacter</Text>
        {hasContact ? (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {contactRows.map((row, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.row,
                  i < contactRows.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: theme.border,
                  },
                ]}
                onPress={row.onPress}
                activeOpacity={0.75}
              >
                <Ionicons name={row.icon} size={22} color={row.color} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowLabel, { color: theme.subText }]}>{row.label}</Text>
                  <Text
                    style={[
                      styles.rowValue,
                      { color: row.color === theme.primary || row.color === WHATSAPP ? row.color : theme.text },
                    ]}
                  >
                    {row.value}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <Text style={[styles.noInfo, { color: theme.subText }]}>
            Les coordonnées de contact n'ont pas encore été renseignées.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  noInfo: { fontSize: 14, textAlign: "center", marginTop: 4, marginBottom: 16 },
  content: { padding: 20, paddingBottom: 48 },
  backRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 28 },
  emoji: { fontSize: 56, textAlign: "center", marginBottom: 8 },
  title: { fontSize: 24, fontWeight: "bold", textAlign: "center", marginBottom: 24 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 8,
  },
  card: { borderRadius: 16, borderWidth: 1, marginBottom: 16, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16 },
  rowLabel: { fontSize: 12, marginBottom: 3 },
  rowValue: { fontSize: 15, fontWeight: "500" },
  expandedContent: { paddingHorizontal: 16, paddingBottom: 16 },
  bodyText: { fontSize: 14, lineHeight: 22 },
  video: { width: "100%", height: 200, borderRadius: 10, backgroundColor: "#000" },
  audioBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  audioLabel: { fontSize: 14, fontWeight: "500" },
});
