// app/registre.tsx

import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import SignatureCanvas from "react-native-signature-canvas";
import { supabase } from "../lib/supabase";

export default function RegistreForm() {
  const { dossierId, id } = useLocalSearchParams();
  const router = useRouter();

  const [date, setDate] = useState(new Date().toISOString().substring(0,10));
  const [nomPrenom, setNomPrenom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [numeroSerie, setNumeroSerie] = useState("");
  const [immatriculation, setImmatriculation] = useState("");
  const [provenance, setProvenance] = useState("");
  const [nomSignateur, setNomSignateur] = useState("");
  const [signatureString, setSignatureString] = useState<string | null>(null);

  const sigRef = useRef<any>(null);
  const [showPad, setShowPad] = useState(true);

  // 📥 Charger le registre existant si en EDIT
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

    setDate(data.date);
    setNomPrenom(data.nom_prenom);
    setTelephone(data.telephone || "");
    setNumeroSerie(data.numero_serie || "");
    setImmatriculation(data.immatriculation || "");
    setProvenance(data.provenance || "");
    setNomSignateur(data.nom_signateur || "");
    setSignatureString(data.signature_uri || null);
  };

  // 🖊 Signature capturée
  const handleSignatureOK = (sig: string) => {
    setSignatureString(sig);
    setShowPad(false);
  };

  // 📌 Valider la signature depuis les boutons de l’UI
  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Alert.alert("Erreur", "Utilisateur non connecté");
    if (!nomPrenom.trim()) return Alert.alert("Erreur", "Nom & prénom requis.");
    if (!signatureString) return Alert.alert("Erreur", "Veuillez signer.");

    const registreData = {
      date,
      nom_prenom: nomPrenom,
      telephone,
      numero_serie: numeroSerie,
      immatriculation,
      provenance,
      nom_signateur: nomSignateur,
      signature_uri: signatureString,
      annee_mois_id: dossierId,
      user_id: user.id
    };

    let error;
    if (id) {
      // 🟡 EDITION
      ({ error } = await supabase
        .from("registres")
        .update(registreData)
        .eq("id", id));
    } else {
      // 🟢 CREATION
      ({ error } = await supabase
        .from("registres")
        .insert([registreData]));
    }

    if (error) {
      Alert.alert("Erreur", error.message);
      return;
    }

    Alert.alert("Succès", id ? "Registre modifié !" : "Registre ajouté !");
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Stack.Screen options={{ title: id ? "Modifier Registre" : "Ajouter Registre" }} />

        {/* 🧾 FORMULAIRES TEXTES */}
        <Text style={styles.label}>Date</Text>
        <TextInput value={date} onChangeText={setDate} style={styles.input}/>

        <Text style={styles.label}>Nom & Prénom</Text>
        <TextInput value={nomPrenom} onChangeText={setNomPrenom} style={styles.input}/>

        <Text style={styles.label}>Téléphone</Text>
        <TextInput value={telephone} onChangeText={setTelephone} style={styles.input} keyboardType="phone-pad"/>

        <Text style={styles.label}>N° Série Moto</Text>
        <TextInput value={numeroSerie} onChangeText={setNumeroSerie} style={styles.input}/>

        <Text style={styles.label}>Immatriculation</Text>
        <TextInput value={immatriculation} onChangeText={setImmatriculation} style={styles.input}/>

        <Text style={styles.label}>Provenance</Text>
        <TextInput value={provenance} onChangeText={setProvenance} style={styles.input}/>

        <Text style={styles.label}>Nom du Signateur</Text>
        <TextInput value={nomSignateur} onChangeText={setNomSignateur} style={styles.input}/>

        {/* ✍️ SIGNATURE AREA */}
        <Text style={styles.label}>Signature</Text>

        {/* Si déjà signé et non en train de SIGNER, afficher l’image */}
        {signatureString && !showPad && (
          <Image
            source={{ uri: signatureString }}
            style={styles.sigPreview}
            resizeMode="contain"
          />
        )}

        {/* Canvas de signature */}
        {showPad && (
          <View style={styles.signatureBox}>
            <SignatureCanvas
              ref={sigRef}
              onOK={handleSignatureOK}
              descriptionText="Signez ici"
              clearText="Effacer"
              confirmText="Valider"
              webStyle={`
                .m-signature-pad { box-shadow: none; border: none; }
                .m-signature-pad--footer { display: flex; justify-content: space-around; }
              `}
            />
          </View>
        )}

        {/* 🟡 Valider / Sauvegarder */}
        <Button title={id ? "Mettre à jour" : "Sauvegarder"} onPress={handleSave}/>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 16, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 8 },

  signatureBox: {
    borderWidth: 1, borderColor: "#999",
    width: "100%", height: 250, marginBottom: 20
  },
  sigPreview: {
    width: "100%", height: 200, marginVertical: 10
  }
});
