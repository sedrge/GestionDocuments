import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../context/ThemeContext';

export default function SuperAdminRegisterScreen() {
  const { theme, isDark, toggleTheme } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [superAdminExists, setSuperAdminExists] = useState(false);

  useEffect(() => {
    checkExistingSuperAdmin();
  }, []);

  const checkExistingSuperAdmin = async () => {
    try {
      const { count } = await supabase
        .from('super_admins')
        .select('id', { count: 'exact', head: true });
      setSuperAdminExists((count ?? 0) > 0);
    } catch {
      setSuperAdminExists(false);
    } finally {
      setChecking(false);
    }
  };

  const handleRegister = async () => {
    if (!name.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer votre nom.');
      return;
    }
    if (!email.includes('@')) {
      Alert.alert('Erreur', 'Email invalide.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Erreur', 'Le mot de passe doit faire au moins 8 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    try {
      // 1. Créer le compte Supabase Auth
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: name.trim() } },
      });

      if (signUpError) {
        Alert.alert('Erreur d\'inscription', signUpError.message);
        return;
      }

      const userId = signUpData.user?.id;
      if (!userId) {
        Alert.alert('Erreur', 'Impossible de récupérer l\'identifiant utilisateur.');
        return;
      }

      // 2. Insérer dans super_admins via fonction SECURITY DEFINER (bypass RLS)
      const { error: insertError } = await supabase.rpc('register_super_admin', {
        p_user_id: userId,
        p_name: name.trim(),
        p_email: email.trim(),
      });

      if (insertError) {
        Alert.alert('Erreur', insertError.message);
        return;
      }

      // 3. Insérer la config par défaut si première fois
      if (!superAdminExists) {
        await supabase.from('super_admin_config').insert({
          secret_type: 'taps',
          tap_count: 11,
          secret_phrase: null,
        });
      }

      Alert.alert(
        'Compte créé !',
        'Votre compte Super Admin a été créé avec succès. Connectez-vous maintenant.',
        [{ text: 'Se connecter', onPress: () => router.replace('/auth/login') }],
      );
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={[styles.backText, { color: theme.primary }]}>← Retour</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.themeToggle, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={toggleTheme}
            >
              <Ionicons name={isDark ? 'sunny' : 'moon'} size={16} color={isDark ? '#FFD60A' : theme.primary} />
              <Text style={[styles.themeToggleText, { color: theme.text }]}>
                {isDark ? 'Clair' : 'Sombre'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Badge discret */}
          <View style={[styles.badge, { backgroundColor: theme.primary + '22', borderColor: theme.primary + '44' }]}>
            <Ionicons name="shield-checkmark" size={18} color={theme.primary} />
            <Text style={[styles.badgeText, { color: theme.primary }]}>Accès Concepteur</Text>
          </View>

          <Text style={[styles.title, { color: theme.text }]}>Créer votre compte</Text>
          <Text style={[styles.subtitle, { color: theme.subText }]}>
            {superAdminExists
              ? 'Un compte Super Admin existe déjà. Vous pouvez en créer un nouveau.'
              : 'Premier compte Super Admin de l\'application.'}
          </Text>

          <TextInput
            style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
            placeholder="Nom complet"
            placeholderTextColor={theme.subText}
            autoCapitalize="words"
            value={name}
            onChangeText={setName}
          />

          <TextInput
            style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
            placeholder="Email"
            placeholderTextColor={theme.subText}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <TextInput
            style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
            placeholder="Mot de passe (min. 8 caractères)"
            placeholderTextColor={theme.subText}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TextInput
            style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
            placeholder="Confirmer le mot de passe"
            placeholderTextColor={theme.subText}
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.primary, opacity: loading ? 0.7 : 1 }]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="shield-checkmark-outline" size={20} color="#fff" />
                  <Text style={styles.buttonText}>Créer le compte</Text>
                </View>
              )
            }
          </TouchableOpacity>

          <Text style={[styles.note, { color: theme.subText }]}>
            Après inscription, connectez-vous et modifiez les règles d'accès secret depuis le panneau Admin.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { padding: 25, paddingTop: 20, paddingBottom: 40 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  backText: { fontSize: 16, fontWeight: '600' },
  themeToggle: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  themeToggleText: { fontSize: 12, fontWeight: '500' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, marginBottom: 20 },
  badgeText: { fontSize: 13, fontWeight: '600' },
  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 13, marginBottom: 28, textAlign: 'center', lineHeight: 20 },
  input: {
    width: '100%', borderWidth: 1, padding: 15,
    borderRadius: 12, marginBottom: 14, fontSize: 14,
  },
  button: { width: '100%', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 6 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  note: { fontSize: 12, textAlign: 'center', marginTop: 20, lineHeight: 18 },
});
