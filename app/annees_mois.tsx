// app/annees_mois.tsx

import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function AnneesMoisScreen() {
  const router = useRouter();
  const [dossiers, setDossiers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDossiers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('annees_mois')
      .select('*')
      .order('nom'); // Tri par nom (ex: 2026_janvier)
    setDossiers(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchDossiers();
  }, []);

  const renderFolder = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.folderCard}
      onPress={() => router.push({
        pathname: '/registres',
        params: { dossierId: item.id, nom: item.nom }
      })}
    >
      <Ionicons name="folder" size={50} color="#FFCA28" />
      <Text style={styles.folderName} numberOfLines={1}>{item.nom}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Dossiers Registres" }} />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 50 }} size="large" />
      ) : (
        <FlatList
          data={dossiers}
          renderItem={renderFolder}
          keyExtractor={(item) => item.id}
          numColumns={2} // Affiche en grille 2 colonnes
          contentContainerStyle={{ padding: 15 }}
        />
      )}

      {/* 👇 Bouton flottant pour ajouter un dossier */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/annees_mois_new')} // écran de création
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  folderCard: {
    width: '45%',
    margin: '2.5%',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    elevation: 2
  },
  folderName: {
    marginTop: 10,
    fontWeight: '600',
    fontSize: 16,
    textAlign: 'center'
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    backgroundColor: '#007AFF',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8
  }
});
