import { supabase } from "@/lib/supabase";
import { useTheme } from "@/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type SecretType = 'taps' | 'phrase';

interface SecretConfig {
  secret_type: SecretType;
  tap_count: number;
  secret_phrase: string | null;
}

const DEFAULT_CONFIG: SecretConfig = { secret_type: 'taps', tap_count: 11, secret_phrase: null };

export default function OnboardingScreen() {
  const [loading, setLoading] = useState(false);
  const { theme, isDark, toggleTheme } = useTheme();

  const [secretConfig, setSecretConfig] = useState<SecretConfig>(DEFAULT_CONFIG);
  const [tapCount, setTapCount] = useState(0);
  const [showPhraseModal, setShowPhraseModal] = useState(false);
  const [phraseInput, setPhraseInput] = useState('');
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkAuth = async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (session?.session) {
        router.replace("/(tabs)");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadSecretConfig = async () => {
    try {
      const { data } = await supabase
        .from('super_admin_config')
        .select('secret_type, tap_count, secret_phrase')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();
      if (data) {
        setSecretConfig({
          secret_type: data.secret_type as SecretType,
          tap_count: data.tap_count ?? 11,
          secret_phrase: data.secret_phrase ?? null,
        });
      }
    } catch {
      // Pas de config, on garde le défaut
    }
  };

  useEffect(() => {
    checkAuth();
    loadSecretConfig();
  }, []);

  const handleTitlePress = () => {
    if (secretConfig.secret_type === 'phrase') {
      // Montrer la modale de phrase secrète directement
      setShowPhraseModal(true);
      return;
    }

    // Mode taps
    const newCount = tapCount + 1;
    setTapCount(newCount);

    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => setTapCount(0), 2000);

    if (newCount >= secretConfig.tap_count) {
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      setTapCount(0);
      router.push('/auth/super-admin-register');
    }
  };

  const handlePhraseSubmit = () => {
    if (phraseInput.trim() === secretConfig.secret_phrase?.trim()) {
      setShowPhraseModal(false);
      setPhraseInput('');
      router.push('/auth/super-admin-register');
    } else {
      Alert.alert('Incorrect', 'Phrase incorrecte.');
      setPhraseInput('');
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.content}
    >
      {/* Retour à l'accueil + Toggle thème */}
      <View style={styles.topRow}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}>
          <Text style={[styles.backText, { color: theme.primary }]}>← Retour</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.themeToggle, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={toggleTheme}
        >
          <Ionicons name={isDark ? 'sunny' : 'moon'} size={20} color={isDark ? '#FFD60A' : theme.primary} />
          <Text style={[styles.themeToggleText, { color: theme.text }]}>
            {isDark ? 'Mode Clair' : 'Mode Sombre'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleTitlePress} activeOpacity={0.9}>
          <Text style={[styles.title, { color: theme.text }]}>SenMoto</Text>
        </TouchableOpacity>
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
          Comment ça marche ?
        </Text>
        <Text style={[styles.infoText, { color: theme.subText }]}>
          • Créez votre entreprise et recevez un code unique{"\n"}• Partagez ce
          code avec vos employés{"\n"}• Ils peuvent rejoindre avec le code{"\n"}
          • Vous approuvez/désapprouvez les accès{"\n"}• Chaque entreprise voit
          seulement ses données
        </Text>
      </View>
    </ScrollView>

    {/* Modale phrase secrète */}
    <Modal visible={showPhraseModal} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalBox, { backgroundColor: theme.card }]}>
          <Text style={[styles.modalTitle, { color: theme.text }]}>Accès restreint</Text>
          <TextInput
            style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
            placeholder="Entrez la phrase secrète"
            placeholderTextColor={theme.subText}
            secureTextEntry
            value={phraseInput}
            onChangeText={setPhraseInput}
            autoFocus
          />
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: theme.border }]}
              onPress={() => { setShowPhraseModal(false); setPhraseInput(''); }}
            >
              <Text style={{ color: theme.text, fontWeight: '600' }}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: theme.primary }]}
              onPress={handlePhraseSubmit}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>Valider</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
  },
  themeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  modalBox: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
    gap: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
});
