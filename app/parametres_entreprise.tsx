// app/parametres_entreprise.tsx

import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Stack, useRouter } from "expo-router";
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
import { applyTenantFilter, getTenantFilter, isSuperAdmin, TenantFilter } from "../lib/tenant";

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
  const [saving, setSaving] = useState(false);

  const [paramId, setParamId] = useState<string | null>(null);
  const [nomEntreprise, setNomEntreprise] = useState("");
  const [prefixFacture, setPrefixFacture] = useState("");
  const [prefixAuto, setPrefixAuto] = useState(true);
  const [sousTitre, setSousTitre] = useState("");
  const [articlesVente, setArticlesVente] = useState("");
  const [telephone, setTelephone] = useState("");
  const [adresse, setAdresse] = useState("");
  const [localisation, setLocalisation] = useState("");
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tenantFilter, setTenantFilter] = useState<TenantFilter | null>(null);
  const [isSuper, setIsSuper] = useState(false);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    setLoading(true);
    const superAdmin = await isSuperAdmin();
    setIsSuper(superAdmin);
    const filter = await getTenantFilter();
    setTenantFilter(filter);
    if (!superAdmin || filter.entreprise_id) {
      await fetchParametres(filter);
    }
    setLoading(false);
  };

  const fetchParametres = async (filter?: TenantFilter) => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const usedFilter = filter || tenantFilter || (await getTenantFilter());
    let query: any = supabase.from('entreprise_parametres').select('*');
    query = applyTenantFilter(query, usedFilter);
    const { data } = await query.maybeSingle();

    if (data) {
      setParamId(data.id);
      setNomEntreprise(data.nom_entreprise || "");
      setPrefixFacture(data.prefix_facture || "");
      setPrefixAuto(false); // l'utilisateur a déjà choisi
      setSousTitre(data.sous_titre || "");
      setArticlesVente(data.articles_vente || "");
      setTelephone(data.telephone || "");
      setAdresse(data.adresse || "");
      setLocalisation(data.localisation || "");
      setLogoUri(data.logo_uri || null);
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
            base64: true,
          });
          if (!result.canceled && result.assets?.[0]?.base64) {
            setLogoUri(`data:image/jpeg;base64,${result.assets[0].base64}`);
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
            base64: true,
          });
          if (!result.canceled && result.assets?.[0]?.base64) {
            setLogoUri(`data:image/jpeg;base64,${result.assets[0].base64}`);
          }
        },
      },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () => setLogoUri(null),
      },
      { text: "Annuler", style: "cancel" },
    ]);
  };

  const handleSave = async () => {
    if (!nomEntreprise.trim())
      return Alert.alert("Erreur", "Le nom de l'entreprise est requis.");
    if (!prefixFacture.trim())
      return Alert.alert("Erreur", "Le préfixe de facture est requis.");

    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return Alert.alert("Erreur", "Session expirée.");
    }

    const filter = tenantFilter || (await getTenantFilter());
    const payload = {
      user_id: user.id,
      entreprise_id: filter.entreprise_id || null,
      nom_entreprise: nomEntreprise.trim(),
      prefix_facture: prefixFacture.trim().toUpperCase(),
      sous_titre: sousTitre.trim(),
      articles_vente: articlesVente.trim(),
      telephone: telephone.trim(),
      adresse: adresse.trim(),
      localisation: localisation.trim(),
      logo_uri: logoUri || '',
      updated_at: new Date().toISOString(),
    };

    if (isSuper && !(tenantFilter?.entreprise_id)) {
      setSaving(false);
      return Alert.alert(
        'Sélection entreprise requise',
        "Sélectionnez d'abord une entreprise en tant que super-admin avant de modifier ses paramètres.",
      );
    }

    let result;
    if (paramId) {
      result = await supabase
        .from('entreprise_parametres')
        .update(payload)
        .eq('id', paramId);
    } else {
      result = await supabase.from('entreprise_parametres').insert([payload]);
    }

    setSaving(false);

    if (result.error) {
      Alert.alert("Erreur", result.error.message);
    } else {
      Alert.alert("Succès", "Paramètres enregistrés.");
      router.back();
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
            {logoUri ? (
              <Image
                source={{ uri: logoUri }}
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
              {!!adresse && <Text style={styles.previewLigne}>{adresse}</Text>}
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
          {logoUri ? (
            <Image
              source={{ uri: logoUri }}
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
            <Ionicons name="cloud-download-outline" size={20} color="#4ECDC4" />
            <Text style={styles.ressourcesBtnText}>Ressources Consommées</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </View>
        </TouchableOpacity>
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
