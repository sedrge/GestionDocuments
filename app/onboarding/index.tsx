import { supabase } from "@/lib/supabase";
import { useTheme } from "@/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";

export default function OnboardingScreen() {
  const [loading, setLoading] = useState(false);
  const { theme, isDark, toggleTheme } = useTheme();

  const checkAuth = async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (session?.session) {
        // User already logged in, go to home
        router.replace("/(tabs)");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    checkAuth();
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg }]}
      contentContainerStyle={styles.content}
    >
      {/* Toggle thème */}
      <TouchableOpacity
        style={[styles.themeToggle, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPress={toggleTheme}
      >
        <Ionicons name={isDark ? 'sunny' : 'moon'} size={20} color={isDark ? '#FFD60A' : theme.primary} />
        <Text style={[styles.themeToggleText, { color: theme.text }]}>
          {isDark ? 'Mode Clair' : 'Mode Sombre'}
        </Text>
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>DocVault</Text>
        <Text style={[styles.subtitle, { color: theme.subText }]}>
          Gestion d'Entreprises Multi-Tenant
        </Text>
      </View>

      {/* Main Options */}
      <View style={styles.optionsContainer}>
        {/* Option 1: Se Connecter */}
        <TouchableOpacity
          style={[
            styles.card,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
          onPress={() => router.push("/auth/login")}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Se Connecter
            </Text>
            <Text style={[styles.cardIcon, { fontSize: 28 }]}>🔐</Text>
          </View>
          <Text style={[styles.cardDescription, { color: theme.subText }]}>
            Accédez à votre compte existant
          </Text>
          <TouchableOpacity
            style={[styles.cardButton, { backgroundColor: theme.primary }]}
            onPress={() => router.push("/auth/login")}
          >
            <Text style={styles.buttonText}>Se connecter →</Text>
          </TouchableOpacity>
        </TouchableOpacity>

        {/* Option 2: Créer une Entreprise */}
        <TouchableOpacity
          style={[
            styles.card,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
          onPress={() => router.push("/onboarding/create-enterprise")}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Créer une Entreprise
            </Text>
            <Text style={styles.cardIcon}>🏢</Text>
          </View>
          <Text style={[styles.cardDescription, { color: theme.subText }]}>
            Créez votre propre entreprise avec un code unique
          </Text>
          <TouchableOpacity
            style={[styles.cardButton, { backgroundColor: theme.primary }]}
            onPress={() => router.push("/onboarding/create-enterprise")}
          >
            <Text style={styles.buttonText}>Créer →</Text>
          </TouchableOpacity>
        </TouchableOpacity>

        {/* Option 3: Rejoindre une Entreprise */}
        <TouchableOpacity
          style={[
            styles.card,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
          onPress={() => router.push("/onboarding/join-enterprise")}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Rejoindre une Entreprise
            </Text>
            <Text style={styles.cardIcon}>👥</Text>
          </View>
          <Text style={[styles.cardDescription, { color: theme.subText }]}>
            Rejoignez une entreprise avec un code
          </Text>
          <TouchableOpacity
            style={[styles.cardButton, { backgroundColor: theme.primary }]}
            onPress={() => router.push("/onboarding/join-enterprise")}
          >
            <Text style={styles.buttonText}>Rejoindre →</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </View>

      {/* Footer Info */}
      <View
        style={[
          styles.infoBox,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.infoTitle, { color: theme.text }]}>
          💡 Comment ça marche ?
        </Text>
        <Text style={[styles.infoText, { color: theme.subText }]}>
          • Créez votre entreprise et recevez un code unique{"\n"}• Partagez ce
          code avec vos employés{"\n"}• Ils peuvent rejoindre avec le code{"\n"}
          • Vous approuvez/désapprouvez les accès{"\n"}• Chaque entreprise voit
          seulement ses données
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  themeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
  },
  themeToggleText: {
    fontSize: 13,
    fontWeight: '500',
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
    marginTop: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "500",
  },
  optionsContainer: {
    marginBottom: 30,
    gap: 16,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  cardIcon: {
    fontSize: 32,
  },
  cardDescription: {
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  cardButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  infoBox: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
  },
});
