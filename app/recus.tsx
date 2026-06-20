// app/recus.tsx

import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";

export default function RecusList() {
  const { dossierId, nom } = useLocalSearchParams();
  const router = useRouter();

  const [recus, setRecus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchRecus = async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    let query = supabase
      .from("recus")
      .select("*")
      .eq("annee_mois_id", dossierId)
      .eq("user_id", user.id);

    if (searchQuery.trim()) {
      const s = searchQuery.trim();
      query = query.or(
        `numero_facture.ilike.%${s}%,nom_client.ilike.%${s}%,adresse_client.ilike.%${s}%,marque.ilike.%${s}%,type.ilike.%${s}%,chassis_no.ilike.%${s}%,article.ilike.%${s}%`
      );
    }

    const { data } = await query.order("created_at", { ascending: false });
    setRecus(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRecus();
  }, [searchQuery]);

  const handleDeleteRecu = async (id: string) => {
    Alert.alert("Confirmer suppression", "Voulez‑vous supprimer ce réçu ?", [
      { text: "Annuler" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("recus").delete().eq("id", id);
          if (error) Alert.alert("Erreur", error.message);
          else fetchRecus();
        },
      },
    ]);
  };

  const renderRecu = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        router.push({
          pathname: "/recu/[id]",
          params: { id: item.id },
        })
      }
      onLongPress={() =>
        Alert.alert("Actions sur réçu", item.numero_facture, [
          {
            text: "Voir détails",
            onPress: () =>
              router.push({
                pathname: "/recu/[id]",
                params: { id: item.id },
              }),
          },
          {
            text: "Modifier",
            onPress: () =>
              router.push({
                pathname: "/recu",
                params: { id: item.id, dossierId },
              }),
          },
          {
            text: "Supprimer",
            style: "destructive",
            onPress: () => handleDeleteRecu(item.id),
          },
          { text: "Fermer", style: "cancel" },
        ])
      }
    >
      <Ionicons name="receipt-outline" size={30} color="#34C759" />
      <Text style={styles.cardName} numberOfLines={1}>
        {item.numero_facture}
      </Text>
      <Text style={styles.cardSub} numberOfLines={1}>
        {item.nom_client || "—"}
      </Text>
      <Text style={styles.cardSub} numberOfLines={1}>
        {item.marque} {item.type}
      </Text>
      <Text style={styles.cardDate}>{item.date}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: `Réçus — ${nom}` }} />

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
          data={recus}
          renderItem={renderRecu}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={{ padding: 15 }}
          ListEmptyComponent={
            <Text style={{ textAlign: "center", marginTop: 30 }}>Aucun réçu</Text>
          }
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() =>
          router.push({
            pathname: "/recu",
            params: { dossierId },
          })
        }
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    margin: 15,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  searchInput: { marginLeft: 10, flex: 1 },
  card: {
    width: "45%",
    margin: "2.5%",
    padding: 15,
    backgroundColor: "#f8f9fa",
    borderRadius: 10,
    alignItems: "center",
  },
  cardName: { marginTop: 8, fontWeight: "700", textAlign: "center", color: "#007AFF" },
  cardSub: { marginTop: 4, fontSize: 11, color: "#777", textAlign: "center" },
  cardDate: { fontSize: 11, color: "#555", marginTop: 2 },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 30,
    backgroundColor: "#34C759",
    padding: 14,
    borderRadius: 28,
    elevation: 6,
  },
});
