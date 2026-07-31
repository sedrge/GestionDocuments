import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../lib/api';

// Écran de test temporaire pour valider le backend Laravel avec l'UI réelle,
// sans toucher aux écrans existants connectés à Supabase. À supprimer une
// fois la bascule complète du client mobile faite.

export default function DevApiTestScreen() {
  const [log, setLog] = useState([]);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('test@example.com');
  const [password, setPassword] = useState('password123');
  const [enterpriseId, setEnterpriseId] = useState('');
  const [motoId, setMotoId] = useState('');
  const [chatId, setChatId] = useState('');
  const [clientToken, setClientToken] = useState('');

  const push = (label, value) => {
    setLog((prev) => [{ label, value, ts: new Date().toLocaleTimeString() }, ...prev]);
  };

  const run = async (label, fn) => {
    setBusy(true);
    try {
      const result = await fn();
      push(`✅ ${label}`, result);
      return result;
    } catch (e) {
      push(`❌ ${label}`, e.data ?? e.message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const testRegister = () =>
    run('Register', () =>
      api.register({
        name: 'Testeur Mobile',
        email,
        password,
        password_confirmation: password,
      })
    );

  const testLogin = () => run('Login', () => api.login({ email, password }));

  const testMe = () => run('Me', () => api.me());

  const testLogout = () => run('Logout', () => api.logout());

  const testCreateEnterprise = async () => {
    const result = await run('Créer entreprise', () =>
      api.createEnterprise({
        name: 'Entreprise Test Mobile',
        code: `TEST-${Date.now()}`,
      })
    );
    if (result?.id) setEnterpriseId(result.id);
  };

  const testListPublicMotos = () => run('Liste motos publiques', () => api.listPublicMotos());

  const testCreateMoto = async () => {
    const result = await run('Créer moto', () =>
      api.createMoto({
        marque: 'Yamaha',
        modele: 'XTZ Test',
        prix_vente: 1500000,
        enterprise_id: enterpriseId || undefined,
      })
    );
    if (result?.id) setMotoId(result.id);
  };

  const testPublishMoto = () =>
    run('Publier moto', () => api.updateMoto(motoId, { is_published: true }));

  const testLikeMoto = () => run('Liker moto', () => api.likeMoto(motoId));

  const testUploadMotoImage = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (picked.canceled) return;

    const asset = picked.assets[0];
    const form = new FormData();
    form.append('image', {
      uri: asset.uri,
      name: 'moto.jpg',
      type: 'image/jpeg',
    });
    form.append('is_principal', '1');

    await run('Upload image moto', () => api.uploadMotoImage(motoId, form));
  };

  const testStartChat = async () => {
    const result = await run('Démarrer chat', () =>
      api.startChat(enterpriseId, { client_name: 'Client Test Mobile' })
    );
    if (result?.id) setChatId(result.id);
    if (result?.client_token) setClientToken(result.client_token);
  };

  const testSendClientMessage = () =>
    run('Message client', () => api.sendClientMessage(chatId, clientToken, 'Bonjour, ceci est un test !'));

  const testListRendezVous = () => run('Liste RDV', () => api.listRendezVous());

  const testListNotifications = () => run('Liste notifications', () => api.listNotifications());

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
        {busy && <ActivityIndicator />}
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>🧪 Test API Laravel</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Identifiants de test</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" placeholder="Email" />
          <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Mot de passe" secureTextEntry />
        </View>

        <Section title="Auth (Lot 1)">
          <Btn label="Register" onPress={testRegister} disabled={busy} />
          <Btn label="Login" onPress={testLogin} disabled={busy} />
          <Btn label="Me" onPress={testMe} disabled={busy} />
          <Btn label="Logout" onPress={testLogout} disabled={busy} />
        </Section>

        <Section title="Entreprise (Lot 1)">
          <Btn label="Créer entreprise" onPress={testCreateEnterprise} disabled={busy} />
          <Text style={styles.hint}>enterpriseId: {enterpriseId || '(aucun)'}</Text>
        </Section>

        <Section title="Motos (Lot 3)">
          <Btn label="Liste motos publiques" onPress={testListPublicMotos} disabled={busy} />
          <Btn label="Créer moto" onPress={testCreateMoto} disabled={busy} />
          <Btn label="Publier moto" onPress={testPublishMoto} disabled={busy || !motoId} />
          <Btn label="Upload image (galerie)" onPress={testUploadMotoImage} disabled={busy || !motoId} />
          <Btn label="Liker moto (public)" onPress={testLikeMoto} disabled={busy || !motoId} />
          <Text style={styles.hint}>motoId: {motoId || '(aucun)'}</Text>
        </Section>

        <Section title="Rendez-vous / Notifications (Lot 4)">
          <Btn label="Liste RDV" onPress={testListRendezVous} disabled={busy} />
          <Btn label="Liste notifications" onPress={testListNotifications} disabled={busy} />
        </Section>

        <Section title="Chat (Lot 5)">
          <Btn label="Démarrer chat (client anonyme)" onPress={testStartChat} disabled={busy || !enterpriseId} />
          <Btn label="Envoyer message client" onPress={testSendClientMessage} disabled={busy || !chatId} />
          <Text style={styles.hint}>chatId: {chatId || '(aucun)'}</Text>
        </Section>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Journal</Text>
          {log.length === 0 && <Text style={styles.hint}>Aucun test lancé.</Text>}
          {log.map((entry, i) => (
            <View key={i} style={styles.logEntry}>
              <Text style={styles.logLabel}>{entry.ts} — {entry.label}</Text>
              <Text style={styles.logValue}>{JSON.stringify(entry.value, null, 2)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Btn({ label, onPress, disabled }) {
  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#121212' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  backText: { color: '#5856D6', fontSize: 16, fontWeight: '600' },
  container: { padding: 16, paddingBottom: 60 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 16 },
  section: { marginBottom: 20, backgroundColor: '#1e1e1e', borderRadius: 12, padding: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#aaa', marginBottom: 10, textTransform: 'uppercase' },
  input: { backgroundColor: '#2a2a2a', color: '#fff', borderRadius: 8, padding: 10, marginBottom: 8 },
  button: { backgroundColor: '#5856D6', padding: 12, borderRadius: 8, marginBottom: 8 },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontWeight: '600', textAlign: 'center' },
  hint: { color: '#888', fontSize: 12, marginTop: 4 },
  logEntry: { marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#333', paddingBottom: 8 },
  logLabel: { color: '#5856D6', fontWeight: '600', marginBottom: 4 },
  logValue: { color: '#ccc', fontSize: 12, fontFamily: 'monospace' },
});
