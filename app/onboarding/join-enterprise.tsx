import { joinEnterprise } from "@/lib/multitenant";
import { router } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

const themes = {
  light: {
    bg: "#F5F5F7",
    card: "#FFFFFF",
    text: "#1C1C1E",
    subText: "#8E8E93",
    primary: "#007AFF",
    border: "#D1D1D6",
  },
  dark: {
    bg: "#121212",
    card: "#1E1E1E",
    text: "#FFFFFF",
    subText: "#A1A1A1",
    primary: "#0A84FF",
    border: "#38383A",
  },
};

export default function JoinEnterpriseScreen() {
  const isDark = true;
  const theme = isDark ? themes.dark : themes.light;
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    code: "",
    fullName: "",
    email: "",
    phone: "",
    password: "",
    passwordConfirm: "",
  });

  const handleSubmit = async () => {
    // Validation
    if (!formData.code.trim()) {
      Alert.alert("Erreur", "Le code d'entreprise est requis");
      return;
    }
    if (!formData.fullName.trim()) {
      Alert.alert("Erreur", "Le nom complet est requis");
      return;
    }
    if (!formData.email.includes("@")) {
      Alert.alert("Erreur", "Email valide requis");
      return;
    }
    if (!formData.phone.trim()) {
      Alert.alert("Erreur", "Le téléphone est requis");
      return;
    }
    if (formData.password.length < 6) {
      Alert.alert("Erreur", "Le mot de passe doit avoir au moins 6 caractères");
      return;
    }
    if (formData.password !== formData.passwordConfirm) {
      Alert.alert("Erreur", "Les mots de passe ne correspondent pas");
      return;
    }

    setLoading(true);
    try {
      const result = await joinEnterprise({
        code: formData.code.toUpperCase().trim(),
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        password: formData.password,
        confirmPassword: formData.passwordConfirm,
      });

      if (result.success) {
        Alert.alert("✅ Compte créé !", result.message, [
          {
            text: "Se connecter",
            onPress: () => router.replace("/auth/login"),
          },
        ]);
      } else {
        Alert.alert(
          "Erreur",
          result.error || "Impossible de rejoindre l'entreprise",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg }]}
      contentContainerStyle={styles.content}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backBtn, { color: theme.primary }]}>
            ← Retour
          </Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>
          Rejoindre une Entreprise
        </Text>
      </View>

      {/* Info Box */}
      <View
        style={[
          styles.infoBox,
          { backgroundColor: theme.primary + "20", borderColor: theme.primary },
        ]}
      >
        <Text style={[styles.infoText, { color: theme.text }]}>
          💡 Demandez le code d'entreprise à votre administrateur
        </Text>
      </View>

      {/* Formulaire */}
      <View
        style={[
          styles.form,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          📋 Code de l'Entreprise
        </Text>

        <Text style={[styles.label, { color: theme.text }]}>
          Code (ex: ENT-ABC123)
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.bg,
              color: theme.text,
              borderColor: theme.border,
            },
          ]}
          placeholder="ENT-XXXXXX"
          placeholderTextColor={theme.subText}
          value={formData.code}
          onChangeText={(text) =>
            setFormData({ ...formData, code: text.toUpperCase() })
          }
        />

        {/* User Info Section */}
        <Text
          style={[styles.sectionTitle, { color: theme.text, marginTop: 24 }]}
        >
          👤 Vos Informations
        </Text>

        <Text style={[styles.label, { color: theme.text }]}>Nom complet</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.bg,
              color: theme.text,
              borderColor: theme.border,
            },
          ]}
          placeholder="Marc Lefevre"
          placeholderTextColor={theme.subText}
          value={formData.fullName}
          onChangeText={(text) => setFormData({ ...formData, fullName: text })}
        />

        <Text style={[styles.label, { color: theme.text }]}>Email</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.bg,
              color: theme.text,
              borderColor: theme.border,
            },
          ]}
          placeholder="marc@example.com"
          placeholderTextColor={theme.subText}
          keyboardType="email-address"
          value={formData.email}
          onChangeText={(text) => setFormData({ ...formData, email: text })}
        />

        <Text style={[styles.label, { color: theme.text }]}>Téléphone</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.bg,
              color: theme.text,
              borderColor: theme.border,
            },
          ]}
          placeholder="+33 6 12 34 56 78"
          placeholderTextColor={theme.subText}
          value={formData.phone}
          onChangeText={(text) => setFormData({ ...formData, phone: text })}
        />

        {/* Password Section */}
        <Text
          style={[styles.sectionTitle, { color: theme.text, marginTop: 24 }]}
        >
          🔐 Mot de Passe
        </Text>

        <Text style={[styles.label, { color: theme.text }]}>Mot de passe</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.bg,
              color: theme.text,
              borderColor: theme.border,
            },
          ]}
          placeholder="••••••••"
          placeholderTextColor={theme.subText}
          secureTextEntry
          value={formData.password}
          onChangeText={(text) => setFormData({ ...formData, password: text })}
        />

        <Text style={[styles.label, { color: theme.text }]}>
          Confirmer le mot de passe
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.bg,
              color: theme.text,
              borderColor: theme.border,
            },
          ]}
          placeholder="••••••••"
          placeholderTextColor={theme.subText}
          secureTextEntry
          value={formData.passwordConfirm}
          onChangeText={(text) =>
            setFormData({ ...formData, passwordConfirm: text })
          }
        />
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[
          styles.submitButton,
          { backgroundColor: theme.primary, opacity: loading ? 0.6 : 1 },
        ]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Rejoindre l'entreprise</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => router.back()}
        disabled={loading}
      >
        <Text style={[styles.cancelText, { color: theme.primary }]}>
          Annuler
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  backBtn: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
  },
  infoBox: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
  },
  infoText: {
    fontSize: 14,
    fontWeight: "500",
  },
  form: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
  },
  input: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    fontSize: 14,
  },
  submitButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  cancelText: {
    fontWeight: "600",
    fontSize: 16,
  },
});
