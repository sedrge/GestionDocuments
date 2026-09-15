import { router, useLocalSearchParams } from "expo-router";
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

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? "");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const verify = async () => {
    if (!email.includes("@") || !/^\d{6}$/.test(code)) {
      Alert.alert("Erreur", "Saisissez un email et un code à 6 chiffres.");
      return;
    }
    setLoading(true);
    try {
      await api.verifyEmail({ email: email.trim(), code });
      Alert.alert("Email confirmé", "Vous pouvez maintenant vous connecter.", [
        { text: "Se connecter", onPress: () => router.replace("/auth/login") },
      ]);
    } catch (error: any) {
      Alert.alert("Erreur", error.message || "Code invalide ou expiré.");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (!email.includes("@")) {
      Alert.alert("Erreur", "Saisissez d'abord une adresse email valide.");
      return;
    }

    setResending(true);
    try {
      await api.resendVerification({ email: email.trim() });
      Alert.alert("Code envoyé", "Vérifiez votre boîte email.");
    } catch (error: any) {
      Alert.alert("Erreur", error.message || "Impossible d'envoyer le code.");
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Confirmer votre email</Text>
        <Text style={styles.subtitle}>
          Un code à 6 chiffres vous a été envoyé.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Code à 6 chiffres"
          keyboardType="number-pad"
          maxLength={6}
          value={code}
          onChangeText={setCode}
        />
        <TouchableOpacity
          style={styles.button}
          onPress={verify}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Confirmation..." : "Confirmer"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={resend} disabled={loading || resending}>
          <Text style={styles.link}>Renvoyer le code</Text>
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
    marginBottom: 18,
  },
  buttonText: { color: "#fff", fontWeight: "700" },
  link: { color: "#0a84ff", textAlign: "center", padding: 10 },
});
