// app/parametres_entreprise.tsx

import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
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
import { AuthImage } from "../components/AuthImage";
import { useTenant } from "../context/TenantContext";
import { api } from "../lib/api";
import { localUriToFormFile } from "../lib/formUpload";
import { uploadEnterpriseLogo } from "../lib/multitenant";

// Génère un préfixe à partir du nom de l'entreprise.
// Ex: "Fortune Service" -> "FS"  /  "Fortune Service Pro" -> "FSP"
// (max 4 lettres, en majuscules)
export function genererPrefix(nom: string): string {
  if (!nom) return "";
  const parts = nom
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  let initiales = parts
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  if (initiales.length === 0 && nom.length > 0) {
    initiales = nom.substring(0, 2).toUpperCase();
  }
  // L'utilisateur disait FC pour "Fortune Service" -> on garde max 4
  return initiales.substring(0, 4);
}

export default function ParametresEntrepriseScreen() {
  const router = useRouter();
  const { tenant, isEnterpriseAdmin } = useTenant();
  const [saving, setSaving] = useState(false);

  const [nomEntreprise, setNomEntreprise] = useState("");
  const [prefixFacture, setPrefixFacture] = useState("");
  const [prefixAuto, setPrefixAuto] = useState(true);
  const [sousTitre, setSousTitre] = useState("");
  const [articlesVente, setArticlesVente] = useState("");
  const [telephone, setTelephone] = useState("");
  const [adresse, setAdresse] = useState("");
  const [localisation, setLocalisation] = useState("");
  // Logo existant (côté serveur, disque privé) vs nouvelle photo tout juste
  // choisie (URI locale) : deux états distincts car l'affichage de l'un
  // nécessite le header Authorization (AuthImage) et pas l'autre.
  const [hasExistingLogo, setHasExistingLogo] = useState(false);
  const [newLogoUri, setNewLogoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tenant?.enterprise_id) fetchParametres();
  }, [tenant?.enterprise_id]);

  const fetchParametres = async () => {
    if (!tenant?.enterprise_id) return;
    setLoading(true);
    try {
      const data = await api.getEnterpriseSettings(tenant.enterprise_id);
      if (data) {
        setNomEntreprise(data.nom_entreprise || "");
        setPrefixFacture(data.prefix_facture || "");
        setPrefixAuto(false); // l'utilisateur a déjà choisi
        setSousTitre(data.sous_titre || "");
        setArticlesVente(data.articles_vente || "");
        setTelephone(data.telephone || "");
        setAdresse(data.adresse || "");
        setLocalisation(data.localisation || "");
        setHasExistingLogo(!!data.logo_uri);
      }
    } catch (e: any) {
      Alert.alert(
        "Erreur",
        e.message || "Impossible de charger les paramètres.",
      );
    }
    setLoading(false);
  };

  const handleNomChange = (val: string) => {
    setNomEntreprise(val);
    if (prefixAuto) {
      setPrefixFacture(genererPrefix(val));
    }
  };

  const handlePrefixChange = (val: string) => {
    setPrefixAuto(false);
    setPrefixFacture(val.toUpperCase().substring(0, 6));
  };

  const pickLogo = () => {
    Alert.alert("Logo / Image d'entête", "Choisissez une source", [
      {
        text: "Caméra",
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== "granted")
            return Alert.alert("Permission refusée", "Accès caméra refusé.");
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.5,
          });
          if (!result.canceled && result.assets?.[0]?.uri) {
            setNewLogoUri(result.assets[0].uri);
          }
        },
      },
      {
        text: "Galerie",
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.5,
          });
          if (!result.canceled && result.assets?.[0]?.uri) {
            setNewLogoUri(result.assets[0].uri);
          }
        },
      },
      { text: "Annuler", style: "cancel" },
    ]);
  };

  const handleSave = async () => {
    if (!tenant?.enterprise_id)
      return Alert.alert("Erreur", "Entreprise introuvable.");
    if (!nomEntreprise.trim())
      return Alert.alert("Erreur", "Le nom de l'entreprise est requis.");
    if (!prefixFacture.trim())
      return Alert.alert("Erreur", "Le préfixe de facture est requis.");

    setSaving(true);
    const form = new FormData();
    form.append("nom_entreprise", nomEntreprise.trim());
    form.append("prefix_facture", prefixFacture.trim().toUpperCase());
    form.append("sous_titre", sousTitre.trim());
    form.append("articles_vente", articlesVente.trim());
    form.append("telephone", telephone.trim());
    form.append("adresse", adresse.trim());
    form.append("localisation", localisation.trim());
    if (newLogoUri) {
      form.append("logo", localUriToFormFile(newLogoUri, "logo") as any);
    }

    try {
      await api.updateEnterpriseSettings(form, tenant.enterprise_id);
      if (newLogoUri) {
        const logoResult = await uploadEnterpriseLogo(
          tenant.enterprise_id,
          newLogoUri,
        );
        if (!logoResult.success) {
          return Alert.alert(
            "Logo non enregistré",
            logoResult.error ||
              "Les paramètres ont été enregistrés, mais le logo de l'entreprise n'a pas pu être mis à jour.",
          );
        }
      }
      Alert.alert("Succès", "Paramètres enregistrés.");
      router.back();
    } catch (e: any) {
      Alert.alert("Erreur", e.message || "Échec de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Stack.Screen options={{ title: "Paramètres entreprise" }} />
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f9f9f9" }}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: "#f9f9f9" }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={100}
      >
        <Stack.Screen options={{ title: "Paramètres entreprise" }} />

        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {/* Aperçu */}
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>Aperçu de l'entête</Text>
            <View style={styles.previewHeader}>
              {newLogoUri ? (
                <Image
                  source={{ uri: newLogoUri }}
                  style={styles.previewLogo}
                  resizeMode="contain"
                />
              ) : hasExistingLogo ? (
                <AuthImage
                  uri={api.enterpriseLogoUrl(tenant?.enterprise_id ?? "")}
                  style={styles.previewLogo}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.previewLogoEmpty}>
                  <Ionicons name="image-outline" size={28} color="#aaa" />
                </View>
              )}
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.previewNom} numberOfLines={1}>
                  {nomEntreprise || "Nom de l'entreprise"}
                </Text>
                {!!sousTitre && (
                  <Text style={styles.previewSousTitre}>{sousTitre}</Text>
                )}
                {!!telephone && (
                  <Text style={styles.previewLigne}>Tél: {telephone}</Text>
                )}
                {!!adresse && (
                  <Text style={styles.previewLigne}>{adresse}</Text>
                )}
                {!!localisation && (
                  <Text style={styles.previewLigne}>{localisation}</Text>
                )}
              </View>
            </View>
            <View style={styles.previewFactureBox}>
              <Text style={styles.previewFactureLabel}>FACTURE N°</Text>
              <Text style={styles.previewFactureNum}>
                {prefixFacture || "XX"}_00001_{new Date().getFullYear()}
              </Text>
            </View>
          </View>

          {/* Logo / image */}
          <Text style={styles.sectionTitle}>LOGO / IMAGE D'ENTÊTE</Text>
          <TouchableOpacity
            style={styles.logoZone}
            onPress={pickLogo}
            activeOpacity={0.7}
          >
            {newLogoUri ? (
              <Image
                source={{ uri: newLogoUri }}
                style={styles.logoPreview}
                resizeMode="contain"
              />
            ) : hasExistingLogo ? (
              <AuthImage
                uri={api.enterpriseLogoUrl(tenant?.enterprise_id ?? "")}
                style={styles.logoPreview}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.logoEmpty}>
                <Ionicons name="camera-outline" size={36} color="#999" />
                <Text style={styles.logoEmptyText}>
                  Toucher pour ajouter une image
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Identité */}
          <Text style={styles.sectionTitle}>IDENTITÉ</Text>
          <Text style={styles.label}>Nom de l'entreprise *</Text>
          <TextInput
            value={nomEntreprise}
            onChangeText={handleNomChange}
            style={styles.input}
            placeholder="Ex: Fortune Service"
          />

          <Text style={styles.label}>Préfixe facture (généré auto)</Text>
          <TextInput
            value={prefixFacture}
            onChangeText={handlePrefixChange}
            style={styles.input}
            placeholder="Ex: FS"
            autoCapitalize="characters"
          />
          <Text style={styles.hint}>
            Format du numéro: {prefixFacture || "XX"}_00001_
            {new Date().getFullYear()}. Réinitialisé chaque 1er janvier.
          </Text>

          <Text style={styles.label}>Sous-titre / Activité</Text>
          <TextInput
            value={sousTitre}
            onChangeText={setSousTitre}
            style={styles.input}
            placeholder="Ex: Vente de motos et Ordinateurs"
          />

          <Text style={styles.label}>Articles en vente</Text>
          <TextInput
            value={articlesVente}
            onChangeText={setArticlesVente}
            style={[styles.input, { minHeight: 70 }]}
            placeholder="Ex: Motos, Scooters, Ordinateurs, ..."
            multiline
          />

          {/* Contact */}
          <Text style={styles.sectionTitle}>CONTACTS & ADRESSE</Text>
          <Text style={styles.label}>Téléphone(s)</Text>
          <TextInput
            value={telephone}
            onChangeText={setTelephone}
            style={styles.input}
            placeholder="Ex: +226 77 91 94 70 / 61 31 81 65"
          />

          <Text style={styles.label}>Adresse</Text>
          <TextInput
            value={adresse}
            onChangeText={setAdresse}
            style={styles.input}
            placeholder="Ex: Sis à Bilbalogho vers le Fespaco / Ouagadougou - BF"
          />

          <Text style={styles.label}>Localisation (optionnel)</Text>
          <TextInput
            value={localisation}
            onChangeText={setLocalisation}
            style={styles.input}
            placeholder="Ex: Coordonnées GPS, repère..."
          />

          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          >
            <Text style={styles.saveBtnText}>
              {saving ? "Enregistrement..." : "ENREGISTRER"}
            </Text>
          </TouchableOpacity>

          {/* Ressources */}
          <TouchableOpacity
            onPress={() => router.push("/ressources")}
            style={styles.ressourcesBtn}
          >
            <View style={styles.ressourcesBtnContent}>
              <Ionicons
                name="cloud-download-outline"
                size={20}
                color="#4ECDC4"
              />
              <Text style={styles.ressourcesBtnText}>
                Ressources Consommées
              </Text>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </View>
          </TouchableOpacity>

          {/* Abonnement — réservé à l'administrateur de l'entreprise, seul
            habilité à consulter et régler l'abonnement. */}
          {isEnterpriseAdmin && (
            <TouchableOpacity
              onPress={() => router.push("/abonnement")}
              style={[styles.ressourcesBtn, { borderColor: "#30B0C7" }]}
            >
              <View style={styles.ressourcesBtnContent}>
                <Ionicons name="pricetag-outline" size={20} color="#30B0C7" />
                <Text style={styles.ressourcesBtnText}>Abonnement</Text>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </View>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 60 },
  previewCard: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    marginBottom: 10,
  },
  previewTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#888",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  previewHeader: { flexDirection: "row", alignItems: "center" },
  previewLogo: { width: 80, height: 60 },
  previewLogoEmpty: {
    width: 80,
    height: 60,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 4,
  },
  previewNom: {
    fontSize: 16,
    fontWeight: "800",
    color: "#3d2c66",
  },
  previewSousTitre: { fontSize: 11, color: "#444", marginTop: 1 },
  previewLigne: { fontSize: 10, color: "#555", marginTop: 1 },
  previewFactureBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  previewFactureLabel: { fontSize: 11, fontWeight: "700", color: "#333" },
  previewFactureNum: { fontSize: 12, fontWeight: "700", color: "#007AFF" },

  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    marginTop: 22,
    marginBottom: 4,
    color: "#007AFF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  label: { fontSize: 13, fontWeight: "600", marginTop: 12, color: "#444" },
  hint: { fontSize: 11, color: "#888", marginTop: 4, fontStyle: "italic" },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#fff",
    marginTop: 5,
    fontSize: 15,
  },
  logoZone: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    borderStyle: "dashed",
    borderRadius: 10,
    backgroundColor: "#fff",
    overflow: "hidden",
    minHeight: 140,
  },
  logoPreview: { width: "100%", height: 140 },
  logoEmpty: {
    height: 140,
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  logoEmptyText: { color: "#666", fontSize: 12 },
  saveBtn: {
    backgroundColor: "#007AFF",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 30,
  },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  ressourcesBtn: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#4ECDC4",
  },
  ressourcesBtnContent: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    justifyContent: "space-between",
  },
  ressourcesBtnText: {
    color: "#333",
    fontWeight: "700",
    fontSize: 15,
    flex: 1,
    marginLeft: 12,
  },
});
