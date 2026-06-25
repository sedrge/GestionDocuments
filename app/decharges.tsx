// app/decharges.tsx

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
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

export default function DechargesList() {
  const { dossierId, nom } = useLocalSearchParams();
  const router = useRouter();

  const [decharges, setDecharges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchDecharges = async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    let query = supabase
      .from('decharges')
      .select('*')
      .eq('annee_mois_id', dossierId)
      .eq('user_id', user.id);

    if (searchQuery.trim()) {
      const s = searchQuery.trim();
      query = query.or(
        `nom_vendeur.ilike.%${s}%,nom_acheteur.ilike.%${s}%,nom_representant.ilike.%${s}%,marque.ilike.%${s}%,modele.ilike.%${s}%,couleur.ilike.%${s}%,lieu.ilike.%${s}%,date.ilike.%${s}%`
      );
    }

    const { data } = await query.order('created_at', { ascending: false });
    setDecharges(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchDecharges();
  }, [searchQuery]);

  const handleDeleteDecharge = async (id: string) => {
    Alert.alert("Confirmer suppression", "Voulez‑vous supprimer cette décharge ?", [
      { text: "Annuler" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from('decharges').delete().eq('id', id);
          if (error) Alert.alert("Erreur", error.message);
          else fetchDecharges();
        }
      }
    ]);
  };

  const renderDecharge = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        router.push({
          pathname: '/decharge/[id]',
          params: { id: item.id }
        })
      }
      onLongPress={() =>
        Alert.alert("Actions sur décharge", item.nom_vendeur, [
          {
            text: "Voir détails",
            onPress: () =>
              router.push({
                pathname: '/decharge/[id]',
                params: { id: item.id }
              })
          },
          {
            text: "Modifier",
            onPress: () =>
              router.push({
                pathname: '/decharge',
                params: { id: item.id, dossierId }
              })
          },
          { text: "Supprimer", style: "destructive", onPress: () => handleDeleteDecharge(item.id) },
          { text: "Fermer", style: "cancel" }
        ])
      }
    >
      <Ionicons name="document-text-outline" size={30} color="#FF9500" />
      <Text style={styles.cardName} numberOfLines={2}>{item.nom_vendeur}</Text>
      <Text style={styles.cardSub} numberOfLines={1}>{item.marque} {item.modele}</Text>
      <Text style={styles.cardDate}>{item.date}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: `Décharges — ${nom}` }} />

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
          data={decharges}
          renderItem={renderDecharge}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={{ padding: 15 }}
          ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 30 }}>Aucune décharge</Text>}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push({
          pathname: '/decharge',
          params: { dossierId }
        })}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>
    </SafeAreaView>
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
  searchInput: { marginLeft: 10, flex: 1 },
  card: {
    width: '45%',
    margin: '2.5%',
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    alignItems: 'center'
  },
  cardName: { marginTop: 8, fontWeight: '600', textAlign: 'center' },
  cardSub: { marginTop: 4, fontSize: 11, color: '#777', textAlign: 'center' },
  cardDate: { fontSize: 11, color: '#555', marginTop: 2 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    backgroundColor: '#FF9500',
    padding: 14,
    borderRadius: 28,
    elevation: 6
  }
});
