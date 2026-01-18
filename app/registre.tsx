// app/registre.tsx
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
import SignatureCanvas from "react-native-signature-canvas";
import { supabase } from "../lib/supabase";

export default function RegistreForm() {
  const { dossierId, id } = useLocalSearchParams();
  const router = useRouter();

  // Fonction pour obtenir la date du jour au format JJ/MM/AAAA
  const getTodayDateFR = () => {
    const now = new Date();
    const j = String(now.getDate()).padStart(2, "0");
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const a = now.getFullYear();
    return `${j}/${m}/${a}`;
  };

  const [date, setDate] = useState(getTodayDateFR());
  const [nomPrenom, setNomPrenom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [numeroSerie, setNumeroSerie] = useState("");
  const [immatriculation, setImmatriculation] = useState("");
  const [provenance, setProvenance] = useState("");
  const [nature, setNature] = useState("");
  const [nomSignateur, setNomSignateur] = useState("");
  const [signatureString, setSignatureString] = useState<string | null>(null);

  const sigRef = useRef<any>(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const webStyle = `
    .m-signature-pad--footer { display: none; margin: 0px; }
    body, html { width: 100%; height: 100%; overflow: hidden; background-color: #fff; }
    .m-signature-pad { border: none; box-shadow: none; }
  `;

  useEffect(() => {
    if (id) fetchRegistre();
  }, [id]);

  const fetchRegistre = async () => {
    const { data, error } = await supabase
      .from("registres")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      Alert.alert("Erreur", "Impossible de charger ce registre.");
      return;
    }

    // Conversion de AAAA-MM-JJ vers JJ/MM/AAAA pour l'affichage
    if (data.date) {
      const [a, m, j] = data.date.split("-");
      setDate(`${j}/${m}/${a}`);
    }

    setNomPrenom(data.nom_prenom);
    setTelephone(data.telephone || "");
    setNumeroSerie(data.numero_serie || "");
    setImmatriculation(data.immatriculation || "");
    setProvenance(data.provenance || "");
    setProvenance(data.nature || "");
    setNomSignateur(data.nom_signateur || "");
    setSignatureString(data.signature_uri || null);
  };

  const handleClear = () => {
    sigRef.current?.clearSignature();
    setSignatureString(null);
  };

  const handleConfirm = () => {
    sigRef.current?.readSignature();
  };

  const handleSignatureOK = (sig: string) => {
    setSignatureString(sig);
    Alert.alert("Succès", "Signature capturée !");
  };

  const handleSave = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return Alert.alert("Erreur", "Utilisateur non connecté");
    if (!nomPrenom.trim()) return Alert.alert("Erreur", "Nom & prénom requis.");
    if (!signatureString)
      return Alert.alert("Erreur", "Veuillez valider la signature.");

    // Conversion de JJ/MM/AAAA vers AAAA-MM-JJ pour Supabase
    let dateBDD = date;
    const parts = date.split("/");
    if (parts.length === 3) {
      dateBDD = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }

    const registreData = {
      date: dateBDD,
      nom_prenom: nomPrenom,
      telephone,
      numero_serie: numeroSerie,
      immatriculation,
      provenance,
      nature,
      nom_signateur: nomSignateur,
      signature_uri: signatureString,
      annee_mois_id: dossierId,
      user_id: user.id,
    };

    let result;
    if (id) {
      result = await supabase
        .from("registres")
        .update(registreData)
        .eq("id", id);
    } else {
      result = await supabase.from("registres").insert([registreData]);
    }

    if (result.error) {
      Alert.alert("Erreur", result.error.message);
    } else {
      Alert.alert("Succès", "Enregistrement réussi !");
      router.back();
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#f9f9f9" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={100}
    >
      <Stack.Screen
        options={{ title: id ? "Modifier Registre" : "Ajouter Registre" }}
      />

      <ScrollView
        scrollEnabled={scrollEnabled}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Date (JJ/MM/AAAA)</Text>
            <TextInput
              value={date}
              onChangeText={setDate}
              style={styles.input}
              placeholder="31/12/2026"
              keyboardType="numeric"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Téléphone</Text>
            <TextInput
              value={telephone}
              onChangeText={setTelephone}
              style={styles.input}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        <Text style={styles.label}>Nom & Prénom du client</Text>
        <TextInput
          value={nomPrenom}
          onChangeText={setNomPrenom}
          style={styles.input}
          placeholder="Ex: Jean Dupont"
        />

        <Text style={styles.label}>N° Série Moto</Text>
        <TextInput
          value={numeroSerie}
          onChangeText={setNumeroSerie}
          style={styles.input}
        />

        <Text style={styles.label}>Immatriculation</Text>
        <TextInput
          value={immatriculation}
          onChangeText={setImmatriculation}
          style={styles.input}
        />

        <Text style={styles.label}>Provenance</Text>
        <TextInput
          value={provenance}
          onChangeText={setProvenance}
          style={styles.input}
        />

        <Text style={styles.label}>Nature</Text>
        <TextInput
          value={nature}
          onChangeText={setNature}
          style={styles.input}
        />

        <Text style={styles.label}>Nom du Signateur / Provenance</Text>
        <TextInput
          value={nomSignateur}
          onChangeText={setNomSignateur}
          style={styles.input}
        />

        <Text style={[styles.label, { marginTop: 20 }]}>Signature :</Text>

        <View style={styles.signatureContainer}>
          <View style={styles.signatureBox}>
            <SignatureCanvas
              ref={sigRef}
              onOK={handleSignatureOK}
              onBegin={() => setScrollEnabled(false)}
              onEnd={() => setScrollEnabled(true)}
              descriptionText=""
              webStyle={webStyle}
            />
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              onPress={handleClear}
              style={[styles.sigBtn, { backgroundColor: "#ff4444" }]}
            >
              <Text style={styles.btnText}>Effacer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleConfirm}
              style={[styles.sigBtn, { backgroundColor: "#4CAF50" }]}
            >
              <Text style={styles.btnText}>Valider Signature</Text>
            </TouchableOpacity>
          </View>
        </View>

        {signatureString && (
          <View style={styles.previewContainer}>
            <Text style={{ fontSize: 12, color: "gray" }}>
              Signature mémorisée :
            </Text>
            <Image
              source={{ uri: signatureString }}
              style={styles.sigPreview}
              resizeMode="contain"
            />
          </View>
        )}

        <View style={{ marginTop: 30 }}>
          <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
            <Text style={styles.saveBtnText}>
              {id ? "METTRE À JOUR" : "SAUVEGARDER LE REGISTRE"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 60 },
  label: { fontSize: 13, fontWeight: "600", marginTop: 15, color: "#444" },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#fff",
    marginTop: 5,
    fontSize: 15,
  },
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
    marginTop: 15,
    padding: 10,
    backgroundColor: "#e8f5e9",
    borderRadius: 8,
  },
  sigPreview: { width: 150, height: 80 },
  saveBtn: {
    backgroundColor: "#007AFF",
    padding: 18,
    borderRadius: 10,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
