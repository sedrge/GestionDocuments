import { Ionicons } from "@expo/vector-icons";
import { decode } from "base64-arraybuffer";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { useTenant } from "../../context/TenantContext";
import { useTheme } from "../../context/ThemeContext";

type Publication = {
  id: string;
  enterprise_id: string;
  texte: string | null;
  images: string[];
  created_at: string;
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Il y a ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `Il y a ${days}j`;
  return new Date(dateStr).toLocaleDateString("fr-FR");
}

export default function AdminPublicationsScreen() {
  const { theme } = useTheme();
  const { tenant } = useTenant();
  const [publications, setPublications] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Form state
  const [formText, setFormText] = useState("");
  const [formImages, setFormImages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const fetchPublications = useCallback(async () => {
    if (!tenant?.enterprise_id) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("enterprise_publications")
      .select("*")
      .eq("enterprise_id", tenant.enterprise_id)
      .order("created_at", { ascending: false });
    setPublications((data as Publication[]) ?? []);
    setLoading(false);
  }, [tenant?.enterprise_id]);

  useFocusEffect(useCallback(() => { fetchPublications(); }, [fetchPublications]));

  const handlePickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      return Alert.alert("Permission refusée", "Accès galerie refusé.");
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.6,
      base64: true,
    });
    if (result.canceled || !result.assets) return;
    setUploading(true);
    const urls: string[] = [];
    for (let i = 0; i < result.assets.length; i++) {
      const asset = result.assets[i];
      if (!asset.base64) continue;
      const fileName = `pub_${tenant!.enterprise_id}_${Date.now()}_${i}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("publication_images")
        .upload(fileName, decode(asset.base64), {
          contentType: "image/jpeg",
          upsert: true,
        });
      if (!upErr) {
        const { data: urlData } = supabase.storage
          .from("publication_images")
          .getPublicUrl(fileName);
        urls.push(urlData.publicUrl);
      }
    }
    setFormImages((prev) => [...prev, ...urls]);
    setUploading(false);
  };

  const handleSave = async () => {
    if (!formText.trim() && formImages.length === 0) {
      return Alert.alert("Publication vide", "Ajoutez du texte ou des images.");
    }
    if (!tenant?.enterprise_id) return;
    setSaving(true);
    const { error } = await supabase.from("enterprise_publications").insert({
      enterprise_id: tenant.enterprise_id,
      texte: formText.trim() || null,
      images: formImages,
    });
    setSaving(false);
    if (error) {
      Alert.alert("Erreur", error.message);
    } else {
      setFormText("");
      setFormImages([]);
      setShowCreate(false);
      fetchPublications();
    }
  };

  const handleDelete = (pub: Publication) => {
    Alert.alert("Supprimer", "Supprimer cette publication ?", [
      { text: "Annuler" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          // Supprimer les images du storage
          for (const url of pub.images) {
            const parts = url.split("/");
            const fileName = parts[parts.length - 1];
            await supabase.storage.from("publication_images").remove([fileName]);
          }
          await supabase.from("enterprise_publications").delete().eq("id", pub.id);
          fetchPublications();
        },
      },
    ]);
  };

  const resetForm = () => {
    setFormText("");
    setFormImages([]);
    setShowCreate(false);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Publications</Text>
          <Text style={[styles.headerSub, { color: theme.subText }]}>
            Visibles publiquement dans le fil d'actualité
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.newBtn, { backgroundColor: theme.primary }]}
          onPress={() => setShowCreate(true)}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.newBtnText}>Nouveau</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={theme.primary} />
      ) : (
        <FlatList
          data={publications}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="megaphone-outline" size={64} color={theme.border} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                Aucune publication
              </Text>
              <Text style={[styles.emptyText, { color: theme.subText }]}>
                Appuyez sur « Nouveau » pour créer votre première publication.
                {"\n"}Elle sera visible par tous vos clients.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.pubCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              {/* Card header */}
              <View style={styles.pubCardHeader}>
                <Ionicons
                  name="megaphone-outline"
                  size={15}
                  color={theme.primary}
                />
                <Text style={[styles.pubDate, { color: theme.subText }]}>
                  {timeAgo(item.created_at)}
                </Text>
                <TouchableOpacity
                  onPress={() => handleDelete(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                </TouchableOpacity>
              </View>

              {/* Text */}
              {item.texte ? (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() =>
                    setExpandedIds((prev) => {
                      const next = new Set(prev);
                      next.has(item.id) ? next.delete(item.id) : next.add(item.id);
                      return next;
                    })
                  }
                >
                  <Text
                    style={[styles.pubText, { color: theme.text }]}
                    numberOfLines={expandedIds.has(item.id) ? undefined : 3}
                  >
                    {item.texte}
                  </Text>
                  {!expandedIds.has(item.id) && item.texte.length > 120 ? (
                    <Text style={[styles.seeMore, { color: theme.primary }]}>
                      Voir plus
                    </Text>
                  ) : expandedIds.has(item.id) ? (
                    <Text style={[styles.seeMore, { color: theme.primary }]}>
                      Voir moins
                    </Text>
                  ) : null}
                </TouchableOpacity>
              ) : null}

              {/* Image thumbnails */}
              {item.images && item.images.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.thumbRow}
                >
                  {item.images.map((img, i) => (
                    <Image key={i} source={{ uri: img }} style={styles.thumb} />
                  ))}
                </ScrollView>
              ) : null}

              <Text style={[styles.imgCount, { color: theme.subText }]}>
                {item.images?.length ?? 0} image
                {(item.images?.length ?? 0) !== 1 ? "s" : ""}
              </Text>
            </View>
          )}
        />
      )}

      {/* ── Modal de création ───────────────────────────────────────────────── */}
      <Modal
        visible={showCreate}
        animationType="slide"
        onRequestClose={resetForm}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View
            style={[styles.createContainer, { backgroundColor: theme.bg }]}
          >
            {/* Header */}
            <View
              style={[
                styles.createHeader,
                {
                  backgroundColor: theme.card,
                  borderBottomColor: theme.border,
                },
              ]}
            >
              <TouchableOpacity onPress={resetForm}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
              <Text style={[styles.createTitle, { color: theme.text }]}>
                Nouvelle publication
              </Text>
              <TouchableOpacity
                style={[
                  styles.publishBtn,
                  {
                    backgroundColor:
                      saving || uploading ? theme.border : theme.primary,
                  },
                ]}
                onPress={handleSave}
                disabled={saving || uploading}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.publishBtnText}>Publier</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.createContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Zone de texte */}
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.card,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                placeholder="Quoi de neuf ? Partagez une offre, une info, un modèle disponible…"
                placeholderTextColor={theme.subText}
                multiline
                value={formText}
                onChangeText={setFormText}
                textAlignVertical="top"
              />

              {/* Prévisualisation des images sélectionnées */}
              {formImages.length > 0 ? (
                <View style={styles.previewGrid}>
                  {formImages.map((img, i) => (
                    <View key={i} style={styles.previewWrap}>
                      <Image source={{ uri: img }} style={styles.previewImg} />
                      <TouchableOpacity
                        style={styles.removeImgBtn}
                        onPress={() =>
                          setFormImages((prev) =>
                            prev.filter((_, idx) => idx !== i)
                          )
                        }
                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      >
                        <Ionicons
                          name="close-circle"
                          size={22}
                          color="#FF3B30"
                        />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Bouton ajout photos */}
              <TouchableOpacity
                style={[
                  styles.addImgBtn,
                  { borderColor: uploading ? theme.border : theme.primary },
                ]}
                onPress={handlePickImages}
                disabled={uploading}
                activeOpacity={0.75}
              >
                {uploading ? (
                  <>
                    <ActivityIndicator size="small" color={theme.primary} />
                    <Text style={[styles.addImgText, { color: theme.subText }]}>
                      Téléversement…
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons
                      name="images-outline"
                      size={20}
                      color={theme.primary}
                    />
                    <Text style={[styles.addImgText, { color: theme.primary }]}>
                      Ajouter des photos
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Info */}
              <View
                style={[
                  styles.infoBox,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Ionicons
                  name="information-circle-outline"
                  size={16}
                  color={theme.primary}
                />
                <Text style={[styles.infoText, { color: theme.subText }]}>
                  Cette publication sera visible par tous les utilisateurs du
                  catalogue dans le fil d'actualité. Vos contacts (téléphone,
                  WhatsApp…) restent ceux définis dans{" "}
                  <Text style={{ fontWeight: "700" }}>Contacts</Text>.
                </Text>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
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
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  newBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  empty: { alignItems: "center", paddingTop: 80, gap: 12, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
    marginTop: 4,
  },

  pubCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  pubCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  pubDate: { flex: 1, fontSize: 12 },
  pubText: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  seeMore: { fontSize: 13, fontWeight: "600", marginBottom: 10 },
  thumbRow: { marginBottom: 8 },
  thumb: {
    width: 76,
    height: 76,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: "#eee",
  },
  imgCount: { fontSize: 11, marginTop: 2 },

  createContainer: { flex: 1 },
  createHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  createTitle: { fontSize: 16, fontWeight: "700" },
  publishBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    minWidth: 74,
    alignItems: "center",
  },
  publishBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  createContent: { padding: 16, paddingBottom: 48 },
  textInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    fontSize: 15,
    minHeight: 150,
    marginBottom: 16,
  },
  previewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  previewWrap: { position: "relative" },
  previewImg: {
    width: 100,
    height: 100,
    borderRadius: 10,
    backgroundColor: "#eee",
  },
  removeImgBtn: { position: "absolute", top: -8, right: -8 },
  addImgBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 20,
  },
  addImgText: { fontSize: 14, fontWeight: "600" },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  infoText: { flex: 1, fontSize: 12, lineHeight: 18 },
});
