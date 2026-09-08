import { router } from "expo-router";
import { useState } from "react";
import {
    Alert,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { api } from "../../lib/api";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.includes("@")) {
      Alert.alert("Erreur", "Saisissez une adresse email valide.");
      return;
    }
    setLoading(true);
    try {
      await api.forgotPassword({ email: email.trim() });
      router.push({
        pathname: "/auth/reset-password",
        params: { email: email.trim() },
      } as never);
    } catch (error: any) {
      Alert.alert("Erreur", error.message || "Impossible d'envoyer le code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Mot de passe oublié</Text>
        <Text style={styles.subtitle}>
          Nous vous enverrons un code par email.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#aaa"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TouchableOpacity
          style={styles.button}
          onPress={submit}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Envoi..." : "Recevoir le code"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212" },
  content: { flex: 1, justifyContent: "center", padding: 24 },
  title: { color: "#fff", fontSize: 26, fontWeight: "700", marginBottom: 8 },
  subtitle: { color: "#aaa", marginBottom: 24 },
  input: {
    backgroundColor: "#1e1e1e",
    color: "#fff",
    borderColor: "#38383a",
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#0a84ff",
    borderRadius: 8,
    padding: 15,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700" },
});
