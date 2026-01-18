// app/annees_mois_new.tsx

import { Stack, useRouter } from "expo-router";
import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { supabase } from "../lib/supabase";

export default function NewAnneesMoisScreen() {
  const router = useRouter();
  const [nom, setNom] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!nom.trim()) {
      Alert.alert("Erreur", "Le nom du dossier est requis.");
      return;
    }
    setLoading(true);

    // Récupérer l'utilisateur connecté
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert("Erreur", "Utilisateur non connecté.");
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase
        .from("annees_mois")
        .insert([{ 
          nom: nom.trim(),
          user_id: user.id  // ✅ Ajout du user_id
        }]);

      if (error) {
        Alert.alert("Erreur", error.message);
      } else {
        Alert.alert("Succès", "Dossier créé !");
        router.back();
      }
    } catch (e) {
      Alert.alert("Erreur", "Une erreur est survenue lors de la création.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Stack.Screen options={{ title: "Nouveau Dossier Registres" }} />

      <Text style={styles.label}>Nom du dossier</Text>
      <TextInput
        value={nom}
        onChangeText={setNom}
        placeholder="Ex. 2026_janvier"
        style={styles.input}
      />

      <TouchableOpacity style={[styles.button, loading && styles.disabled]} onPress={handleCreate} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Création..." : "Créer"}</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center" },
  label: { fontSize: 16, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: "#CCC", padding: 12, borderRadius: 8, marginBottom: 20 },
  button: { backgroundColor: "#007AFF", padding: 15, borderRadius: 8, alignItems: "center" },
  disabled: { backgroundColor: "#AAA" },
  buttonText: { color: "#FFF", fontSize: 16 }
});
