import { Ionicons } from '@expo/vector-icons';
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

// --- 1. THEME ENGINE ---
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

// --- 2. MAIN COMPONENT ---
function HomeScreenContent() {
  const { theme, toggleTheme, isDark } = useTheme();
  
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [activeMenu, setActiveMenu] = useState<string | null>(null); 
  const [viewMode, setViewMode] = useState<'list' | 'details' | 'grid' | 'content'>('list');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase.from('categories').select('*, documents(*)');
    if (data) setCategories(data);
    setLoading(false);
  };

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    const { error } = await supabase.from('categories').insert([{ nom: newCatName.trim() }]);
    if (!error) {
      setNewCatName('');
      setIsModalVisible(false);
      setActiveMenu(null);
      fetchData();
    }
  };

  const renderDocument = ({ item }: any) => {
    const iconColor = theme.primary;
    const dateStr = new Date(item.created_at).toLocaleDateString();

    switch (viewMode) {
      case 'grid':
        return (
          <TouchableOpacity style={[styles.gridCard, { backgroundColor: theme.card }]}>
            <Ionicons name="document-text" size={40} color={iconColor} />
            <Text style={[styles.gridText, { color: theme.text }]} numberOfLines={2}>{item.titre}</Text>
          </TouchableOpacity>
        );
      case 'details':
        return (
          <View style={[styles.detailRow, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
            <Ionicons name="document" size={24} color={theme.subText} />
            <View style={{ flex: 1, marginLeft: 15 }}>
              <Text style={{ color: theme.text, fontWeight: '600' }}>{item.titre}</Text>
              <Text style={{ color: theme.subText, fontSize: 11 }}>{dateStr} • {item.autres?.size ? (item.autres.size / 1024).toFixed(1) + ' KB' : 'Fichier'}</Text>
            </View>
          </View>
        );
      case 'content':
        return (
          <View style={[styles.contentCard, { backgroundColor: theme.card }]}>
            <View style={[styles.previewPlaceholder, { backgroundColor: isDark ? '#333' : '#EFEFEF' }]}>
              <Ionicons name="eye-outline" size={30} color={theme.subText} />
            </View>
            <Text style={{ color: theme.text, padding: 12, fontWeight: 'bold' }}>{item.titre}</Text>
          </View>
        );
      default:
        return (
          <TouchableOpacity style={[styles.listRow, { borderBottomColor: theme.border }]}>
            <Ionicons name="document-outline" size={20} color={theme.subText} />
            <Text style={{ color: theme.text, marginLeft: 15 }}>{item.titre}</Text>
          </TouchableOpacity>
        );
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.nav }]}>
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        
        {/* --- NAVBAR --- */}
        <View style={[styles.topNavbar, { backgroundColor: theme.nav, borderBottomColor: theme.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity style={styles.navBtn} onPress={() => setActiveMenu(activeMenu === 'Fichier' ? null : 'Fichier')}>
              <Text style={{ color: theme.text, fontWeight: activeMenu === 'Fichier' ? 'bold' : 'normal' }}>Fichier</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navBtn} onPress={() => setActiveMenu(activeMenu === 'Affichage' ? null : 'Affichage')}>
              <Text style={{ color: theme.text, fontWeight: activeMenu === 'Affichage' ? 'bold' : 'normal' }}>Affichage</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navBtn} onPress={toggleTheme}>
              <Ionicons name={isDark ? "sunny" : "moon"} size={16} color={theme.text} />
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* --- DROPDOWNS --- */}
        {activeMenu === 'Fichier' && (
          <View style={[styles.dropdown, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <TouchableOpacity style={styles.dropItem} onPress={() => { setIsModalVisible(true); setActiveMenu(null); }}>
              <Ionicons name="add-circle-outline" size={18} color={theme.text} />
              <Text style={[styles.dropText, { color: theme.text }]}>Nouvelle Catégorie</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dropItem} onPress={() => Alert.alert("Document", "Choisir un document...")}>
              <Ionicons name="document-attach-outline" size={18} color={theme.text} />
              <Text style={[styles.dropText, { color: theme.text }]}>Nouveau Fichier</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeMenu === 'Affichage' && (
          <View style={[styles.dropdown, { backgroundColor: theme.card, borderColor: theme.border, left: 80 }]}>
            {(['list', 'details', 'grid', 'content'] as const).map((mode) => (
              <TouchableOpacity key={mode} style={styles.dropItem} onPress={() => { setViewMode(mode); setActiveMenu(null); }}>
                <Ionicons name={viewMode === mode ? "checkmark-circle" : "ellipse-outline"} size={18} color={viewMode === mode ? theme.primary : theme.subText} />
                <Text style={[styles.dropText, { color: theme.text }]}>{mode.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* --- CONTENT --- */}
        <TouchableOpacity activeOpacity={1} style={{ flex: 1 }} onPress={() => setActiveMenu(null)}>
          {loading ? (
            <ActivityIndicator style={{ marginTop: 50 }} color={theme.primary} />
          ) : selectedCategory ? (
            <View style={{ flex: 1, padding: 15 }}>
              <TouchableOpacity onPress={() => setSelectedCategory(null)} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={24} color={theme.primary} />
                <Text style={{ color: theme.primary, fontSize: 16 }}>Dossiers</Text>
              </TouchableOpacity>
              <Text style={[styles.title, { color: theme.text }]}>{selectedCategory.nom}</Text>
              
              <FlatList
                key={viewMode === 'grid' ? 'G' : 'L'}
                data={selectedCategory.documents}
                numColumns={viewMode === 'grid' ? 3 : 1}
                renderItem={renderDocument}
                keyExtractor={(item) => item.id}
                ListEmptyComponent={<Text style={{ color: theme.subText, textAlign: 'center', marginTop: 40 }}>Vide</Text>}
              />

              {/* BOUTON FLOTTANT (FAB) */}
              <TouchableOpacity 
                style={[styles.fab, { backgroundColor: theme.primary }]}
                onPress={() => Alert.alert("Ajouter", "Action d'envoi de document")}
              >
                <Ionicons name="add" size={32} color="white" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <View style={[styles.searchBox, { backgroundColor: theme.card }]}>
                <Ionicons name="search" size={18} color={theme.subText} />
                <TextInput 
                  placeholder="Rechercher..." 
                  placeholderTextColor={theme.subText}
                  style={{ marginLeft: 10, color: theme.text, flex: 1 }}
                  value={search}
                  onChangeText={setSearch}
                />
              </View>
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
            </View>
          )}
        </TouchableOpacity>

        {/* --- MODAL --- */}
        <Modal visible={isModalVisible} transparent animationType="fade">
          <View style={styles.overlay}>
            <View style={[styles.modal, { backgroundColor: theme.card }]}>
              <Text style={{ color: theme.text, fontSize: 18, fontWeight: 'bold' }}>Nouveau Dossier</Text>
              <TextInput 
                style={[styles.input, { color: theme.text, borderColor: theme.border }]} 
                value={newCatName} onChangeText={setNewCatName} placeholder="Nom..." placeholderTextColor={theme.subText} autoFocus
              />
              <View style={styles.modalActions}>
                <TouchableOpacity onPress={() => setIsModalVisible(false)}><Text style={{ color: 'red', marginRight: 20 }}>Annuler</Text></TouchableOpacity>
                <Button title="Créer" onPress={handleCreateCategory} color={theme.primary} />
              </View>
            </View>
          </View>
        </Modal>

      </View>
    </SafeAreaView>
  );
}

export default function HomeScreen() {
  return <ThemeProvider><HomeScreenContent /></ThemeProvider>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  topNavbar: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 0.5, zIndex: 10 },
  navBtn: { paddingHorizontal: 15, justifyContent: 'center' },
  dropdown: { position: 'absolute', top: 45, left: 10, width: 200, borderRadius: 8, padding: 5, borderWidth: 1, zIndex: 100, elevation: 10 },
  dropItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 5 },
  dropText: { marginLeft: 10, fontSize: 14 },
  searchBox: { flexDirection: 'row', alignItems: 'center', margin: 15, padding: 10, borderRadius: 10 },
  folderCard: { width: width / 2 - 22, margin: 11, padding: 20, borderRadius: 15, alignItems: 'center', elevation: 2 },
  folderName: { marginTop: 10, fontWeight: '600', fontSize: 15 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 0.5 },
  detailRow: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 0.5 },
  gridCard: { width: width / 3 - 20, margin: 10, padding: 15, borderRadius: 12, alignItems: 'center' },
  gridText: { marginTop: 8, fontSize: 11, textAlign: 'center' },
  contentCard: { width: '100%', marginBottom: 15, borderRadius: 15, overflow: 'hidden' },
  previewPlaceholder: { height: 100, justifyContent: 'center', alignItems: 'center' },
  fab: { position: 'absolute', bottom: 30, right: 20, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modal: { width: '85%', padding: 25, borderRadius: 20 },
  input: { borderBottomWidth: 1, paddingVertical: 10, marginTop: 20, marginBottom: 25 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }
});
