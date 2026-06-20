// app/annees_mois_decharge.tsx

import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function AnneesMoisDechargeScreen() {
  const router = useRouter();
  const [dossiers, setDossiers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDossier, setEditingDossier] = useState<any>(null);

  const fetchDossiers = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from('annees_mois_decharge')
      .select('*, decharges(id)')
      .eq('user_id', user.id)
      .order('nom');
    setDossiers(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchDossiers();
  }, []);

  const handleDeleteDossier = async (dossier: any) => {
    Alert.alert("Supprimer le dossier", `Supprimer "${dossier.nom}" et toutes ses décharges ?`, [
      { text: "Annuler" },
      {
        text: "Supprimer", style: "destructive", onPress: async () => {
          await supabase.from('decharges').delete().eq('annee_mois_id', dossier.id);
          const { error } = await supabase.from('annees_mois_decharge').delete().eq('id', dossier.id);
          if (error) Alert.alert("Erreur", error.message);
          else fetchDossiers();
        }
      }
    ]);
  };

  const renderFolder = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.folderCard}
      onPress={() => router.push({
        pathname: '/decharges',
        params: { dossierId: item.id, nom: item.nom }
      })}
      onLongPress={() =>
        Alert.alert("Actions sur le dossier", item.nom, [
          { text: "Renommer", onPress: () => setEditingDossier({ ...item }) },
          { text: "Supprimer", style: "destructive", onPress: () => handleDeleteDossier(item) },
          { text: "Fermer", style: "cancel" }
        ])
      }
    >
      <Ionicons name="folder" size={50} color="#FF9500" />
      <Text style={styles.folderName} numberOfLines={1}>{item.nom}</Text>
      <Text style={styles.folderCount}>{item.decharges?.length || 0} décharge{(item.decharges?.length || 0) !== 1 ? 's' : ''}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Dossiers Décharges" }} />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 50 }} size="large" />
      ) : (
        <FlatList
          data={dossiers}
          renderItem={renderFolder}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={{ padding: 15 }}
          ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 30 }}>Aucun dossier</Text>}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/annees_mois_decharge_new')}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>

      <Modal visible={!!editingDossier} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={{ fontWeight: 'bold', fontSize: 16 }}>Renommer le dossier</Text>
            <TextInput
              style={styles.modalInput}
              value={editingDossier?.nom}
              onChangeText={(t) => editingDossier && setEditingDossier({ ...editingDossier, nom: t })}
              autoFocus
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <TouchableOpacity onPress={() => setEditingDossier(null)}>
                <Text style={{ color: 'red', marginRight: 20 }}>Annuler</Text>
              </TouchableOpacity>
              <Button title="Ok" onPress={async () => {
                if (editingDossier && editingDossier.nom.trim()) {
                  const { error } = await supabase.from('annees_mois_decharge').update({ nom: editingDossier.nom.trim() }).eq('id', editingDossier.id);
                  if (error) Alert.alert("Erreur", error.message);
                  else { setEditingDossier(null); fetchDossiers(); }
                }
              }} />
            </View>
          </View>
        </View>
      </Modal>
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
  folderCount: {
    marginTop: 4,
    fontSize: 11,
    color: '#888',
    textAlign: 'center'
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    backgroundColor: '#FF9500',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modal: {
    width: '85%',
    padding: 25,
    borderRadius: 20,
    backgroundColor: '#fff'
  },
  modalInput: {
    borderBottomWidth: 1,
    borderColor: '#ccc',
    paddingVertical: 10,
    marginVertical: 20,
    fontSize: 15
  }
});
