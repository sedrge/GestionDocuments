// app/decharge.tsx

import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
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
import SignatureCanvas from "react-native-signature-canvas";
import { AuthImage } from "../components/AuthImage";
import { useTenant } from "../context/TenantContext";
import { api } from "../lib/api";
import { appendMaybeImage, buildFormData } from "../lib/formUpload";
import { nombreEnLettres } from "../lib/nombreEnLettres";

// Une valeur "locale" (data:/file:/content:) vient d'être capturée sur cet
// écran ; une valeur "distante" est un chemin de stockage renvoyé par le
// serveur (mode édition) — pas directement affichable, ni à ré-uploader.
function isLocalUri(v: string | null): boolean {
  return !!v && (v.startsWith("data:") || v.includes("://"));
}
function localOnly(v: string | null): string | null {
  return isLocalUri(v) ? v : null;
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── Composant signature isolé (HORS du composant principal) ─────────────────
interface SignatureBlockProps {
  title: string;
  signatureString: string | null;
  remoteUrl?: string;
  onScrollLock: (locked: boolean) => void;
  onValidate: (sig: string) => void;
  onClear: () => void;
}

const webStyle = `
  .m-signature-pad--footer { display: none; margin: 0px; }
  body, html { width: 100%; height: 100%; overflow: hidden; background-color: #fff; }
  .m-signature-pad { border: none; box-shadow: none; }
`;

function SignatureBlock({ title, signatureString, remoteUrl, onScrollLock, onValidate, onClear }: SignatureBlockProps) {
  const sigRef = useRef<any>(null);

  return (
    <View style={{ marginTop: 20 }}>
      <Text style={sigStyles.label}>{title}</Text>
      <View style={sigStyles.signatureContainer}>
        <View style={sigStyles.signatureBox}>
          <SignatureCanvas
            ref={sigRef}
            onOK={(sig: string) => {
              onScrollLock(false);
              onValidate(sig);
              Alert.alert("Succès", "Signature capturée !");
            }}
            onBegin={() => onScrollLock(true)}
            onEnd={() => onScrollLock(false)}
            descriptionText=""
            webStyle={webStyle}
          />
        </View>
        <View style={sigStyles.buttonRow}>
          <TouchableOpacity
            onPress={() => {
              sigRef.current?.clearSignature();
              onClear();
            }}
            style={[sigStyles.sigBtn, { backgroundColor: "#ff4444" }]}
          >
            <Text style={sigStyles.btnText}>Effacer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => sigRef.current?.readSignature()}
            style={[sigStyles.sigBtn, { backgroundColor: "#4CAF50" }]}
          >
            <Text style={sigStyles.btnText}>Valider</Text>
          </TouchableOpacity>
        </View>
      </View>
      {signatureString ? (
        <View style={sigStyles.previewContainer}>
          <Text style={{ fontSize: 12, color: "gray" }}>Signature mémorisée ✓</Text>
          {isLocalUri(signatureString) ? (
            <Image
              source={{ uri: signatureString }}
              style={sigStyles.sigPreview}
              resizeMode="contain"
            />
          ) : remoteUrl ? (
            <AuthImage uri={remoteUrl} style={sigStyles.sigPreview} resizeMode="contain" />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// ─── Composant photo recto/verso ─────────────────────────────────────────────
interface PhotoPickerProps {
  label: string;
  uri: string | null;
  remoteUrl?: string;
  aspect: [number, number];
  onPick: () => void;
  onClear: () => void;
}

function PhotoPicker({ label, uri, remoteUrl, aspect, onPick, onClear }: PhotoPickerProps) {
  const ratio = aspect[0] / aspect[1];
  return (
    <View style={photoStyles.container}>
      <Text style={photoStyles.label}>{label}</Text>
      <TouchableOpacity
        onPress={onPick}
        style={[photoStyles.zone, { aspectRatio: ratio }]}
        activeOpacity={0.7}
      >
        {uri && isLocalUri(uri) ? (
          <Image source={{ uri }} style={photoStyles.preview} resizeMode="cover" />
        ) : remoteUrl ? (
          <AuthImage uri={remoteUrl} style={photoStyles.preview} resizeMode="cover" />
        ) : (
          <View style={photoStyles.empty}>
            <View style={photoStyles.frameGuide} />
            <Ionicons name="camera-outline" size={32} color="#999" />
            <Text style={photoStyles.emptyText}>Toucher pour ajouter</Text>
            <Text style={photoStyles.hintText}>
              Cadrez la pièce dans le repère, puis recadrez après la prise.
            </Text>
          </View>
        )}
      </TouchableOpacity>
      {uri ? (
        <View style={photoStyles.actionsRow}>
          <TouchableOpacity onPress={onPick} style={photoStyles.actionBtn}>
            <Ionicons name="refresh" size={14} color="#fff" />
            <Text style={photoStyles.actionText}>Remplacer</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClear} style={[photoStyles.actionBtn, { backgroundColor: "#ff4444" }]}>
            <Ionicons name="trash-outline" size={14} color="#fff" />
            <Text style={photoStyles.actionText}>Supprimer</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const photoStyles = StyleSheet.create({
  container: { marginTop: 12 },
  label: { fontSize: 13, fontWeight: "600", color: "#444", marginBottom: 6 },
  zone: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderStyle: "dashed",
    borderRadius: 10,
    backgroundColor: "#fff",
    overflow: "hidden",
    width: "100%",
  },
  preview: { width: "100%", height: "100%" },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", gap: 4, padding: 10 },
  emptyText: { color: "#666", fontSize: 13, fontWeight: "600" },
  hintText: { color: "#999", fontSize: 10, textAlign: "center", marginTop: 2 },
  frameGuide: {
    position: "absolute",
    top: "10%",
    left: "8%",
    right: "8%",
    bottom: "10%",
    borderWidth: 2,
    borderColor: "#FF9500",
    borderStyle: "dashed",
    borderRadius: 6,
  },
  actionsRow: { flexDirection: "row", gap: 8, marginTop: 6 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FF9500",
    paddingVertical: 8,
    borderRadius: 6,
  },
  actionText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  radioRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  radio: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  radioActive: { backgroundColor: "#FF9500", borderColor: "#FF9500" },
  radioText: { fontSize: 13, color: "#444", fontWeight: "600" },
  radioTextActive: { color: "#fff" },
});
// ─────────────────────────────────────────────────────────────────────────────

const sigStyles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: "600", marginTop: 12, color: "#444" },
  signatureContainer: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#000",
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  signatureBox: { width: "100%", height: 200 },
  buttonRow: {
    flexDirection: "row",
    height: 50,
    borderTopWidth: 1,
    borderColor: "#eee",
  },
  sigBtn: { flex: 1, justifyContent: "center", alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "bold" },
  previewContainer: {
    alignItems: "center",
    marginTop: 10,
    padding: 10,
    backgroundColor: "#e8f5e9",
    borderRadius: 8,
  },
  sigPreview: { width: 150, height: 80 },
});
// ─────────────────────────────────────────────────────────────────────────────

export default function DechargeForm() {
  const { dossierId, id } = useLocalSearchParams();
  const router = useRouter();
  const { tenant } = useTenant();

  const getTodayDateFR = () => {
    const now = new Date();
    const j = String(now.getDate()).padStart(2, "0");
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const a = now.getFullYear();
    return `${j}/${m}/${a}`;
  };

  const [date, setDate] = useState(getTodayDateFR());
  const [lieu, setLieu] = useState("Ouagadougou");

  const [nomVendeur, setNomVendeur] = useState("");
  const [cnibVendeur, setCnibVendeur] = useState("");
  const [telephoneVendeur, setTelephoneVendeur] = useState("");

  const [nomAcheteur, setNomAcheteur] = useState("");
  const [cnibAcheteur, setCnibAcheteur] = useState("");
  const [telephoneAcheteur, setTelephoneAcheteur] = useState("");

  const [nomRepresentant, setNomRepresentant] = useState("");
  const [cnibRepresentant, setCnibRepresentant] = useState("");

  const [marque, setMarque] = useState("Yamaha");
  const [modele, setModele] = useState("");
  const [couleur, setCouleur] = useState("");
  const [numeroChassis, setNumeroChassis] = useState("");
  const [immatriculation, setImmatriculation] = useState("");

  const [prix, setPrix] = useState("");
  const [prixLettres, setPrixLettres] = useState("");

  const [signatureVendeur, setSignatureVendeur] = useState<string | null>(null);
  const [signatureAcheteur, setSignatureAcheteur] = useState<string | null>(null);

  const [vendeurIdType, setVendeurIdType] = useState<"cnib" | "passport">("cnib");
  const [vendeurIdRecto, setVendeurIdRecto] = useState<string | null>(null);
  const [vendeurIdVerso, setVendeurIdVerso] = useState<string | null>(null);
  const [carteGriseRecto, setCarteGriseRecto] = useState<string | null>(null);
  const [carteGriseVerso, setCarteGriseVerso] = useState<string | null>(null);

  const [scrollEnabled, setScrollEnabled] = useState(true);

  const remoteFileUrl = (field: string) =>
    id ? api.fileUrl("decharges", String(id), field) : undefined;

  const pickPhoto = (
    setter: (uri: string | null) => void,
    aspect: [number, number] = [85, 54],
  ) => {
    Alert.alert("Ajouter une photo", "Choisissez une source", [
      {
        text: "Caméra",
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== "granted") {
            return Alert.alert("Permission refusée", "Accès caméra refusé.");
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect,
            quality: 0.5,
          });
          if (!result.canceled && result.assets?.[0]?.uri) {
            setter(result.assets[0].uri);
          }
        },
      },
      {
        text: "Galerie",
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect,
            quality: 0.5,
          });
          if (!result.canceled && result.assets?.[0]?.uri) {
            setter(result.assets[0].uri);
          }
        },
      },
      { text: "Annuler", style: "cancel" },
    ]);
  };

  // CNIB & carte grise = format carte (≈ 85×54 mm) ; passeport = page portrait
  const ID_ASPECT: [number, number] = [85, 54];
  const PASSPORT_ASPECT: [number, number] = [88, 125];

  useEffect(() => {
    if (id) fetchDecharge();
  }, [id]);

  const handlePrixChange = (val: string) => {
    setPrix(val);
    const num = parseInt(val.replace(/\s/g, ""), 10);
    if (!isNaN(num) && num > 0) {
      setPrixLettres(nombreEnLettres(num));
    } else {
      setPrixLettres("");
    }
  };

  const fetchDecharge = async () => {
    let data: any;
    try {
      data = await api.getDecharge(String(id));
    } catch {
      Alert.alert("Erreur", "Impossible de charger cette décharge.");
      return;
    }

    if (data.date) {
      const parts = data.date.split("-");
      if (parts.length === 3) setDate(`${parts[2]}/${parts[1]}/${parts[0]}`);
    }

    setLieu(data.lieu || "Ouagadougou");
    setNomVendeur(data.nom_vendeur || "");
    setCnibVendeur(data.cnib_vendeur || "");
    setTelephoneVendeur(data.telephone_vendeur || "");
    setNomAcheteur(data.nom_acheteur || "");
    setCnibAcheteur(data.cnib_acheteur || "");
    setTelephoneAcheteur(data.telephone_acheteur || "");
    setNomRepresentant(data.nom_representant || "");
    setCnibRepresentant(data.cnib_representant || "");
    setMarque(data.marque || "Yamaha");
    setModele(data.modele || "");
    setCouleur(data.couleur || "");
    setNumeroChassis(data.numero_chassis || "");
    setImmatriculation(data.immatriculation || "");
    setPrix(data.prix ? String(data.prix) : "");
    setPrixLettres(data.prix_lettres || "");
    setSignatureVendeur(data.signature_uri || null);
    setSignatureAcheteur(data.signature_acheteur_uri || null);
    setVendeurIdType((data.vendeur_id_type === "passport" ? "passport" : "cnib"));
    setVendeurIdRecto(data.vendeur_id_recto || null);
    setVendeurIdVerso(data.vendeur_id_verso || null);
    setCarteGriseRecto(data.carte_grise_recto || null);
    setCarteGriseVerso(data.carte_grise_verso || null);
  };

  const handleSave = async () => {
    if (!nomVendeur.trim()) return Alert.alert("Erreur", "Nom du vendeur requis.");
    if (!signatureVendeur) return Alert.alert("Erreur", "Veuillez valider la signature du vendeur.");
    if (!signatureAcheteur) return Alert.alert("Erreur", "Veuillez valider la signature de l'acheteur/représentant.");

    let dateBDD = date;
    const parts = date.split("/");
    if (parts.length === 3) {
      dateBDD = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }

    const form = buildFormData({
      date: dateBDD,
      lieu,
      nom_vendeur: nomVendeur,
      cnib_vendeur: cnibVendeur,
      telephone_vendeur: telephoneVendeur,
      nom_acheteur: nomAcheteur,
      cnib_acheteur: cnibAcheteur,
      telephone_acheteur: telephoneAcheteur,
      nom_representant: nomRepresentant,
      cnib_representant: cnibRepresentant,
      marque,
      modele,
      couleur,
      numero_chassis: numeroChassis,
      immatriculation,
      prix: prix ? Number(prix.replace(/\s/g, "")) : null,
      prix_lettres: prixLettres,
      vendeur_id_type: vendeurIdType,
      annee_mois_id: id ? null : dossierId,
      enterprise_id: id ? null : tenant?.enterprise_id ?? null,
    });

    // Les champs fichiers ne sont ajoutés que s'ils contiennent une NOUVELLE
    // capture locale — une valeur "à distance" (mode édition) signifie
    // "inchangé", on ne la ré-envoie pas.
    await appendMaybeImage(form, "signature_uri", localOnly(signatureVendeur));
    await appendMaybeImage(form, "signature_acheteur_uri", localOnly(signatureAcheteur));
    await appendMaybeImage(form, "vendeur_id_recto", localOnly(vendeurIdRecto));
    if (vendeurIdType !== "passport") {
      await appendMaybeImage(form, "vendeur_id_verso", localOnly(vendeurIdVerso));
    }
    await appendMaybeImage(form, "carte_grise_recto", localOnly(carteGriseRecto));
    await appendMaybeImage(form, "carte_grise_verso", localOnly(carteGriseVerso));

    try {
      if (id) await api.updateDecharge(String(id), form);
      else await api.createDecharge(form);
    } catch (e: any) {
      Alert.alert("Erreur", e.message || "Échec de l'enregistrement.");
      return;
    }

    Alert.alert("Succès", "Enregistrement réussi !");
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f9f9f9" }}>
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#f9f9f9" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={100}
    >
      <Stack.Screen options={{ title: id ? "Modifier Décharge" : "Ajouter Décharge" }} />

      <ScrollView
        scrollEnabled={scrollEnabled}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Date et Lieu */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Date (JJ/MM/AAAA)</Text>
            <TextInput
              value={date}
              onChangeText={(t) => {
                let v = t.replace(/[^0-9]/g, "");
                if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2);
                if (v.length > 5) v = v.slice(0, 5) + "/" + v.slice(5);
                setDate(v.slice(0, 10));
              }}
              style={styles.input}
              placeholder="31/12/2026"
              keyboardType="numeric"
              maxLength={10}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Fait à</Text>
            <TextInput
              value={lieu}
              onChangeText={setLieu}
              style={styles.input}
              placeholder="Ouagadougou"
            />
          </View>
        </View>

        {/* Vendeur */}
        <Text style={styles.sectionTitle}>VENDEUR</Text>
        <Text style={styles.label}>Nom du Vendeur</Text>
        <TextInput value={nomVendeur} onChangeText={setNomVendeur} style={styles.input} placeholder="Ex: GUENEAROUNA" />
        <Text style={styles.label}>N° CNIB Vendeur (numéro + date)</Text>
        <TextInput value={cnibVendeur} onChangeText={setCnibVendeur} style={styles.input} placeholder="Ex: B1737285 du 06/06/22" />
        <Text style={styles.label}>N° Téléphone Vendeur</Text>
        <TextInput value={telephoneVendeur} onChangeText={setTelephoneVendeur} style={styles.input} placeholder="Ex: 70 00 00 00" keyboardType="phone-pad" />

        {/* Acheteur */}
        <Text style={styles.sectionTitle}>ACHETEUR</Text>
        <Text style={styles.label}>Nom de l'Acheteur</Text>
        <TextInput value={nomAcheteur} onChangeText={setNomAcheteur} style={styles.input} placeholder="Ex: M. Barro Aziz" />
        <Text style={styles.label}>N° CNIB Acheteur (numéro + date)</Text>
        <TextInput value={cnibAcheteur} onChangeText={setCnibAcheteur} style={styles.input} placeholder="Ex: B21393144 du 17/02/25" />
        <Text style={styles.label}>N° Téléphone Acheteur</Text>
        <TextInput value={telephoneAcheteur} onChangeText={setTelephoneAcheteur} style={styles.input} placeholder="Ex: 70 00 00 00" keyboardType="phone-pad" />

        {/* Représentant */}
        <Text style={styles.sectionTitle}>REPRÉSENTANT (MANDATÉ)</Text>
        <Text style={styles.label}>Nom du Représentant</Text>
        <TextInput value={nomRepresentant} onChangeText={setNomRepresentant} style={styles.input} placeholder="Ex: M. Coulibaly Moustapha" />
        <Text style={styles.label}>N° CNIB Représentant (numéro + date)</Text>
        <TextInput value={cnibRepresentant} onChangeText={setCnibRepresentant} style={styles.input} placeholder="Ex: B8307039 du 31/03/16" />

        {/* Moto */}
        <Text style={styles.sectionTitle}>DÉSIGNATION DU VÉHICULE</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Marque</Text>
            <TextInput value={marque} onChangeText={setMarque} style={styles.input} placeholder="Yamaha" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Modèle</Text>
            <TextInput value={modele} onChangeText={setModele} style={styles.input} placeholder="Exciter 155" />
          </View>
        </View>
        <Text style={styles.label}>Couleur</Text>
        <TextInput value={couleur} onChangeText={setCouleur} style={styles.input} placeholder="Ex: NOIR CAFÉ" />
        <Text style={styles.label}>N° Châssis (VIN)</Text>
        <TextInput value={numeroChassis} onChangeText={setNumeroChassis} style={styles.input} placeholder="Ex: MH3RG2810NJ123456" autoCapitalize="characters" />
        <Text style={styles.label}>N° Immatriculation</Text>
        <TextInput value={immatriculation} onChangeText={setImmatriculation} style={styles.input} placeholder="Ex: 11 AB 1234" autoCapitalize="characters" />

        {/* Prix */}
        <Text style={styles.sectionTitle}>PRIX DE VENTE</Text>
        <Text style={styles.label}>Prix (FCFA)</Text>
        <TextInput
          value={prix}
          onChangeText={handlePrixChange}
          style={styles.input}
          placeholder="Ex: 1470000"
          keyboardType="numeric"
        />
        <Text style={styles.label}>Prix en lettres (auto-rempli)</Text>
        <TextInput
          value={prixLettres}
          onChangeText={setPrixLettres}
          style={[styles.input, { minHeight: 60, color: "#007AFF" }]}
          placeholder="Sera rempli automatiquement..."
          multiline
        />

        {/* Pièce d'identité du vendeur */}
        <Text style={styles.sectionTitle}>PIÈCE D'IDENTITÉ DU VENDEUR</Text>
        <View style={photoStyles.radioRow}>
          <TouchableOpacity
            onPress={() => setVendeurIdType("cnib")}
            style={[photoStyles.radio, vendeurIdType === "cnib" && photoStyles.radioActive]}
          >
            <Text style={[photoStyles.radioText, vendeurIdType === "cnib" && photoStyles.radioTextActive]}>
              CNIB (recto / verso)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setVendeurIdType("passport")}
            style={[photoStyles.radio, vendeurIdType === "passport" && photoStyles.radioActive]}
          >
            <Text style={[photoStyles.radioText, vendeurIdType === "passport" && photoStyles.radioTextActive]}>
              Passeport (recto)
            </Text>
          </TouchableOpacity>
        </View>

        <PhotoPicker
          label={vendeurIdType === "passport" ? "Passeport (recto)" : "CNIB — Recto"}
          uri={vendeurIdRecto}
          remoteUrl={remoteFileUrl("vendeur_id_recto")}
          aspect={vendeurIdType === "passport" ? PASSPORT_ASPECT : ID_ASPECT}
          onPick={() =>
            pickPhoto(
              setVendeurIdRecto,
              vendeurIdType === "passport" ? PASSPORT_ASPECT : ID_ASPECT,
            )
          }
          onClear={() => setVendeurIdRecto(null)}
        />
        {vendeurIdType === "cnib" && (
          <PhotoPicker
            label="CNIB — Verso"
            uri={vendeurIdVerso}
            remoteUrl={remoteFileUrl("vendeur_id_verso")}
            aspect={ID_ASPECT}
            onPick={() => pickPhoto(setVendeurIdVerso, ID_ASPECT)}
            onClear={() => setVendeurIdVerso(null)}
          />
        )}

        {/* Carte grise */}
        <Text style={styles.sectionTitle}>CARTE GRISE</Text>
        <PhotoPicker
          label="Carte grise — Recto"
          uri={carteGriseRecto}
          remoteUrl={remoteFileUrl("carte_grise_recto")}
          aspect={ID_ASPECT}
          onPick={() => pickPhoto(setCarteGriseRecto, ID_ASPECT)}
          onClear={() => setCarteGriseRecto(null)}
        />
        <PhotoPicker
          label="Carte grise — Verso"
          uri={carteGriseVerso}
          remoteUrl={remoteFileUrl("carte_grise_verso")}
          aspect={ID_ASPECT}
          onPick={() => pickPhoto(setCarteGriseVerso, ID_ASPECT)}
          onClear={() => setCarteGriseVerso(null)}
        />

        {/* Signatures */}
        <Text style={styles.sectionTitle}>SIGNATURES</Text>

        <SignatureBlock
          title="Signature du Vendeur :"
          signatureString={signatureVendeur}
          remoteUrl={remoteFileUrl("signature_uri")}
          onScrollLock={(locked) => setScrollEnabled(!locked)}
          onValidate={setSignatureVendeur}
          onClear={() => setSignatureVendeur(null)}
        />

        <SignatureBlock
          title="Signature de l'Acheteur / Représentant :"
          signatureString={signatureAcheteur}
          remoteUrl={remoteFileUrl("signature_acheteur_uri")}
          onScrollLock={(locked) => setScrollEnabled(!locked)}
          onValidate={setSignatureAcheteur}
          onClear={() => setSignatureAcheteur(null)}
        />

        <View style={{ marginTop: 30 }}>
          <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
            <Text style={styles.saveBtnText}>
              {id ? "METTRE À JOUR" : "SAUVEGARDER LA DÉCHARGE"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 60 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    marginTop: 20,
    marginBottom: 4,
    color: "#FF9500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
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
  saveBtn: {
    backgroundColor: "#FF9500",
    padding: 18,
    borderRadius: 10,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
