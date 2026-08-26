// app/admin/help_config.tsx
//
// Configuration globale de l'écran "Aide" (super-admin) :
//  - Coordonnées de contact du concepteur (support_contacts, une seule ligne).
//  - Contenu du guide d'utilisation (help_items : vidéo/texte/audio).

import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { File, UploadType } from "expo-file-system";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTenant } from "../../context/TenantContext";
import { useTheme } from "../../context/ThemeContext";
import { api, getToken } from "../../lib/api";

type ItemType = "video" | "text" | "audio";

interface HelpItem {
  id: string;
  type: ItemType;
  title: string;
  body: string | null;
  media_url: string | null;
  is_active: boolean;
}

const TYPE_LABELS: Record<ItemType, string> = {
  video: "Vidéo",
  text: "Texte",
  audio: "Audio",
};
const TYPE_ICONS: Record<ItemType, keyof typeof Ionicons.glyphMap> = {
  video: "play-circle-outline",
  text: "document-text-outline",
  audio: "musical-notes-outline",
};

/**
 * Envoi natif (createUploadTask), pas fetch/FormData — même contournement
 * que uploadVideoPublication dans admin/publications.tsx.
 */
async function uploadHelpItemMedia(
  type: ItemType,
  title: string,
  body: string,
  mediaUri: string,
): Promise<HelpItem> {
  const ext = mediaUri.split(".").pop()?.toLowerCase().split("?")[0] || "mp4";
  const mimeByExt: Record<string, string> = {
    mp4: "video/mp4",
    mov: "video/quicktime",
    m4v: "video/mp4",
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    wav: "audio/wav",
  };
  const mimeType = mimeByExt[ext] ?? "application/octet-stream";
  const token = await getToken();

  const parameters: Record<string, string> = { type, title: title.trim() };
  if (body.trim()) parameters.body = body.trim();

  const file = new File(mediaUri);
  const task = file.createUploadTask(api.helpItemsUploadUrl(), {
    httpMethod: "POST",
    uploadType: UploadType.MULTIPART,
    fieldName: "media",
    mimeType,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    parameters,
  });

  const result = await task.uploadAsync();
  if (!result) throw new Error("Échec de l'envoi du fichier.");
  if (result.status < 200 || result.status >= 300) {
    let message = `Erreur HTTP ${result.status}`;
    try {
      const data = JSON.parse(result.body);
      if (data?.message) message = data.message;
    } catch {
      // corps non-JSON : message générique conservé
    }
    throw new Error(message);
  }
  return JSON.parse(result.body);
}

