// app/registres.tsx

import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function RegistresList() {
  const { dossierId, nom } = useLocalSearchParams();
  const router = useRouter();

  const [registres, setRegistres] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchRegistres = async () => {
    setLoading(true);

    let query = supabase
      .from('registres')
      .select('*')
      .eq('annee_mois_id', dossierId);

    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase();

      query = query.or(`
        nom_prenom.ilike.%${searchLower}%,
        telephone.ilike.%${searchLower}%,
        numero_serie.ilike.%${searchLower}%,
        immatriculation.ilike.%${searchLower}%,
        provenance.ilike.%${searchLower}%
      `);
    }

    const { data } = await query.order('created_at', { ascending: false });
    setRegistres(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRegistres();
  }, [searchQuery]);

  const handleDeleteRegistre = async (id: string) => {
    Alert.alert("Confirmer suppression", "Voulez‑vous supprimer ce registre ?", [
      { text: "Annuler" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from('registres').delete().eq('id', id);
          if (error) Alert.alert("Erreur", error.message);
          else fetchRegistres();
        }
      }
    ]);
  };

  const renderRegistre = ({ item }: { item: any }) => (
  <TouchableOpacity
    style={styles.registreCard}
    onPress={() =>
      router.push({
        pathname: '/registre/[id]',
        params: { id: item.id }
      })
    }
    onLongPress={() =>
      Alert.alert("Actions sur registre", item.nom_prenom, [
        {
          text: "Voir détails",
          onPress: () =>
            router.push({
              pathname: '/registre/[id]',
              params: { id: item.id }
            })
        },
        {
          text: "Modifier",
          onPress: () =>
            router.push({
              pathname: '/registre',
              params: { id: item.id, dossierId }
            })
        },
        { text: "Supprimer", style: "destructive", onPress: () => handleDeleteRegistre(item.id) },
        { text: "Fermer", style: "cancel" }
      ])
    }
  >
    <Ionicons name="clipboard-outline" size={30} color="#007AFF" />
    <Text style={styles.registreName} numberOfLines={2}>{item.nom_prenom}</Text>
    <Text style={styles.registreDate}>{item.date}</Text>
  </TouchableOpacity>
);


  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: `Registres — ${nom}` }} />

      {/* Barre de recherche */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color="#555" />
        <TextInput
          placeholder="Rechercher..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
        />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 50 }} size="large" />
      ) : (
        <FlatList
          data={registres}
          renderItem={renderRegistre}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={{ padding: 15 }}
          ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 30 }}>Aucun registre</Text>}
        />
      )}

      {/* Bouton flottant pour ajouter un registre */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push({
          pathname: '/registre',
          params: { dossierId }
        })}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 15,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ccc'
  },
  searchInput: {
    marginLeft: 10,
    flex: 1
  },
  registreCard: {
    width: '45%',
    margin: '2.5%',
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    alignItems: 'center'
  },
  registreName: {
    marginTop: 10,
    fontWeight: '600'
  },
  registreDate: { fontSize: 12, color: '#555' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    backgroundColor: '#007AFF',
    padding: 14,
    borderRadius: 28,
    elevation: 6
  }
});
