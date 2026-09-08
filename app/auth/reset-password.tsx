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
import PasswordInput from "../../components/PasswordInput";
import { api } from "../../lib/api";

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (
      !email.includes("@") ||
      !/^\d{6}$/.test(code) ||
      password.length < 8 ||
      password !== confirmation
    ) {
      Alert.alert(
        "Erreur",
        "Vérifiez l'email, le code et les deux mots de passe.",
      );
      return;
    }
    setLoading(true);
    try {
      await api.resetPassword({
        email: email.trim(),
        code,
        password,
        password_confirmation: confirmation,
      });
      Alert.alert(
        "Mot de passe modifié",
        "Vous pouvez vous connecter avec votre nouveau mot de passe.",
        [
          {
            text: "Se connecter",
            onPress: () => router.replace("/auth/login"),
          },
        ],
      );
    } catch (error: any) {
      Alert.alert("Erreur", error.message || "Code invalide ou expiré.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Nouveau mot de passe</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#aaa"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Code reçu par email"
          placeholderTextColor="#aaa"
          keyboardType="number-pad"
          maxLength={6}
          value={code}
          onChangeText={setCode}
        />
        <PasswordInput
          style={styles.input}
          placeholder="Nouveau mot de passe"
          placeholderTextColor="#aaa"
          value={password}
          onChangeText={setPassword}
        />
        <PasswordInput
          style={styles.input}
          placeholder="Confirmer le mot de passe"
          placeholderTextColor="#aaa"
          value={confirmation}
          onChangeText={setConfirmation}
        />
        <TouchableOpacity
          style={styles.button}
          onPress={submit}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Modification..." : "Modifier le mot de passe"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212" },
  content: { flex: 1, justifyContent: "center", padding: 24 },
  title: { color: "#fff", fontSize: 26, fontWeight: "700", marginBottom: 24 },
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
