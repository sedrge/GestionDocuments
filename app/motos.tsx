// app/motos.tsx
//
// Vue d'ensemble des motos sous forme de "dossiers" groupés par marque + type.
// Cliquer sur un dossier ouvre la liste des motos. On peut aussi ajouter une moto
// directement depuis cet écran — le classement se fait automatiquement.

import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  Alert,
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

const { width } = Dimensions.get("window");
const CARD_W = (width - 45) / 2;

type Moto = {
  id: string;
  marque: string | null;
  modele: string | null;
  type: string | null;
  categorie: string | null;
  numero_chassis: string | null;
  numero_moteur: string | null;
  immatriculation: string | null;
  couleur: string | null;
  annee_fabrication: number | null;
  cylindree: string | null;
  prix_achat: number | null;
  prix_vente: number | null;
  etat: string | null;
  moto_images?: { image_uri: string; is_principal: boolean; position: number }[];
};

type Folder = {
  key: string;
  marque: string;
  type: string | null;
  count: number;
  thumb: string | null;
  motos: Moto[];
};

const folderLabel = (f: Folder) =>
  f.type ? `${f.marque} ${f.type}` : f.marque;

const groupMotos = (motos: Moto[]): Folder[] => {
  // 1) On regroupe par marque
  const parMarque = new Map<string, Moto[]>();
  motos.forEach((m) => {
    const marque = (m.marque || "Sans marque").trim();
    if (!parMarque.has(marque)) parMarque.set(marque, []);
    parMarque.get(marque)!.push(m);
  });

  const folders: Folder[] = [];

  parMarque.forEach((listMarque, marque) => {
    const types = new Set(listMarque.map((m) => (m.type || "").trim()).filter(Boolean));
    if (types.size > 1) {
      // Plusieurs types → un dossier par (marque, type)
      types.forEach((t) => {
        const motosTypees = listMarque.filter((m) => (m.type || "").trim() === t);
        folders.push({
          key: `${marque}__${t}`,
          marque,
          type: t,
          count: motosTypees.length,
          thumb: pickThumb(motosTypees),
          motos: motosTypees,
        });
      });
      // Les motos de cette marque sans type renseigné → dossier marque seul
      const sansType = listMarque.filter((m) => !(m.type || "").trim());
      if (sansType.length > 0) {
        folders.push({
          key: `${marque}__`,
          marque,
          type: null,
          count: sansType.length,
          thumb: pickThumb(sansType),
          motos: sansType,
        });
      }
    } else {
      // Un seul type (ou aucun) → un seul dossier par marque
      folders.push({
        key: `${marque}__${types.size === 1 ? [...types][0] : ""}`,
        marque,
        type: types.size === 1 ? [...types][0] : null,
        count: listMarque.length,
        thumb: pickThumb(listMarque),
        motos: listMarque,
      });
    }
  });

  return folders.sort((a, b) => folderLabel(a).localeCompare(folderLabel(b)));
};

const pickThumb = (motos: Moto[]): string | null => {
  for (const m of motos) {
    const imgs = m.moto_images || [];
    const principal = imgs.find((i) => i.is_principal);
    if (principal) return principal.image_uri;
    if (imgs.length > 0) return imgs[0].image_uri;
  }
  return null;
};

const matchMoto = (m: Moto, q: string): boolean => {
  if (!q) return true;
  const s = q.toLowerCase();
  return [
    m.marque, m.modele, m.type, m.categorie,
    m.numero_chassis, m.numero_moteur, m.immatriculation,
    m.couleur, m.cylindree, m.etat,
    m.annee_fabrication ? String(m.annee_fabrication) : "",
  ]
    .filter(Boolean)
    .some((v) => v!.toLowerCase().includes(s));
};

