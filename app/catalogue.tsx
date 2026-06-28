// app/catalogue.tsx
//
// Catalogue — vue scrollable montrant pour chaque moto :
//   • une petite description (marque, modèle, type, état, prix de vente)
//   • un carrousel d'images horizontal (droite → gauche) sous la description
// Recherche multi-champs en haut.

import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { FeatureGate } from "../components/FeatureGate";

const { width: WIN_W } = Dimensions.get("window");
const CARD_PADDING = 12;
const IMG_H = 200;

type Moto = {
  id: string;
  marque: string | null;
  modele: string | null;
  categorie: string | null;
  numero_chassis: string | null;
  numero_moteur: string | null;
  immatriculation: string | null;
  couleur: string | null;
  annee_fabrication: number | null;
  type: string | null;
  cylindree: string | null;
  prix_achat: number | null;
  prix_vente: number | null;
  etat: string | null;
  moto_images?: { id: string; image_uri: string; is_principal: boolean; position: number }[];
};

const matchMoto = (m: Moto, q: string): boolean => {
  if (!q) return true;
  const s = q.toLowerCase();
  return [
    m.marque, m.modele, m.type, m.categorie,
    m.numero_chassis, m.numero_moteur, m.immatriculation,
    m.couleur, m.cylindree, m.etat,
    m.annee_fabrication ? String(m.annee_fabrication) : "",
    m.prix_vente != null ? String(m.prix_vente) : "",
  ]
    .filter(Boolean)
    .some((v) => v!.toLowerCase().includes(s));
};

function CatalogueContent() {
  const router = useRouter();
  const [motos, setMotos] = useState<Moto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchMotos = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("motos")
      .select("*, moto_images(id, image_uri, is_principal, position)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    const list = (data || []) as Moto[];
    list.forEach((m) => {
      if (m.moto_images) {
        m.moto_images.sort((a, b) => {
          if (a.is_principal && !b.is_principal) return -1;
          if (!a.is_principal && b.is_principal) return 1;
          return (a.position ?? 0) - (b.position ?? 0);
        });
      }
    });
    setMotos(list);
    setLoading(false);
  };

  useEffect(() => { fetchMotos(); }, []);
  useFocusEffect(useCallback(() => { fetchMotos(); }, []));

  const filtered = motos.filter((m) => matchMoto(m, search.trim()));

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: "Catalogue" }} />

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color="#555" />
        <TextInput
          placeholder="Rechercher (marque, modèle, châssis, etc.)"
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={18} color="#888" />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 50 }} size="large" color="#FF9500" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 30 }}
          renderItem={({ item }) => (
            <MotoCatalogCard
              moto={item}
              onPress={() => router.push({ pathname: "/moto/[id]", params: { id: item.id } })}
            />
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {search ? "Aucun résultat" : "Aucune moto dans le catalogue"}
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

function MotoCatalogCard({ moto, onPress }: { moto: Moto; onPress: () => void }) {
  const router = useRouter();
  const imgs = moto.moto_images || [];
  const cardWidth = WIN_W - 24;
  const imgWidth = cardWidth - CARD_PADDING * 2;

  return (
    <View style={styles.card}>
      {/* En-tête : description */}
      <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {[moto.marque, moto.modele].filter(Boolean).join(" ") || "Moto"}
        </Text>
        <View style={styles.metaRow}>
          {moto.type ? <Chip label={`Type ${moto.type}`} /> : null}
          {moto.etat ? <Chip label={moto.etat} color="#34C759" /> : null}
          {moto.categorie ? <Chip label={moto.categorie} color="#5856D6" /> : null}
          {moto.couleur ? <Chip label={moto.couleur} color="#888" /> : null}
        </View>
        {moto.prix_vente != null ? (
          <Text style={styles.priceText}>
            {moto.prix_vente.toLocaleString("fr-FR")} FCFA
          </Text>
        ) : (
          <Text style={styles.priceText}>Prix non renseigné</Text>
        )}
      </TouchableOpacity>

      {/* Carrousel d'images en bas (swipe droite → gauche) */}
      {imgs.length > 0 ? (
        <View style={{ marginTop: 10 }}>
          <FlatList
            data={imgs}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(img) => img.id}
            getItemLayout={(_, i) => ({ length: imgWidth, offset: imgWidth * i, index: i })}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => router.push({ pathname: "/moto/[id]", params: { id: moto.id } })}
                activeOpacity={0.9}
              >
                <Image
                  source={{ uri: item.image_uri }}
                  style={{ width: imgWidth, height: IMG_H, borderRadius: 8 }}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            )}
          />
          {imgs.length > 1 ? (
            <Text style={styles.swipeHint}>{imgs.length} photos — glissez ←</Text>
          ) : null}
        </View>
      ) : (
        <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
          <View style={[styles.noImg, { width: imgWidth, height: IMG_H }]}>
            <Ionicons name="bicycle-outline" size={40} color="#bbb" />
            <Text style={styles.noImgText}>Pas de photo</Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function CatalogueScreen() {
  return (
    <FeatureGate featureKey="motos.catalogue" featureName="Catalogue">
      <CatalogueContent />
    </FeatureGate>
  );
}

function Chip({ label, color }: { label: string; color?: string }) {
  return (
    <View style={[styles.chip, color ? { backgroundColor: color } : null]}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f7" },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    margin: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 14 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: CARD_PADDING,
    marginBottom: 14,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  cardTitle: { fontSize: 17, fontWeight: "800", color: "#222" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#FF9500",
  },
  chipText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  priceText: { marginTop: 8, fontSize: 16, fontWeight: "800", color: "#FF9500" },
  noImg: {
    marginTop: 4,
    borderRadius: 8,
    backgroundColor: "#f1f1f3",
    justifyContent: "center",
    alignItems: "center",
  },
  noImgText: { color: "#999", marginTop: 6, fontSize: 12 },
  swipeHint: {
    textAlign: "center",
    color: "#888",
    fontSize: 11,
    marginTop: 6,
    fontStyle: "italic",
  },
  empty: { textAlign: "center", marginTop: 50, color: "#999" },
});
