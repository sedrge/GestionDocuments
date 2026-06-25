// app/moto.tsx

import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { useTenant } from "../context/TenantContext";

type ImageItem = {
  id?: string;          // id en DB (si déjà sauvegardé)
  uri: string;          // data:image/...;base64,...
  is_principal: boolean;
  position: number;
  isNew?: boolean;      // pas encore en DB
};

export default function MotoForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { tenant } = useTenant();

  const [marque, setMarque] = useState("");
  const [modele, setModele] = useState("");
  const [categorie, setCategorie] = useState("");
  const [numeroChassis, setNumeroChassis] = useState("");
  const [numeroMoteur, setNumeroMoteur] = useState("");
  const [immatriculation, setImmatriculation] = useState("");
  const [couleur, setCouleur] = useState("");
  const [anneeFabrication, setAnneeFabrication] = useState("");
  const [type, setType] = useState("");
  const [cylindree, setCylindree] = useState("");
  const [prixAchat, setPrixAchat] = useState("");
  const [prixVente, setPrixVente] = useState("");
  const [etat, setEtat] = useState<"Neuve" | "Occasion" | "">("");

  const [images, setImages] = useState<ImageItem[]>([]);
  const [deletedImageIds, setDeletedImageIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) fetchMoto();
  }, [id]);

  const fetchMoto = async () => {
    const { data, error } = await supabase
      .from("motos")
      .select("*, moto_images(*)")
      .eq("id", id)
      .single();
    if (error || !data) {
      Alert.alert("Erreur", "Impossible de charger cette moto.");
      return;
    }
    setMarque(data.marque || "");
    setModele(data.modele || "");
    setCategorie(data.categorie || "");
    setNumeroChassis(data.numero_chassis || "");
    setNumeroMoteur(data.numero_moteur || "");
    setImmatriculation(data.immatriculation || "");
    setCouleur(data.couleur || "");
    setAnneeFabrication(data.annee_fabrication ? String(data.annee_fabrication) : "");
    setType(data.type || "");
    setCylindree(data.cylindree || "");
    setPrixAchat(data.prix_achat ? String(data.prix_achat) : "");
    setPrixVente(data.prix_vente ? String(data.prix_vente) : "");
    setEtat(data.etat || "");

    const imgs: ImageItem[] = (data.moto_images || [])
      .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
      .map((img: any) => ({
        id: img.id,
        uri: img.image_uri,
        is_principal: img.is_principal,
        position: img.position,
      }));
    setImages(imgs);
  };

  const pickImage = (source: "camera" | "gallery") => async () => {
    if (source === "camera") {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        return Alert.alert("Permission refusée", "Accès caméra refusé.");
      }
    }
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 0.5,
            base64: true,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            quality: 0.5,
            base64: true,
          });

    if (result.canceled || !result.assets) return;

    const newImages: ImageItem[] = result.assets
      .filter((a: any) => a.base64)
      .map((a: any, i: number) => ({
        uri: `data:image/jpeg;base64,${a.base64}`,
        is_principal: false,
        position: images.length + i,
        isNew: true,
      }));

    setImages((prev) => {
      const merged = [...prev, ...newImages];
      // S'il n'y a pas encore de principale, on définit la première comme principale
      if (!merged.some((m) => m.is_principal) && merged.length > 0) {
        merged[0] = { ...merged[0], is_principal: true };
      }
      return merged;
    });
  };

  const handleAddImage = () => {
    Alert.alert("Ajouter une photo", "Choisissez une source", [
      { text: "Caméra", onPress: pickImage("camera") },
      { text: "Galerie", onPress: pickImage("gallery") },
      { text: "Annuler", style: "cancel" },
    ]);
  };

  const setAsPrincipal = (index: number) => {
    setImages((prev) =>
      prev.map((img, i) => ({ ...img, is_principal: i === index })),
    );
  };

  const removeImage = (index: number) => {
    const img = images[index];
    if (img.id) {
      setDeletedImageIds((prev) => [...prev, img.id!]);
    }
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      // S'il y avait une principale supprimée, on en redéfinit une
      if (img.is_principal && next.length > 0 && !next.some((n) => n.is_principal)) {
        next[0] = { ...next[0], is_principal: true };
      }
      return next;
    });
  };

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Alert.alert("Erreur", "Utilisateur non connecté");

    setSaving(true);

    const motoData = {
      marque: marque || null,
      modele: modele || null,
      categorie: categorie || null,
      numero_chassis: numeroChassis || null,
      numero_moteur: numeroMoteur || null,
      immatriculation: immatriculation || null,
      couleur: couleur || null,
      annee_fabrication: anneeFabrication ? Number(anneeFabrication) : null,
      type: type || null,
      cylindree: cylindree || null,
      prix_achat: prixAchat ? Number(prixAchat.replace(/\s/g, "")) : null,
      prix_vente: prixVente ? Number(prixVente.replace(/\s/g, "")) : null,
      etat: etat || null,
      user_id: user.id,
      enterprise_id: tenant?.enterprise_id || null,
      updated_at: new Date().toISOString(),
    };

    try {
      let motoId = id;
      if (id) {
        const { error } = await supabase.from("motos").update(motoData).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("motos")
          .insert([motoData])
          .select("id")
          .single();
        if (error || !data) throw error || new Error("Échec de la création");
        motoId = data.id;
      }

      // Supprimer les images marquées
      if (deletedImageIds.length > 0) {
        await supabase.from("moto_images").delete().in("id", deletedImageIds);
      }

      // Mettre à jour les images existantes (is_principal, position)
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (img.id) {
          await supabase
            .from("moto_images")
            .update({ is_principal: img.is_principal, position: i })
            .eq("id", img.id);
        }
      }

      // Insérer les nouvelles images
      const newImages = images
        .map((img, i) => ({ img, index: i }))
        .filter(({ img }) => img.isNew)
        .map(({ img, index }) => ({
          moto_id: motoId,
          user_id: user.id,
          image_uri: img.uri,
          is_principal: img.is_principal,
          position: index,
        }));

      if (newImages.length > 0) {
        const { error } = await supabase.from("moto_images").insert(newImages);
        if (error) throw error;
      }

      Alert.alert("Succès", id ? "Moto mise à jour !" : "Moto enregistrée !");
      router.back();
    } catch (e: any) {
      Alert.alert("Erreur", e.message || "Échec de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f9f9f9" }}>
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#f9f9f9" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={100}
    >
      <Stack.Screen options={{ title: id ? "Modifier Moto" : "Ajouter Moto" }} />

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Photos */}
        <Text style={styles.sectionTitle}>PHOTOS</Text>
        <Text style={styles.hint}>
          Tappez sur une photo pour la définir comme principale. La photo principale est celle affichée dans la liste.
        </Text>
        <View style={styles.imagesGrid}>
          {images.map((img, i) => (
            <View key={img.id || `new-${i}`} style={styles.imageBox}>
              <TouchableOpacity onPress={() => setAsPrincipal(i)} activeOpacity={0.8}>
                <Image source={{ uri: img.uri }} style={styles.imageThumb} />
                {img.is_principal && (
                  <View style={styles.principalBadge}>
                    <Ionicons name="star" size={12} color="#fff" />
                    <Text style={styles.principalBadgeText}>Principale</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeImage(i)} style={styles.removeImageBtn}>
                <Ionicons name="close" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.imageAddBox} onPress={handleAddImage}>
            <Ionicons name="camera-outline" size={28} color="#999" />
            <Text style={styles.imageAddText}>Ajouter</Text>
          </TouchableOpacity>
        </View>

        {/* Identité de la moto */}
        <Text style={styles.sectionTitle}>IDENTITÉ</Text>
        <View style={styles.row}>
          <View style={styles.flex1}>
            <Text style={styles.label}>Marque</Text>
            <TextInput value={marque} onChangeText={setMarque} style={styles.input} placeholder="Ex: Yamaha" />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.label}>Modèle</Text>
            <TextInput value={modele} onChangeText={setModele} style={styles.input} placeholder="Ex: Sirius" />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.flex1}>
            <Text style={styles.label}>Type</Text>
            <TextInput value={type} onChangeText={setType} style={styles.input} placeholder="Ex: 115" />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.label}>Catégorie</Text>
            <TextInput
              value={categorie}
              onChangeText={setCategorie}
              style={styles.input}
              placeholder="Scooter, Sport, Tricycle..."
            />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.flex1}>
            <Text style={styles.label}>Couleur</Text>
            <TextInput value={couleur} onChangeText={setCouleur} style={styles.input} placeholder="Noir, Rouge..." />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.label}>Cylindrée</Text>
            <TextInput value={cylindree} onChangeText={setCylindree} style={styles.input} placeholder="125cc, 150cc..." />
          </View>
        </View>
        <Text style={styles.label}>Année de fabrication</Text>
        <TextInput
          value={anneeFabrication}
          onChangeText={setAnneeFabrication}
          style={styles.input}
          placeholder="Ex: 2024"
          keyboardType="numeric"
          maxLength={4}
        />

        {/* Numéros */}
        <Text style={styles.sectionTitle}>NUMÉROS</Text>
        <Text style={styles.label}>N° Châssis (VIN)</Text>
        <TextInput
          value={numeroChassis}
          onChangeText={setNumeroChassis}
          style={styles.input}
          placeholder="Ex: MH3RG2810NJ123456"
          autoCapitalize="characters"
        />
        <Text style={styles.label}>N° Moteur</Text>
        <TextInput
          value={numeroMoteur}
          onChangeText={setNumeroMoteur}
          style={styles.input}
          placeholder="Ex: 1S4-1234567"
          autoCapitalize="characters"
        />
        <Text style={styles.label}>Immatriculation</Text>
        <TextInput
          value={immatriculation}
          onChangeText={setImmatriculation}
          style={styles.input}
          placeholder="Ex: 11 AB 1234"
          autoCapitalize="characters"
        />

        {/* État */}
        <Text style={styles.sectionTitle}>ÉTAT</Text>
        <View style={styles.radioRow}>
          {(["Neuve", "Occasion"] as const).map((opt) => (
            <TouchableOpacity
              key={opt}
              onPress={() => setEtat(etat === opt ? "" : opt)}
              style={[styles.radio, etat === opt && styles.radioActive]}
            >
              <Text style={[styles.radioText, etat === opt && styles.radioTextActive]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Prix */}
        <Text style={styles.sectionTitle}>PRIX</Text>
        <View style={styles.row}>
          <View style={styles.flex1}>
            <Text style={styles.label}>Prix d'achat (FCFA)</Text>
            <TextInput
              value={prixAchat}
              onChangeText={setPrixAchat}
              style={styles.input}
              placeholder="0"
              keyboardType="numeric"
            />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.label}>Prix de vente (FCFA)</Text>
            <TextInput
              value={prixVente}
              onChangeText={setPrixVente}
              style={styles.input}
              placeholder="0"
              keyboardType="numeric"
            />
          </View>
        </View>

        <TouchableOpacity onPress={handleSave} style={styles.saveBtn} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>{id ? "METTRE À JOUR" : "ENREGISTRER LA MOTO"}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 80 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    marginTop: 20,
    marginBottom: 4,
    color: "#FF9500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  hint: { fontSize: 11, color: "#888", fontStyle: "italic", marginTop: 4 },
  label: { fontSize: 13, fontWeight: "600", marginTop: 12, color: "#444" },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#fff",
    marginTop: 5,
    fontSize: 15,
  },
  row: { flexDirection: "row", gap: 10 },
  flex1: { flex: 1 },
  imagesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
  },
  imageBox: {
    width: 100,
    height: 100,
    position: "relative",
  },
  imageThumb: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: "#eee",
  },
  imageAddBox: {
    width: 100,
    height: 100,
    borderWidth: 1,
    borderColor: "#ccc",
    borderStyle: "dashed",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  imageAddText: { fontSize: 11, color: "#999", marginTop: 4 },
  principalBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,149,0,0.95)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  principalBadgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  removeImageBtn: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#ff4444",
    borderRadius: 11,
    width: 22,
    height: 22,
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
  },
  radioRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  radio: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  radioActive: { backgroundColor: "#FF9500", borderColor: "#FF9500" },
  radioText: { fontSize: 14, color: "#444", fontWeight: "600" },
  radioTextActive: { color: "#fff" },
  saveBtn: {
    marginTop: 30,
    backgroundColor: "#FF9500",
    padding: 18,
    borderRadius: 10,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
