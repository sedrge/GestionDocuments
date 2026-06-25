// app/annees_mois_recu_new.tsx

import { Stack, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";

export default function NewAnneesMoisRecuScreen() {
  const router = useRouter();
  const [nom, setNom] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!nom.trim()) {
      Alert.alert("Erreur", "Le nom du dossier est requis.");
      return;
    }
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert("Erreur", "Utilisateur non connecté.");
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase
        .from("annees_mois_recu")
        .insert([{ nom: nom.trim(), user_id: user.id }]);

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
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Stack.Screen options={{ title: "Nouveau Dossier Réçus" }} />

      <Text style={styles.label}>Nom du dossier</Text>
      <TextInput
        value={nom}
        onChangeText={setNom}
        placeholder="Ex. 2026_janvier"
        style={styles.input}
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.disabled]}
        onPress={handleCreate}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{loading ? "Création..." : "Créer"}</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center" },
  label: { fontSize: 16, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#CCC",
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  button: { backgroundColor: "#34C759", padding: 15, borderRadius: 8, alignItems: "center" },
  disabled: { backgroundColor: "#AAA" },
  buttonText: { color: "#FFF", fontSize: 16 },
});
