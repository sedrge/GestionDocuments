// app/registre/[id].tsx

import { Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, Text } from "react-native";
import { supabase } from "../../lib/supabase";

export default function RegistreDetail() {
  const { id } = useLocalSearchParams();
  const [registre, setRegistre] = useState<any>(null);

  const fetchRegistre = async () => {
    const { data, error } = await supabase
      .from("registres")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      Alert.alert("Erreur", error.message);
      return;
    }
    setRegistre(data);
  };

  useEffect(() => {
    fetchRegistre();
  }, []);

  if (!registre) return null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: `Registre — ${registre.nom_prenom}` }} />

      <Text style={styles.label}>Nom & Prénom :</Text>
      <Text style={styles.value}>{registre.nom_prenom}</Text>

      <Text style={styles.label}>Téléphone :</Text>
      <Text style={styles.value}>{registre.telephone}</Text>

      <Text style={styles.label}>N° Série Moto :</Text>
      <Text style={styles.value}>{registre.numero_serie}</Text>

      <Text style={styles.label}>Immatriculation :</Text>
      <Text style={styles.value}>{registre.immatriculation}</Text>

      <Text style={styles.label}>Provenance :</Text>
      <Text style={styles.value}>{registre.provenance}</Text>

      <Text style={styles.label}>Nature :</Text>
      <Text style={styles.value}>{registre.nature}</Text>

      <Text style={styles.label}>Nom du Signateur :</Text>
      <Text style={styles.value}>{registre.nom_signateur}</Text>

      <Text style={styles.label}>Date :</Text>
      <Text style={styles.value}>{registre.date}</Text>

      {registre.signature_uri ? (
        <>
          <Text style={styles.label}>Signature :</Text>
          <Image
            // base64 data URL : on passe directement quelle que soit l’extension (png)
            source={{ uri: registre.signature_uri }}
            style={styles.signatureImage}
            resizeMode="contain"
          />
        </>
      ) : (
        <Text style={styles.noSignature}>Aucune signature disponible</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  label: { fontWeight: "bold", marginTop: 15, fontSize: 16 },
  value: { marginTop: 5, fontSize: 16 },
  signatureImage: {
    width: "100%",
    height: 250,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#ccc",
    backgroundColor: "#fff",
  },
  noSignature: { marginTop: 10, fontStyle: "italic", color: "#555" },
});
