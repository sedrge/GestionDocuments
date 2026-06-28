// app/rendezvous.tsx
//
// Liste des rendez-vous : programmation, suivi du statut, édition rapide.

import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { Stack, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { cancelRdvReminders } from "../lib/notifications";
import { FeatureGate } from "../components/FeatureGate";

type Statut = "en_attente" | "reporte" | "annule" | "termine";

type RendezVous = {
  id: string;
  date_rdv: string | null;
  heure_rdv: string | null;
  lieu: string | null;
  nom_prenom: string | null;
  telephone: string | null;
  motif: string | null;
  description: string | null;
  statut: Statut;
  registre_id: string | null;
  created_at: string;
};

const STATUT_OPTIONS: { value: Statut | "tous"; label: string; color: string }[] = [
  { value: "tous", label: "Tous", color: "#666" },
  { value: "en_attente", label: "En attente", color: "#FF9500" },
  { value: "reporte", label: "Reporté", color: "#5856D6" },
  { value: "annule", label: "Annulé", color: "#FF3B30" },
  { value: "termine", label: "Terminé", color: "#34C759" },
];

const statutMeta = (s: Statut) =>
  STATUT_OPTIONS.find((o) => o.value === s) || STATUT_OPTIONS[1];

const formatDateFR = (iso: string | null) => {
  if (!iso) return "—";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

function RendezVousContent() {
  const router = useRouter();
  const [items, setItems] = useState<RendezVous[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState<Statut | "tous">("tous");

  const fetchRDV = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    let query = supabase
      .from("rendez_vous")
      .select("*")
      .eq("user_id", user.id);

    if (filterStatut !== "tous") {
      query = query.eq("statut", filterStatut);
    }

    const { data, error } = await query
      .order("date_rdv", { ascending: true, nullsFirst: false })
      .order("heure_rdv", { ascending: true, nullsFirst: false });

    if (error) {
      Alert.alert("Erreur", error.message);
      setItems([]);
    } else {
      setItems((data as RendezVous[]) || []);
    }
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchRDV();
    }, [filterStatut]),
  );

  const filtered = items.filter((r) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return [
      r.nom_prenom,
      r.telephone,
      r.lieu,
      r.motif,
      r.description,
      formatDateFR(r.date_rdv),
      r.heure_rdv,
    ]
      .filter(Boolean)
      .some((v) => v!.toLowerCase().includes(s));
  });

  const handleChangeStatut = (rdv: RendezVous) => {
    Alert.alert("Changer le statut", rdv.nom_prenom || "Rendez-vous", [
      { text: "En attente", onPress: () => updateStatut(rdv.id, "en_attente") },
      { text: "Reporté", onPress: () => updateStatut(rdv.id, "reporte") },
      { text: "Annulé", onPress: () => updateStatut(rdv.id, "annule") },
      { text: "Terminé", onPress: () => updateStatut(rdv.id, "termine") },
      { text: "Annuler", style: "cancel" },
    ]);
  };

  const updateStatut = async (id: string, statut: Statut) => {
    const { error } = await supabase
      .from("rendez_vous")
      .update({ statut, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) Alert.alert("Erreur", error.message);
    else fetchRDV();
  };

  const handleDelete = (rdv: RendezVous) => {
    Alert.alert("Supprimer ce rendez-vous", "Cette action est irréversible.", [
      { text: "Annuler" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          // Annule les rappels (push locaux + lignes pending) avant suppression
          await cancelRdvReminders(rdv.id);
          const { error } = await supabase
            .from("rendez_vous")
            .delete()
            .eq("id", rdv.id);
          if (error) Alert.alert("Erreur", error.message);
          else fetchRDV();
        },
      },
    ]);
  };

  const renderCard = ({ item }: { item: RendezVous }) => {
    const meta = statutMeta(item.statut);
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() =>
          router.push({
            pathname: "/rendezvous_form",
            params: { id: item.id },
          })
        }
        onLongPress={() =>
          Alert.alert("Actions", item.nom_prenom || "Rendez-vous", [
            {
              text: "Modifier",
              onPress: () =>
                router.push({
                  pathname: "/rendezvous_form",
                  params: { id: item.id },
                }),
            },
            { text: "Changer statut", onPress: () => handleChangeStatut(item) },
            {
              text: "Supprimer",
              style: "destructive",
              onPress: () => handleDelete(item),
            },
            { text: "Fermer", style: "cancel" },
          ])
        }
        activeOpacity={0.85}
      >
        <View style={styles.cardHeader}>
          <View style={styles.dateBlock}>
            <Ionicons name="calendar-outline" size={16} color="#5856D6" />
            <Text style={styles.dateText}>{formatDateFR(item.date_rdv)}</Text>
            {item.heure_rdv ? (
              <>
                <Ionicons
                  name="time-outline"
                  size={16}
                  color="#5856D6"
                  style={{ marginLeft: 10 }}
                />
                <Text style={styles.dateText}>{item.heure_rdv}</Text>
              </>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={() => handleChangeStatut(item)}
            style={[styles.statutBadge, { backgroundColor: meta.color }]}
          >
            <Text style={styles.statutBadgeText}>{meta.label}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.client} numberOfLines={1}>
          {item.nom_prenom || "Client non précisé"}
        </Text>

        {item.motif ? (
          <Text style={styles.motif} numberOfLines={2}>
            <Text style={{ fontWeight: "700" }}>Motif : </Text>
            {item.motif}
          </Text>
        ) : null}

        {item.lieu ? (
          <View style={styles.row}>
            <Ionicons name="location-outline" size={13} color="#666" />
            <Text style={styles.rowText} numberOfLines={1}>
              {item.lieu}
            </Text>
          </View>
        ) : null}

        {item.telephone ? (
          <View style={styles.row}>
            <Ionicons name="call-outline" size={13} color="#666" />
            <Text style={styles.rowText} numberOfLines={1}>
              {item.telephone}
            </Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: "Rendez-Vous" }} />

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color="#555" />
        <TextInput
          placeholder="Rechercher (client, motif, lieu...)"
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterRowContent}
      >
        {STATUT_OPTIONS.map((opt) => {
          const active = filterStatut === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              onPress={() => setFilterStatut(opt.value)}
              style={[
                styles.filterChip,
                active && { backgroundColor: opt.color, borderColor: opt.color },
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  active && { color: "#fff", fontWeight: "700" },
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 50 }} size="large" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderCard}
          contentContainerStyle={{ padding: 10, paddingBottom: 100 }}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {search || filterStatut !== "tous"
                ? "Aucun rendez-vous correspondant"
                : "Aucun rendez-vous programmé"}
            </Text>
          }
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/rendezvous_form")}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

export default function RendezVousList() {
  return (
    <FeatureGate featureKey="rendezvous.actif" featureName="Rendez-vous">
      <RendezVousContent />
    </FeatureGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f7" },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 15,
    marginTop: 15,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ccc",
    backgroundColor: "#fff",
  },
  searchInput: { marginLeft: 10, flex: 1, fontSize: 14 },
  filterRow: { maxHeight: 50, marginTop: 10 },
  filterRowContent: { paddingHorizontal: 12, alignItems: "center", gap: 8 },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },
  filterChipText: { fontSize: 12, color: "#444", fontWeight: "600" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  dateBlock: { flexDirection: "row", alignItems: "center", gap: 4 },
  dateText: { fontSize: 13, fontWeight: "700", color: "#333", marginLeft: 4 },
  statutBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },
  statutBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  client: { fontSize: 15, fontWeight: "700", color: "#222", marginBottom: 4 },
  motif: { fontSize: 13, color: "#444", marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  rowText: { fontSize: 12, color: "#666", marginLeft: 4, flex: 1 },
  empty: { textAlign: "center", marginTop: 50, color: "#999" },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 30,
    backgroundColor: "#5856D6",
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
  },
});