export default function HelpConfigScreen() {
  const { isSuperAdmin } = useTenant();
  const { theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");

  const [items, setItems] = useState<HelpItem[]>([]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newType, setNewType] = useState<ItemType>("text");
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newMediaUri, setNewMediaUri] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [contact, helpItems] = await Promise.all([
        api.getSupportContact(),
        api.getHelpItems(),
      ]);
      setEmail(contact?.email ?? "");
      setPhone(contact?.phone ?? "");
      setWhatsapp(contact?.whatsapp ?? "");
      setWebsite(contact?.website ?? "");
      setAddress(contact?.address ?? "");
      setItems(helpItems ?? []);
    } catch {
      Alert.alert("Erreur", "Impossible de charger la configuration.");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!isSuperAdmin) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveContact = async () => {
    setSaving(true);
    try {
      await api.updateSupportContact({
        email: email.trim() || null,
        phone: phone.trim() || null,
        whatsapp: whatsapp.trim() || null,
        website: website.trim() || null,
        address: address.trim() || null,
      });
      Alert.alert("Succès", "Coordonnées de contact mises à jour.");
    } catch {
      Alert.alert("Erreur", "Échec de la sauvegarde des coordonnées.");
    }
    setSaving(false);
  };

  const resetAddForm = () => {
    setShowAddForm(false);
    setNewType("text");
    setNewTitle("");
    setNewBody("");
    setNewMediaUri(null);
  };

  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return Alert.alert("Permission refusée", "Accès galerie refusé.");
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: 300,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setNewMediaUri(result.assets[0].uri);
  };

  const pickAudio = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: "audio/*" });
    if (result.canceled || !result.assets?.[0]) return;
    setNewMediaUri(result.assets[0].uri);
  };

  const handleAddItem = async () => {
    if (!newTitle.trim()) return Alert.alert("Titre requis", "Donnez un titre à cet élément.");
    if (newType !== "text" && !newMediaUri) {
      return Alert.alert("Fichier requis", `Sélectionnez un fichier ${TYPE_LABELS[newType].toLowerCase()}.`);
    }

    setAdding(true);
    try {
      let created: HelpItem;
      if (newType === "text") {
        const form = new FormData();
        form.append("type", "text");
        form.append("title", newTitle.trim());
        if (newBody.trim()) form.append("body", newBody.trim());
        created = await api.createHelpItem(form);
      } else {
        created = await uploadHelpItemMedia(newType, newTitle, newBody, newMediaUri!);
      }
      setItems((prev) => [...prev, created]);
      resetAddForm();
    } catch (err: any) {
      Alert.alert("Erreur", err?.message ?? "Échec de l'ajout.");
    }
    setAdding(false);
  };

  const handleToggleActive = async (item: HelpItem) => {
    const nextActive = !item.is_active;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_active: nextActive } : i)));
    try {
      await api.updateHelpItem(item.id, { is_active: nextActive });
    } catch {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_active: !nextActive } : i)));
      Alert.alert("Erreur", "Échec de la mise à jour.");
    }
  };

  const handleDeleteItem = (item: HelpItem) => {
    Alert.alert("Supprimer", `Supprimer "${item.title}" ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            await api.deleteHelpItem(item.id);
            setItems((prev) => prev.filter((i) => i.id !== item.id));
          } catch {
            Alert.alert("Erreur", "Échec de la suppression.");
          }
        },
      },
    ]);
  };

  if (!isSuperAdmin) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.bg }]}>
        <Ionicons name="lock-closed" size={48} color={theme.subText} />
        <Text style={{ color: theme.subText, marginTop: 12 }}>Accès refusé</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 14 }}>
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Aide</Text>
          <Text style={[styles.headerSub, { color: theme.subText }]} numberOfLines={1}>
            Contenu & contact affichés à tous les utilisateurs
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
          {/* Coordonnées de contact */}
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Coordonnées de contact</Text>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {[
              { label: "Email", value: email, set: setEmail, keyboardType: "email-address" as const },
              { label: "Téléphone", value: phone, set: setPhone, keyboardType: "phone-pad" as const },
              { label: "WhatsApp", value: whatsapp, set: setWhatsapp, keyboardType: "phone-pad" as const },
              { label: "Site web", value: website, set: setWebsite, keyboardType: "url" as const },
              { label: "Adresse", value: address, set: setAddress, keyboardType: "default" as const },
            ].map((f) => (
              <View key={f.label} style={styles.fieldRow}>
                <Text style={[styles.fieldLabel, { color: theme.subText }]}>{f.label}</Text>
                <TextInput
                  style={[styles.fieldInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
                  value={f.value}
                  onChangeText={f.set}
                  keyboardType={f.keyboardType}
                  autoCapitalize="none"
                  placeholder="—"
                  placeholderTextColor={theme.subText}
                />
              </View>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: theme.primary, opacity: saving ? 0.6 : 1 }]}
            onPress={handleSaveContact}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? "Enregistrement…" : "Enregistrer le contact"}</Text>
          </TouchableOpacity>

          {/* Contenu d'aide */}
          <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 28 }]}>
            Contenu du guide d'utilisation
          </Text>

          {items.map((item) => (
            <View key={item.id} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, padding: 14 }]}>
              <View style={styles.itemRow}>
                <Ionicons name={TYPE_ICONS[item.type]} size={20} color={theme.primary} />
                <Text style={[styles.itemTitle, { color: theme.text }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Switch value={item.is_active} onValueChange={() => handleToggleActive(item)} />
                <TouchableOpacity onPress={() => handleDeleteItem(item)} style={{ marginLeft: 6 }}>
                  <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {!showAddForm ? (
            <TouchableOpacity
              style={[styles.addBtn, { borderColor: theme.primary }]}
              onPress={() => setShowAddForm(true)}
            >
              <Ionicons name="add-circle-outline" size={20} color={theme.primary} />
              <Text style={{ color: theme.primary, fontWeight: "600" }}>Ajouter un élément</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, padding: 14 }]}>
              <View style={styles.typeSelector}>
                {(["text", "video", "audio"] as ItemType[]).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.typeBtn,
                      {
                        borderColor: newType === t ? theme.primary : theme.border,
                        backgroundColor: newType === t ? theme.primary + "1A" : "transparent",
                      },
                    ]}
                    onPress={() => {
                      setNewType(t);
                      setNewMediaUri(null);
                    }}
                  >
                    <Ionicons name={TYPE_ICONS[t]} size={16} color={newType === t ? theme.primary : theme.subText} />
                    <Text style={{ color: newType === t ? theme.primary : theme.subText, fontSize: 13 }}>
                      {TYPE_LABELS[t]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={[styles.fieldInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg, marginTop: 10 }]}
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder="Titre"
                placeholderTextColor={theme.subText}
              />

              {newType === "text" ? (
                <TextInput
                  style={[
                    styles.fieldInput,
                    { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg, marginTop: 10, height: 100, textAlignVertical: "top" },
                  ]}
                  value={newBody}
                  onChangeText={setNewBody}
                  placeholder="Contenu du texte"
                  placeholderTextColor={theme.subText}
                  multiline
                />
              ) : (
                <TouchableOpacity
                  style={[styles.pickBtn, { borderColor: theme.border }]}
                  onPress={newType === "video" ? pickVideo : pickAudio}
                >
                  <Ionicons name="cloud-upload-outline" size={18} color={theme.primary} />
                  <Text style={{ color: theme.text, fontSize: 13, flex: 1 }} numberOfLines={1}>
                    {newMediaUri ? "Fichier sélectionné ✓" : `Choisir un fichier ${TYPE_LABELS[newType].toLowerCase()}`}
                  </Text>
                </TouchableOpacity>
              )}

              <View style={styles.formActions}>
                <TouchableOpacity onPress={resetAddForm} style={{ padding: 10 }}>
                  <Text style={{ color: theme.subText }}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: theme.primary, opacity: adding ? 0.6 : 1, flex: 1 }]}
                  onPress={handleAddItem}
                  disabled={adding}
                >
                  <Text style={styles.saveBtnText}>{adding ? "Envoi…" : "Ajouter"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  headerSub: { fontSize: 12, marginTop: 2 },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 10 },
  card: { borderRadius: 14, borderWidth: 1, marginBottom: 12, overflow: "hidden" },
  fieldRow: { padding: 12, gap: 6 },
  fieldLabel: { fontSize: 12 },
  fieldInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 },
  saveBtn: { borderRadius: 10, paddingVertical: 12, alignItems: "center", marginBottom: 8 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  itemTitle: { flex: 1, fontSize: 14, fontWeight: "500" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 4,
  },
  typeSelector: { flexDirection: "row", gap: 8 },
  typeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
  },
  pickBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
  },
  formActions: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
});
