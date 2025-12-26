import { decode } from 'base64-arraybuffer';
import * as DocumentPicker from 'expo-document-picker';
//import * as FileSystem from 'expo-file-system';
import { File } from 'expo-file-system';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert, Button,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { supabase } from '../lib/supabase';

// --- Interfaces pour TypeScript ---
interface DocumentDB {
  id: string;
  titre: string;
  file_url: string;
  categorie_id: string;
  autres: any;
  created_at?: string;
}

interface Categorie {
  id: string;
  nom: string;
  created_at?: string;
  documents: DocumentDB[];
}

export default function HomeScreen() {
  // Correction de l'erreur TypeScript (never[])
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  // 1. Récupérer les catégories et leurs documents
  const fetchData = async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*, documents(*)');
    
    if (error) {
      console.error("Erreur fetchData:", error.message);
    } else {
      setCategories(data || []);
    }
  };

  // 2. Ajouter une catégorie
  const handleAddCategory = async () => {
    if (!newCatName.trim()) {
      Alert.alert("Info", "Entrez un nom de catégorie");
      return;
    }
    const { error } = await supabase.from('categories').insert([{ nom: newCatName.trim() }]);
    
    if (error) {
      Alert.alert("Erreur", error.message);
    } else {
      setNewCatName('');
      fetchData();
    }
  };

  // 3. Upload et Insertion de document
const handlePickDocument = async (categoryId: string) => {
  try {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
    if (result.canceled || !result.assets) return;

    setIsUploading(true);
    const asset = result.assets[0];

    // --- NOUVELLE MÉTHODE SDK 54 ---
    const fileRef = new File(asset.uri);
    const base64 = await fileRef.base64(); 
    // -------------------------------

    const storagePath = `${Date.now()}_${asset.name}`;

    // Upload au Storage Supabase
    const { error: uploadError } = await supabase.storage
      .from('fichiers_documents')
      .upload(storagePath, decode(base64), { 
        contentType: asset.mimeType || 'application/octet-stream',
        upsert: true
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('fichiers_documents')
      .getPublicUrl(storagePath);

    const { error: dbError } = await supabase.from('documents').insert([{
      titre: asset.name || 'Sans titre',
      file_url: urlData.publicUrl,
      categorie_id: categoryId,
      autres: { size: asset.size, type: asset.mimeType }
    }]);

    if (dbError) throw dbError;
    Alert.alert("Succès", "Document ajouté !");
    fetchData();

  } catch (err: any) {
    Alert.alert("Erreur", err.message);
  } finally {
    setIsUploading(false);
  }
};

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Mes Documents 📁</Text>

      {/* Formulaire Catégorie */}
      <View style={styles.addCatBox}>
        <TextInput 
          style={styles.input} 
          placeholder="Nouvelle catégorie..." 
          value={newCatName}
          onChangeText={setNewCatName}
        />
        <Button title="Ajouter" onPress={handleAddCategory} />
      </View>

      {/* Indicateur de chargement pendant l'upload */}
      {isUploading && (
        <View style={styles.loader}>
          <ActivityIndicator color="#007AFF" />
          <Text style={{ marginLeft: 10 }}>Envoi du fichier...</Text>
        </View>
      )}

      {/* Liste des catégories */}
      <FlatList
        data={categories}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.categoryCard}>
            <Text style={styles.categoryTitle}>{item.nom}</Text>
            
            {/* Liste des documents par catégorie */}
            {item.documents && item.documents.length > 0 ? (
              item.documents.map((doc) => (
                <Text key={doc.id} style={styles.docItem}>📄 {doc.titre}</Text>
              ))
            ) : (
              <Text style={styles.noDoc}>Aucun document</Text>
            )}

            <TouchableOpacity 
              style={[styles.uploadBtn, isUploading && { opacity: 0.6 }]} 
              onPress={() => handlePickDocument(item.id)}
              disabled={isUploading}
            >
              <Text style={{ color: 'white', fontWeight: 'bold' }}>+ Ajouter un document</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 20, backgroundColor: '#f5f5f5' },
  header: { fontSize: 26, fontWeight: 'bold', marginBottom: 20 },
  addCatBox: { flexDirection: 'row', marginBottom: 20 },
  loader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginRight: 10, backgroundColor: 'white' },
  categoryCard: { backgroundColor: 'white', padding: 15, borderRadius: 12, marginBottom: 15, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  categoryTitle: { fontSize: 18, fontWeight: '700', marginBottom: 10, color: '#333' },
  docItem: { fontSize: 14, color: '#555', marginVertical: 4, paddingLeft: 5 },
  noDoc: { fontStyle: 'italic', color: '#bbb', marginVertical: 8 },
  uploadBtn: { marginTop: 12, backgroundColor: '#007AFF', padding: 12, borderRadius: 8, alignItems: 'center' }
});