export default function MotosScreen() {
  const router = useRouter();
  const [allMotos, setAllMotos] = useState<Moto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openedFolder, setOpenedFolder] = useState<Folder | null>(null);

  const fetchMotos = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("motos")
      .select("*, moto_images(image_uri, is_principal, position)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      Alert.alert("Erreur", error.message);
    }
    setAllMotos((data as Moto[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchMotos();
  }, []);

  // Recharger à chaque retour sur l'écran
  useFocusEffect(useCallback(() => { fetchMotos(); }, []));

  const handleDeleteMoto = (motoId: string) => {
    Alert.alert("Supprimer la moto", "Cette action est irréversible.", [
      { text: "Annuler" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          await supabase.from("moto_images").delete().eq("moto_id", motoId);
          const { error } = await supabase.from("motos").delete().eq("id", motoId);
          if (error) Alert.alert("Erreur", error.message);
          else fetchMotos();
        },
      },
    ]);
  };

  // ── Vue dossier ouvert : liste des motos du dossier ─────────────────────────
  if (openedFolder) {
    const filtered = openedFolder.motos.filter((m) => matchMoto(m, search));
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: folderLabel(openedFolder) }} />

        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => { setOpenedFolder(null); setSearch(""); }} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#FF9500" />
            <Text style={{ color: "#FF9500", fontSize: 15 }}>Retour</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#555" />
          <TextInput
            placeholder="Rechercher dans le dossier..."
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
          />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={2}
          renderItem={({ item }) => <MotoCard moto={item} onPress={() => router.push({ pathname: "/moto/[id]", params: { id: item.id } })} onLongPress={() => handleDeleteMoto(item.id)} />}
          contentContainerStyle={{ padding: 10, paddingBottom: 80 }}
          ListEmptyComponent={<Text style={styles.empty}>Aucune moto</Text>}
        />

        <TouchableOpacity style={styles.fab} onPress={() => router.push("/moto")}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  }

  // ── Vue principale : dossiers ──────────────────────────────────────────────
  // Si une recherche est en cours, on affiche les motos correspondantes à plat.
  const trimmedSearch = search.trim();
  const folders = groupMotos(allMotos);
  const folderFiltered = trimmedSearch
    ? folders.filter(
        (f) =>
          folderLabel(f).toLowerCase().includes(trimmedSearch.toLowerCase()) ||
          f.motos.some((m) => matchMoto(m, trimmedSearch)),
      )
    : folders;
  const flatMatching = trimmedSearch
    ? allMotos.filter((m) => matchMoto(m, trimmedSearch))
    : [];

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: "Motos" }} />

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color="#555" />
        <TextInput
          placeholder="Rechercher une moto (marque, châssis, immat...)"
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
        />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 50 }} size="large" />
      ) : (
        <FlatList
          data={folderFiltered}
          keyExtractor={(f) => f.key}
          numColumns={2}
          contentContainerStyle={{ padding: 10, paddingBottom: 80 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.folderCard}
              onPress={() => { setOpenedFolder(item); setSearch(""); }}
            >
              <View style={styles.folderThumbWrap}>
                {item.thumb ? (
                  <Image source={{ uri: item.thumb }} style={styles.folderThumb} resizeMode="cover" />
                ) : (
                  <View style={[styles.folderThumb, styles.folderThumbEmpty]}>
                    <Ionicons name="bicycle-outline" size={36} color="#bbb" />
                  </View>
                )}
              </View>
              <Text style={styles.folderName} numberOfLines={1}>{folderLabel(item)}</Text>
              <Text style={styles.folderCount}>
                {item.count} moto{item.count > 1 ? "s" : ""}
              </Text>
            </TouchableOpacity>
          )}
          ListHeaderComponent={
            trimmedSearch && flatMatching.length > 0 ? (
              <View style={styles.searchResults}>
                <Text style={styles.searchResultsTitle}>
                  Résultats ({flatMatching.length})
                </Text>
                <View style={styles.searchResultsGrid}>
                  {flatMatching.map((m) => (
                    <MotoCard
                      key={m.id}
                      moto={m}
                      onPress={() => router.push({ pathname: "/moto/[id]", params: { id: m.id } })}
                      onLongPress={() => handleDeleteMoto(m.id)}
                    />
                  ))}
                </View>
                <Text style={styles.searchResultsTitle}>Dossiers</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <Text style={styles.empty}>
              {trimmedSearch ? "Aucun résultat" : "Aucune moto enregistrée"}
            </Text>
          }
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => router.push("/moto")}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function MotoCard({
  moto,
  onPress,
  onLongPress,
}: {
  moto: Moto;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const imgs = moto.moto_images || [];
  const principal = imgs.find((i) => i.is_principal) || imgs[0];

  return (
    <TouchableOpacity style={styles.motoCard} onPress={onPress} onLongPress={onLongPress} activeOpacity={0.85}>
      {principal ? (
        <Image source={{ uri: principal.image_uri }} style={styles.motoThumb} resizeMode="cover" />
      ) : (
        <View style={[styles.motoThumb, styles.folderThumbEmpty]}>
          <Ionicons name="bicycle-outline" size={36} color="#bbb" />
        </View>
      )}
      <Text style={styles.motoName} numberOfLines={1}>
        {[moto.marque, moto.modele].filter(Boolean).join(" ") || "Moto"}
      </Text>
      <Text style={styles.motoSub} numberOfLines={1}>
        {[moto.type, moto.couleur, moto.etat].filter(Boolean).join(" · ") || "—"}
      </Text>
      {moto.prix_vente != null ? (
        <Text style={styles.motoPrice}>{moto.prix_vente.toLocaleString("fr-FR")} FCFA</Text>
      ) : null}
    </TouchableOpacity>
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
  searchInput: { marginLeft: 10, flex: 1, fontSize: 14 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingTop: 10,
  },
  backBtn: { flexDirection: "row", alignItems: "center" },
  folderCard: {
    width: CARD_W,
    margin: 5,
    padding: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    elevation: 2,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  folderThumbWrap: {
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#f3f3f3",
  },
  folderThumb: { width: 80, height: 80 },
  folderThumbEmpty: { justifyContent: "center", alignItems: "center" },
  folderName: { marginTop: 8, fontWeight: "700", fontSize: 14, textAlign: "center" },
  folderCount: { marginTop: 2, fontSize: 11, color: "#888" },
  motoCard: {
    width: CARD_W,
    margin: 5,
    padding: 8,
    backgroundColor: "#fff",
    borderRadius: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  motoThumb: { width: "100%", height: 110, borderRadius: 8, backgroundColor: "#f3f3f3" },
  motoName: { marginTop: 6, fontWeight: "700", fontSize: 13 },
  motoSub: { marginTop: 2, fontSize: 11, color: "#666" },
  motoPrice: { marginTop: 4, fontSize: 12, fontWeight: "700", color: "#FF9500" },
  empty: { textAlign: "center", marginTop: 50, color: "#999" },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 30,
    backgroundColor: "#FF9500",
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
  },
  searchResults: {
    marginTop: 5,
    marginBottom: 10,
  },
  searchResultsTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#888",
    marginLeft: 8,
    marginVertical: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  searchResultsGrid: { flexDirection: "row", flexWrap: "wrap" },
});
