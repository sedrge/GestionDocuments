import { Ionicons } from '@expo/vector-icons';
import { decode } from 'base64-arraybuffer';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store'; // AJOUTÉ
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  Dimensions,
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

// --- 1. MOTEUR DE THÈME ---
const Themes = {
  light: { bg: '#F5F5F7', card: '#FFFFFF', text: '#1C1C1E', subText: '#8E8E93', primary: '#007AFF', nav: '#E5E5EA', border: '#D1D1D6' },
  dark: { bg: '#121212', card: '#1E1E1E', text: '#FFFFFF', subText: '#A1A1A1', primary: '#0A84FF', nav: '#2C2C2E', border: '#38383A' }
};

const ThemeContext = createContext({ theme: Themes.dark, isDark: true, toggleTheme: () => {} });

const ThemeProvider = ({ children }: any) => {
  const [isDark, setIsDark] = useState(true);
  const theme = isDark ? Themes.dark : Themes.light;
  const toggleTheme = () => setIsDark(!isDark);
  return <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>{children}</ThemeContext.Provider>;
};

const useTheme = () => useContext(ThemeContext);

// --- 2. COMPOSANT PRINCIPAL ---
function HomeScreenContent() {
  const { theme, toggleTheme, isDark } = useTheme();
  
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  
  const [activeMenu, setActiveMenu] = useState<string | null>(null); 
  const [viewMode, setViewMode] = useState<'list' | 'details' | 'grid' | 'content'>('list');
  
  const [isModalVisible, setIsModalVisible] = useState(false); 
  const [isAddDocModal, setIsAddDocModal] = useState(false); 
  const [editingDoc, setEditingDoc] = useState<any>(null); 
  const [isPinModalVisible, setIsPinModalVisible] = useState(false);
  
  const [newDocTitle, setNewDocTitle] = useState('');
  const [tempFile, setTempFile] = useState<any>(null);
  const [newCatName, setNewCatName] = useState('');

  const [newPin, setNewPin] = useState('');


  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase.from('categories').select('*, documents(*)');
    if (data) {
      setCategories(data);
      if (selectedCategory) {
        const updated = data.find(c => c.id === selectedCategory.id);
        setSelectedCategory(updated);
      }
    }
    setLoading(false);
  };

  // --- LOGIQUE CHANGEMENT LOGO (PARAMÈTRES) ---
  const handleUpdateLogo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const sourceUri = result.assets[0].uri;
      const fileName = `app_logo_${Date.now()}.png`;
      const destinationUri = `${FileSystem.documentDirectory}${fileName}`;

      try {
        await FileSystem.copyAsync({ from: sourceUri, to: destinationUri });
        await SecureStore.setItemAsync('APP_LOGO_URI', destinationUri);
        Alert.alert('Succès', 'Le logo de l\'écran de verrouillage a été mis à jour.');
        setActiveMenu(null);
      } catch (e) {
        Alert.alert('Erreur', 'Impossible de sauvegarder le logo.');
      }
    }
  };

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    const { error } = await supabase.from('categories').insert([{ nom: newCatName.trim() }]);
    if (!error) { setNewCatName(''); setIsModalVisible(false); setActiveMenu(null); fetchData(); }
  };

  const handleUpdatePin = async () => {
    const auth = await LocalAuthentication.authenticateAsync({ promptMessage: 'Confirmez votre identité' });
    if (!auth.success) return Alert.alert("Erreur", "Authentification requise.");
    if (newPin.length !== 4) return Alert.alert("Erreur", "Le PIN doit faire 4 chiffres.");
    
    await SecureStore.setItemAsync('USER_PIN', newPin);
    Alert.alert("Succès", "Code PIN modifié.");
    setIsPinModalVisible(false);
    setNewPin('');
  };

  const processUpload = async () => {
    if (!newDocTitle.trim() || !tempFile) return Alert.alert("Erreur", "Veuillez donner un titre.");
    setIsUploading(true);
    setIsAddDocModal(false);
    try {
      const storagePath = `docs/${Date.now()}_${tempFile.name}`;
      const fileRef = new File(tempFile.uri);
      const base64 = await fileRef.base64();
      const { error: upErr } = await supabase.storage.from('fichiers_documents').upload(storagePath, decode(base64), { 
        contentType: tempFile.mimeType, upsert: true 
      });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('fichiers_documents').getPublicUrl(storagePath);
      const { error: dbErr } = await supabase.from('documents').insert([{
        titre: newDocTitle.trim(),
        file_url: urlData.publicUrl,
        categorie_id: selectedCategory.id,
        autres: { size: tempFile.size, type: tempFile.mimeType, path: storagePath }
      }]);
      if (dbErr) throw dbErr;
      fetchData();
    } catch (e: any) { Alert.alert("Erreur", e.message); }
    finally { setIsUploading(false); }
  };

  const handlePickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
    if (result.canceled || !result.assets) return;
    setTempFile(result.assets[0]);
    setNewDocTitle(result.assets[0].name);
    setIsAddDocModal(true);
    setActiveMenu(null);
  };

  const handleCapture = async (type: 'photo' | 'video') => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return Alert.alert("Permission refusée");
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: type === 'photo' ? ImagePicker.MediaTypeOptions.Images : ImagePicker.MediaTypeOptions.Videos,
      quality: 0.7,
    });
    if (result.canceled || !result.assets) return;
    const asset = result.assets[0];
    setTempFile({ uri: asset.uri, name: `capture.${type === 'photo' ? 'jpg' : 'mp4'}`, mimeType: asset.mimeType, size: asset.fileSize });
    setNewDocTitle(`Ma Capture ${new Date().toLocaleDateString()}`);
    setIsAddDocModal(true);
    setActiveMenu(null);
  };

  const handleOpenDoc = async (doc: any) => {
    try {
      const ext = doc.file_url.split('.').pop().toLowerCase();
      if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) {
        await WebBrowser.openBrowserAsync(doc.file_url);
        return;
      }
      const cleanName = doc.titre.replace(/[^a-zA-Z0-9.]/g, '_');
      const fileUri = `${FileSystem.documentDirectory}${cleanName}`;
      const { exists } = await FileSystem.getInfoAsync(fileUri);
      if (!exists) {
        Alert.alert("Patientez", "Téléchargement en cours...");
        await FileSystem.downloadAsync(doc.file_url, fileUri);
      }
      await Sharing.shareAsync(fileUri);
    } catch (e) {
      Alert.alert("Erreur", "Impossible d'ouvrir le document.");
    }
  };

  const getFilteredDocs = () => {
    if (!selectedCategory?.documents) return [];
    return selectedCategory.documents.filter((doc: any) => {
      const searchLower = search.toLowerCase();
      return doc.titre.toLowerCase().includes(searchLower) || new Date(doc.created_at).toLocaleDateString().includes(searchLower);
    });
  };

  const handleDeleteDoc = async (doc: any) => {
    Alert.alert("Supprimer", "Confirmer la suppression ?", [
      { text: "Non" },
      { text: "Oui", style: 'destructive', onPress: async () => {
        if (doc.autres?.path) await supabase.storage.from('fichiers_documents').remove([doc.autres.path]);
        await supabase.from('documents').delete().eq('id', doc.id);
        fetchData();
      }}
    ]);
  };

  const renderDocItem = ({ item }: any) => {
    const getIcon = (url: string) => {
      const ext = url.split('.').pop()?.toLowerCase();
      if (ext === 'pdf') return 'document-text';
      if (['jpg','png','jpeg'].includes(ext!)) return 'image';
      if (['mp4','mov'].includes(ext!)) return 'videocam';
      return 'document';
    };

    const isGrid = viewMode === 'grid';
    return (
      <TouchableOpacity 
        onPress={() => handleOpenDoc(item)} 
        onLongPress={() => {
          Alert.alert("Actions", item.titre, [
            { text: "Renommer", onPress: () => setEditingDoc(item) },
            { text: "Supprimer", onPress: () => handleDeleteDoc(item), style: 'destructive' },
            { text: "Fermer", style: 'cancel' }
          ]);
        }}
        style={isGrid ? [styles.gridCard, { backgroundColor: theme.card }] : [styles.detailRow, { backgroundColor: theme.card, borderBottomColor: theme.border }]}
      >
        <Ionicons name={getIcon(item.file_url)} size={isGrid ? 40 : 24} color={theme.primary} />
        <View style={isGrid ? null : { flex: 1, marginLeft: 15 }}>
          <Text style={[{ color: theme.text, fontWeight: '600' }, isGrid && styles.gridText]} numberOfLines={2}>{item.titre}</Text>
          {!isGrid && <Text style={{ color: theme.subText, fontSize: 11 }}>{new Date(item.created_at).toLocaleDateString()}</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.nav }]}>
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        
        {/* NAVBAR */}
        <View style={[styles.topNavbar, { backgroundColor: theme.nav, borderBottomColor: theme.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity style={styles.navBtn} onPress={() => setActiveMenu(activeMenu === 'Fichier' ? null : 'Fichier')}>
              <Text style={{ color: theme.text }}>Fichier</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navBtn} onPress={() => setActiveMenu(activeMenu === 'Affichage' ? null : 'Affichage')}>
              <Text style={{ color: theme.text }}>Affichage</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navBtn} onPress={() => setActiveMenu(activeMenu === 'Paramètres' ? null : 'Paramètres')}>
              <Text style={{ color: theme.text }}>Paramètres</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navBtn} onPress={toggleTheme}>
              <Ionicons name={isDark ? "sunny" : "moon"} size={16} color={theme.text} />
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* MENUS DÉROULANTS */}
        {activeMenu === 'Fichier' && (
          <View style={[styles.dropdown, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <MenuOption icon="folder-outline" label="Nouveau Dossier" onPress={() => { setIsModalVisible(true); setActiveMenu(null); }} />
            <MenuOption icon="document-attach-outline" label="Importer Fichier" onPress={handlePickDocument} />
            <MenuOption icon="camera-outline" label="Prendre Photo" onPress={() => handleCapture('photo')} />
            <MenuOption icon="videocam-outline" label="Filmer Vidéo" onPress={() => handleCapture('video')} />
          </View>
        )}

        {activeMenu === 'Affichage' && (
          <View style={[styles.dropdown, { backgroundColor: theme.card, borderColor: theme.border, left: 60 }]}>
            {(['list', 'details', 'grid'] as const).map((mode) => (
              <MenuOption key={mode} icon={viewMode === mode ? "checkmark-circle" : "ellipse-outline"} label={mode.toUpperCase()} onPress={() => { setViewMode(mode); setActiveMenu(null); }} />
            ))}
          </View>
        )}

        {activeMenu === 'Paramètres' && (
          <View style={[styles.dropdown, { backgroundColor: theme.card, borderColor: theme.border, left: 150 }]}>
            <MenuOption icon="image-outline" label="Changer le Logo" onPress={handleUpdateLogo} />
            <MenuOption icon="keypad-outline" label="Changer le PIN" onPress={() => { setIsPinModalVisible(true); setActiveMenu(null); }} />
          </View>
        )}

        {/* RECHERCHE */}
        <View style={[styles.searchBox, { backgroundColor: theme.card }]}>
          <Ionicons name="search" size={18} color={theme.subText} />
          <TextInput placeholder="Rechercher..." placeholderTextColor={theme.subText} style={{ marginLeft: 10, color: theme.text, flex: 1 }} value={search} onChangeText={setSearch} />
        </View>

        {/* CONTENU */}
        {loading || isUploading ? <ActivityIndicator style={{ marginTop: 50 }} color={theme.primary} /> : (
          selectedCategory ? (
            <View style={{ flex: 1, padding: 15 }}>
              <TouchableOpacity onPress={() => setSelectedCategory(null)} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={24} color={theme.primary} />
                <Text style={{ color: theme.primary, fontSize: 16 }}>Retour</Text>
              </TouchableOpacity>
              <Text style={[styles.title, { color: theme.text }]}>{selectedCategory.nom}</Text>
              <FlatList key={viewMode === 'grid' ? 'G' : 'L'} data={getFilteredDocs()} numColumns={viewMode === 'grid' ? 3 : 1} renderItem={renderDocItem} keyExtractor={(item) => item.id} />
              <TouchableOpacity style={[styles.fab, { backgroundColor: theme.primary }]} onPress={handlePickDocument}>
                <Ionicons name="add" size={32} color="white" />
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList 
              data={categories.filter(c => c.nom.toLowerCase().includes(search.toLowerCase()))} 
              numColumns={2} 
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.folderCard, { backgroundColor: theme.card }]} onPress={() => setSelectedCategory(item)}>
                  <Ionicons name="folder" size={55} color="#FFCA28" />
                  <Text style={[styles.folderName, { color: theme.text }]} numberOfLines={1}>{item.nom}</Text>
                  <Text style={{ color: theme.subText, fontSize: 11 }}>{item.documents?.length || 0} éléments</Text>
                </TouchableOpacity>
              )} 
            />
          )
        )}

        {/* MODALE AJOUT DOC */}
        <Modal visible={isAddDocModal} transparent animationType="slide">
          <View style={styles.overlay}>
            <View style={[styles.modal, { backgroundColor: theme.card }]}>
              <Text style={{ color: theme.text, fontWeight: 'bold', fontSize: 18 }}>Enregistrer</Text>
              <TextInput style={[styles.input, { color: theme.text, borderColor: theme.border }]} value={newDocTitle} onChangeText={setNewDocTitle} placeholder="Nom du document..." placeholderTextColor={theme.subText} autoFocus />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                <TouchableOpacity onPress={() => {setIsAddDocModal(false); setTempFile(null);}}><Text style={{ color: 'red', marginRight: 20, paddingTop: 10 }}>Annuler</Text></TouchableOpacity>
                <Button title="Enregistrer" onPress={processUpload} color={theme.primary} />
              </View>
            </View>
          </View>
        </Modal>

        {/* Modale Changement PIN */}
        <Modal visible={isPinModalVisible} transparent animationType="fade">
          <View style={styles.overlay}>
            <View style={[styles.modal, { backgroundColor: theme.card }]}>
              <Text style={{ color: theme.text, fontWeight: 'bold' }}>Nouveau PIN (4 chiffres)</Text>
              <TextInput style={[styles.input, { color: theme.text, borderColor: theme.border, textAlign:'center', fontSize:20 }]} value={newPin} onChangeText={setNewPin} maxLength={4} keyboardType="numeric" secureTextEntry />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                <TouchableOpacity onPress={() => setIsPinModalVisible(false)}><Text style={{ color: 'red', marginRight: 20 }}>Annuler</Text></TouchableOpacity>
                <Button title="Valider" onPress={handleUpdatePin} />
              </View>
            </View>
          </View>
        </Modal>

        {/* MODALE CATEGORIE */}
        <Modal visible={isModalVisible} transparent animationType="fade">
          <View style={styles.overlay}>
            <View style={[styles.modal, { backgroundColor: theme.card }]}>
              <Text style={{ color: theme.text, fontWeight: 'bold' }}>Nouveau Dossier</Text>
              <TextInput style={[styles.input, { color: theme.text, borderColor: theme.border }]} value={newCatName} onChangeText={setNewCatName} placeholder="Nom..." placeholderTextColor={theme.subText} />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                <TouchableOpacity onPress={() => setIsModalVisible(false)}><Text style={{ color: 'red', marginRight: 20 }}>Annuler</Text></TouchableOpacity>
                <Button title="Créer" onPress={handleCreateCategory} />
              </View>
            </View>
          </View>
        </Modal>

        {/* MODALE RENOMMER */}
        <Modal visible={!!editingDoc} transparent animationType="fade">
          <View style={styles.overlay}>
            <View style={[styles.modal, { backgroundColor: theme.card }]}>
              <Text style={{ color: theme.text, fontWeight: 'bold' }}>Renommer</Text>
              <TextInput style={[styles.input, { color: theme.text, borderColor: theme.border }]} value={editingDoc?.titre} onChangeText={(t) => setEditingDoc({...editingDoc, titre: t})} />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                <TouchableOpacity onPress={() => setEditingDoc(null)}><Text style={{ color: 'red', marginRight: 20 }}>Annuler</Text></TouchableOpacity>
                <Button title="Ok" onPress={async () => {
                   await supabase.from('documents').update({ titre: editingDoc.titre }).eq('id', editingDoc.id);
                   setEditingDoc(null); fetchData();
                }} />
              </View>
            </View>
          </View>
        </Modal>

      </View>
    </SafeAreaView>
  );
}

