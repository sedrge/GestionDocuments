// app/(auth)/auth.tsx

import * as FileSystem from 'expo-file-system';
import { Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Network from 'expo-network';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { router } from 'expo-router';

const DEFAULT_LOGO = require('../../assets/images/senApp.png');

export default function AuthScreen() {
  const [loading, setLoading] = useState(true);

  const [hasSession, setHasSession] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const [pin, setPin] = useState('');
  const [storedPin, setStoredPin] = useState<string | null>(null);
  const [logoUri, setLogoUri] = useState<string | null>(null);

  useEffect(() => {
    initApp();
  }, []);

  // --- INITIALISATION (SESSION + PIN + BIOMETRIE + LOGO)
  const initApp = async () => {
    try {
      const net = await Network.getNetworkStateAsync();

      let userId: string | null = null;

      if (net.isConnected) {
        // SUPABASE SESSION
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setHasSession(true);
          userId = session.user.id;
          await SecureStore.setItemAsync('LAST_USER_ID', userId);
        }
      } else {
        // HORS-LIGNE
        const lastId = await SecureStore.getItemAsync('LAST_USER_ID');
        if (lastId) {
          setHasSession(true);
          userId = lastId;
        }
      }

      // PIN de l’utilisateur
      if (userId) {
        const savedPin = await SecureStore.getItemAsync(`USER_PIN_${userId}`);
        setStoredPin(savedPin);

        // si PIN existe, tenter biométrie
        if (savedPin) {
          const bio = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Accès DocVault'
          });
          if (bio.success) {
            router.replace('/home');
            return;
          }
        }
      }

      // Charger logo perso
      const savedLogo = await SecureStore.getItemAsync('APP_LOGO_URI');
      if (savedLogo) setLogoUri(savedLogo);

    } catch (e) {
      console.error("Erreur initApp", e);
    } finally {
      setLoading(false);
    }
  };

  // --- SUPABASE AUTH (EMAIL / PASSWORD)
  const handleAuthSupabase = async () => {
    const net = await Network.getNetworkStateAsync();
    if (!net.isConnected) {
      Alert.alert("Hors-ligne", "Veuillez être connecté pour s’identifier.");
      return;
    }

    if (!email.includes('@') || password.length < 6) {
      Alert.alert("Erreur", "Email ou mot de passe invalide.");
      return;
    }

    setLoading(true);

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: 'docvault://auth' }
      });
      if (error) Alert.alert("Erreur", error.message);
      else Alert.alert("Vérifier email", "Confirmez votre compte via le mail reçu.");
      setIsSignUp(false);

    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email, password
      });
      if (error) {
        Alert.alert("Erreur", error.message);
      } else if (data.session) {
        const uid = data.session.user.id;
        await SecureStore.setItemAsync('LAST_USER_ID', uid);
        setHasSession(true);

        const savedPin = await SecureStore.getItemAsync(`USER_PIN_${uid}`);
        setStoredPin(savedPin);
      }
    }
    setLoading(false);
  };

  // --- PIN VALIDATION / ENREGISTREMENT
  const handlePinSubmit = async () => {
    const userId = await SecureStore.getItemAsync('LAST_USER_ID');
    if (!userId) return;

    const pinKey = `USER_PIN_${userId}`;

    if (!storedPin) {
      if (pin.length !== 4) return Alert.alert("Erreur", "4 chiffres requis.");
      await SecureStore.setItemAsync(pinKey, pin);
      setStoredPin(pin);
      router.replace('/home');

    } else if (pin === storedPin) {
      router.replace('/home');

    } else {
      Alert.alert("PIN incorrect");
      setPin('');
    }
  };

  // --- LOGO PERSONNALISÉ
  const pickLogo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5
    });
    if (!result.canceled && result.assets) {
      const baseDir = Paths.document;
      if (!baseDir) return;
      const dest = `${baseDir}/logo.png`;
      try {
        await FileSystem.copyAsync({ from: result.assets[0].uri, to: dest });
        await SecureStore.setItemAsync('APP_LOGO_URI', dest);
        setLogoUri(dest);
      } catch {
        Alert.alert("Erreur", "Impossible de sauvegarder le logo.");
      }
    }
  };

  // --- UI
  if (loading) return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#007AFF" />
    </View>
  );

  // --- ECRAN LOGIN (EMAIL / PASSWORD)
  if (!hasSession) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <Image source={logoUri ? { uri: logoUri } : DEFAULT_LOGO} style={styles.logo} />
        <Text style={styles.title}>{isSignUp ? "Créer un compte" : "Connexion"}</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Mot de passe"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity style={styles.mainButton} onPress={handleAuthSupabase}>
          <Text style={styles.buttonText}>
            {isSignUp ? "S'inscrire" : "Se connecter"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
          <Text style={{ color: '#007AFF', marginTop: 20 }}>
            {isSignUp
              ? "Déjà un compte ? Se connecter"
              : "Nouveau ? Créer un compte"}
          </Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    );
  }

  // --- ECRAN PIN
  return (
    <View style={styles.container}>
      <TouchableOpacity onLongPress={pickLogo}>
        <Image source={logoUri ? { uri: logoUri } : DEFAULT_LOGO} style={styles.logo} />
      </TouchableOpacity>

      <Text style={styles.title}>
        {storedPin ? "🔐 Verrouillé" : "🛡️ Sécurisez votre accès"}
      </Text>

      <TextInput
        style={[styles.input, { letterSpacing: 10, fontSize: 24 }]}
        placeholder="****"
        keyboardType="numeric"
        secureTextEntry
        maxLength={4}
        value={pin}
        onChangeText={setPin}
      />

      <TouchableOpacity style={styles.mainButton} onPress={handlePinSubmit}>
        <Text style={styles.buttonText}>
          {storedPin ? "Déverrouiller" : "Enregistrer le PIN"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={async () => {
          await supabase.auth.signOut();
          await SecureStore.deleteItemAsync('LAST_USER_ID');
          await SecureStore.deleteItemAsync('IS_LOGGED_IN');
          setHasSession(false);
        }}
        style={{ marginTop: 30 }}
      >
        <Text style={{ color: 'red' }}>Changer d'utilisateur</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 25 },
  logo: { width: 120, height: 120, borderRadius: 60, marginBottom: 30 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    textAlign: 'center'
  },
  mainButton: {
    backgroundColor: '#007AFF',
    width: '100%',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center'
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' }
});
