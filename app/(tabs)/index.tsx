import * as ImagePicker from 'expo-image-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { Alert, Button, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
//import * as FileSystem from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import { router } from 'expo-router';

// Logo par défaut si aucun n'est choisi
const DEFAULT_LOGO = require('../../assets/images/senApp.png');

export default function AuthScreen() {
  const [pin, setPin] = useState('');
  const [storedPin, setStoredPin] = useState<string | null>(null);
  const [logoUri, setLogoUri] = useState<string | null>(null);

  useEffect(() => {
    loadPin();
    loadLogo();
    authenticateBiometric();
  }, []);

  // Charger le PIN et le logo sauvegardés
  const loadPin = async () => {
    const savedPin = await SecureStore.getItemAsync('USER_PIN');
    setStoredPin(savedPin);
  };

  const loadLogo = async () => {
    const savedLogo = await SecureStore.getItemAsync('APP_LOGO_URI');
    if (savedLogo) setLogoUri(savedLogo);
  };

  // Changer le logo (Appelable via un appui long sur le logo par exemple)
  const pickLogo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      const sourceUri = result.assets[0].uri;
      const fileName = `custom_logo_${Date.now()}.png`;
      const destinationUri = `${FileSystem.documentDirectory}${fileName}`;

      try {
        // Copie permanente du fichier (le cache expire, pas le documentDirectory)
        await FileSystem.copyAsync({ from: sourceUri, to: destinationUri });
        await SecureStore.setItemAsync('APP_LOGO_URI', destinationUri);
        setLogoUri(destinationUri);
        Alert.alert('Succès', 'Logo mis à jour !');
      } catch (e) {
        Alert.alert('Erreur', 'Impossible de sauvegarder le logo.');
      }
    }
  };

  const authenticateBiometric = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !isEnrolled) return;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authentifiez-vous',
    });

    if (result.success) router.replace('/home');
  };

  const handlePinSubmit = async () => {
    if (!storedPin) {
      await SecureStore.setItemAsync('USER_PIN', pin);
      Alert.alert('PIN créé');
      router.replace('/home');
      return;
    }
    if (pin === storedPin) {
      router.replace('/home');
    } else {
      Alert.alert('PIN incorrect');
    }
  };

  return (
    <View style={styles.container}>
      {/* Logo cliquable pour changement (ou via paramètres une fois connecté) */}
      <TouchableOpacity onLongPress={pickLogo} activeOpacity={0.8}>
        <Image 
          source={logoUri ? { uri: logoUri } : DEFAULT_LOGO} 
          style={styles.logo} 
        />
      </TouchableOpacity>

      <Text style={styles.title}>🔐 Sécurité</Text>

      <TextInput
        style={styles.input}
        placeholder="Entrez votre PIN"
        keyboardType="numeric"
        secureTextEntry
        maxLength={4}
        value={pin}
        onChangeText={setPin}
      />

      <Button title="Valider" onPress={handlePinSubmit} />
      <Text style={styles.hint}>Appui long sur le logo pour le changer</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff'
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 30,
    backgroundColor: '#f0f0f0'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 15, 
    borderRadius: 12,
    marginBottom: 20,
    textAlign: 'center',
    fontSize: 18,
    backgroundColor: '#fafafa'
  },
  hint: {
    marginTop: 20,
    fontSize: 12,
    color: '#888'
  }
});