const MenuOption = ({ icon, label, onPress }: any) => {
  const { theme } = useTheme();
  return (
    <TouchableOpacity style={styles.dropItem} onPress={onPress}>
      <Ionicons name={icon} size={18} color={theme.text} />
      <Text style={[styles.dropText, { color: theme.text }]}>{label}</Text>
    </TouchableOpacity>
  );
};

export default function HomeScreen() { return <ThemeProvider><HomeScreenContent /></ThemeProvider>; }

const styles = StyleSheet.create({
  safeArea: { flex: 1 }, container: { flex: 1 },
  topNavbar: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 0.5, zIndex: 10 },
  navBtn: { paddingHorizontal: 15, justifyContent: 'center' },
  dropdown: { position: 'absolute', top: 45, width: 220, borderRadius: 8, padding: 5, borderWidth: 1, zIndex: 100, elevation: 10 },
  dropItem: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  dropText: { marginLeft: 10, fontSize: 14 },
  searchBox: { flexDirection: 'row', alignItems: 'center', margin: 15, padding: 10, borderRadius: 10 },
  folderCard: { width: width / 2 - 22, margin: 11, padding: 20, borderRadius: 15, alignItems: 'center', elevation: 2 },
  folderName: { marginTop: 10, fontWeight: '600' },
  title: { fontSize: 24, fontWeight: 'bold', marginVertical: 10 },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  detailRow: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 0.5 },
  gridCard: { width: width / 3 - 20, margin: 10, padding: 15, borderRadius: 12, alignItems: 'center' },
  gridText: { marginTop: 8, fontSize: 11, textAlign: 'center' },
  fab: { position: 'absolute', bottom: 30, right: 20, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 8 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modal: { width: '85%', padding: 25, borderRadius: 20 },
  input: { borderBottomWidth: 1, paddingVertical: 10, marginVertical: 20 }
});
