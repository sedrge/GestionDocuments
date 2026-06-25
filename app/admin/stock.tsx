import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { useTenant } from "../../context/TenantContext";

type Moto = {
  id: string;
  marque: string | null;
  modele: string | null;
  type: string | null;
  couleur: string | null;
  etat: string | null;
  prix_achat: number | null;
  prix_vente: number | null;
  statut: string | null;
  immatriculation: string | null;
  numero_chassis: string | null;
  created_at: string;
  moto_images?: { image_uri: string; is_principal: boolean }[];
};

type FilterStatus = "tous" | "disponible" | "réservé";

const STATUS_FILTERS: { key: FilterStatus; label: string }[] = [
  { key: "tous", label: "Tous" },
  { key: "disponible", label: "Disponible" },
  { key: "réservé", label: "Réservé" },
];

const STATUS_COLORS: Record<string, string> = {
  disponible: "#34C759",
  réservé: "#FF9500",
  vendu: "#8E8E93",
};

const STATUS_LABELS: Record<string, string> = {
  disponible: "Disponible",
  réservé: "Réservé",
  vendu: "Vendu",
};

const todayFR = (): string => {
  const now = new Date();
  const j = String(now.getDate()).padStart(2, "0");
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${j}/${m}/${now.getFullYear()}`;
};
const frToISO = (fr: string): string => {
  const parts = fr.split("/");
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return fr;
};

// ─── Modal de vente ───────────────────────────────────────────────────────────

interface VenteModalProps {
  visible: boolean;
  moto: Moto | null;
  onClose: () => void;
  onConfirm: (data: {
    nom: string;
    tel: string;
    date: string;
    prix: string;
    notes: string;
  }) => void;
  saving: boolean;
}

function VenteModal({ visible, moto, onClose, onConfirm, saving }: VenteModalProps) {
  const [nom, setNom] = useState("");
  const [tel, setTel] = useState("");
  const [date, setDate] = useState(todayFR());
  const [prix, setPrix] = useState("");
  const [notes, setNotes] = useState("");

  React.useEffect(() => {
    if (moto) {
      setPrix(moto.prix_vente ? String(moto.prix_vente) : "");
      setNom("");
      setTel("");
      setDate(todayFR());
      setNotes("");
    }
  }, [moto]);

  const handleConfirm = () => {
    if (!nom.trim()) {
      Alert.alert("Champ requis", "Veuillez saisir le nom de l'acheteur.");
      return;
    }
    onConfirm({ nom, tel, date, prix, notes });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.modalSheet}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Enregistrer la vente</Text>
              <Text style={styles.modalSub} numberOfLines={1}>
                {[moto?.marque, moto?.modele, moto?.type].filter(Boolean).join(" ") || "Moto"}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            {/* Nom acheteur */}
            <Text style={styles.fieldLabel}>Nom de l'acheteur *</Text>
            <TextInput
              style={styles.fieldInput}
              value={nom}
              onChangeText={setNom}
              placeholder="Prénom et nom"
              autoCapitalize="words"
            />

            {/* Téléphone */}
            <Text style={styles.fieldLabel}>Téléphone</Text>
            <TextInput
              style={styles.fieldInput}
              value={tel}
              onChangeText={setTel}
              placeholder="+221 77 000 00 00"
              keyboardType="phone-pad"
            />

            {/* Date de vente */}
            <Text style={styles.fieldLabel}>Date de vente (JJ/MM/AAAA)</Text>
            <TextInput
              style={styles.fieldInput}
              value={date}
              onChangeText={(t) => {
                let v = t.replace(/[^0-9]/g, "");
                if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2);
                if (v.length > 5) v = v.slice(0, 5) + "/" + v.slice(5);
                setDate(v.slice(0, 10));
              }}
              placeholder="JJ/MM/AAAA"
              keyboardType="numeric"
              maxLength={10}
            />

            {/* Prix final */}
            <Text style={styles.fieldLabel}>Prix de vente final (FCFA)</Text>
            <TextInput
              style={styles.fieldInput}
              value={prix}
              onChangeText={setPrix}
              placeholder={moto?.prix_vente ? String(moto.prix_vente) : "0"}
              keyboardType="numeric"
            />
            {moto?.prix_achat && prix && (
              <Text style={styles.fieldHint}>
                Bénéfice estimé :{" "}
                <Text
                  style={{
                    fontWeight: "700",
                    color:
                      Number(prix) - moto.prix_achat >= 0 ? "#34C759" : "#FF3B30",
                  }}
                >
                  {(Number(prix) - moto.prix_achat).toLocaleString("fr-FR")} FCFA
                </Text>
              </Text>
            )}

            {/* Notes */}
            <Text style={styles.fieldLabel}>Notes / Observations</Text>
            <TextInput
              style={[styles.fieldInput, { height: 80, textAlignVertical: "top" }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Informations supplémentaires…"
              multiline
            />
          </ScrollView>

          <TouchableOpacity
            style={[styles.confirmBtn, saving && { opacity: 0.6 }]}
            onPress={handleConfirm}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.confirmBtnText}>Confirmer la vente</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Carte moto ───────────────────────────────────────────────────────────────

function MotoStockCard({
  moto,
  onPress,
  onSell,
  onReserver,
  onDispo,
  onDelete,
}: {
  moto: Moto;
  onPress: () => void;
  onSell: () => void;
  onReserver: () => void;
  onDispo: () => void;
  onDelete: () => void;
}) {
  const thumb = moto.moto_images?.find((i) => i.is_principal)?.image_uri
    || moto.moto_images?.[0]?.image_uri
    || null;

  const statut = moto.statut || "disponible";
  const statutColor = STATUS_COLORS[statut] ?? "#8E8E93";

  const showActions = () => {
    const options: { text: string; style?: any; onPress: () => void }[] = [
      { text: "Modifier", onPress },
      statut !== "disponible"
        ? { text: "Marquer disponible", onPress: onDispo }
        : { text: "Marquer réservé", onPress: onReserver },
      statut !== "vendu"
        ? { text: "Enregistrer vente", onPress: onSell }
        : null as any,
      { text: "Supprimer", style: "destructive", onPress: onDelete },
      { text: "Annuler", style: "cancel", onPress: () => {} },
    ].filter(Boolean);
    Alert.alert(
      [moto.marque, moto.modele].filter(Boolean).join(" ") || "Moto",
      "Choisissez une action",
      options
    );
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      onLongPress={showActions}
      activeOpacity={0.85}
    >
      {/* Image */}
      {thumb ? (
        <Image source={{ uri: thumb }} style={styles.cardThumb} resizeMode="cover" />
      ) : (
        <View style={[styles.cardThumb, styles.cardThumbEmpty]}>
          <Ionicons name="bicycle-outline" size={32} color="#ccc" />
        </View>
      )}

      {/* Badge statut */}
      <View style={[styles.statutBadge, { backgroundColor: statutColor + "22", borderColor: statutColor }]}>
        <View style={[styles.statutDot, { backgroundColor: statutColor }]} />
        <Text style={[styles.statutText, { color: statutColor }]}>
          {STATUS_LABELS[statut] ?? statut}
        </Text>
      </View>

      {/* Infos */}
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {[moto.marque, moto.modele].filter(Boolean).join(" ") || "Moto"}
        </Text>
        <Text style={styles.cardSub} numberOfLines={1}>
          {[moto.type, moto.couleur, moto.etat].filter(Boolean).join(" · ") || "—"}
        </Text>
        {moto.prix_vente != null && (
          <Text style={styles.cardPrice}>
            {moto.prix_vente.toLocaleString("fr-FR")} FCFA
          </Text>
        )}
        {moto.immatriculation && (
          <Text style={styles.cardImmat}>{moto.immatriculation}</Text>
        )}
      </View>

      {/* Bouton vente rapide */}
      {statut !== "vendu" && (
        <TouchableOpacity
          style={styles.sellFastBtn}
          onPress={onSell}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Ionicons name="bag-check-outline" size={18} color="#34C759" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

// ─── Écran principal ──────────────────────────────────────────────────────────

export default function StockScreen() {
  const router = useRouter();
  const { tenant } = useTenant();
  const [motos, setMotos] = useState<Moto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("tous");
  const [sellMoto, setSellMoto] = useState<Moto | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchMotos = async () => {
    if (!tenant?.enterprise_id) { setLoading(false); return; }
    const { data, error } = await supabase
      .from("motos")
      .select("id,marque,modele,type,couleur,etat,prix_achat,prix_vente,statut,immatriculation,numero_chassis,created_at,moto_images(image_uri,is_principal)")
      .eq("enterprise_id", tenant.enterprise_id)
      .neq("statut", "vendu")
      .order("created_at", { ascending: false });

    if (!error && data) setMotos(data as Moto[]);
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => { fetchMotos(); }, [tenant?.enterprise_id]));
  const onRefresh = () => { setRefreshing(true); fetchMotos(); };

  const handleUpdateStatut = async (id: string, statut: string) => {
    await supabase.from("motos").update({ statut }).eq("id", id);
    fetchMotos();
  };

  const handleVente = async (data: {
    nom: string; tel: string; date: string; prix: string; notes: string;
  }) => {
    if (!sellMoto) return;
    setSaving(true);
    const { error } = await supabase.from("motos").update({
      statut: "vendu",
      date_vente: data.date ? new Date(frToISO(data.date)).toISOString() : new Date().toISOString(),
      nom_acheteur: data.nom || null,
      telephone_acheteur: data.tel || null,
      notes_vente: data.notes || null,
      prix_vente: data.prix ? Number(data.prix) : sellMoto.prix_vente,
    }).eq("id", sellMoto.id);

    setSaving(false);
    if (error) {
      Alert.alert("Erreur", error.message);
    } else {
      setSellMoto(null);
      Alert.alert("Succès", "Vente enregistrée !");
      fetchMotos();
    }
  };

  const handleDelete = (moto: Moto) => {
    Alert.alert("Supprimer", "Cette action est irréversible.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          await supabase.from("moto_images").delete().eq("moto_id", moto.id);
          await supabase.from("motos").delete().eq("id", moto.id);
          fetchMotos();
        },
      },
    ]);
  };

  // Filtrage
  const filtered = motos.filter((m) => {
    const statut = m.statut || "disponible";
    if (filter !== "tous" && statut !== filter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [m.marque, m.modele, m.type, m.couleur, m.immatriculation, m.numero_chassis, m.etat]
      .filter(Boolean)
      .some((v) => v!.toLowerCase().includes(q));
  });

  const dispoCount = motos.filter((m) => !m.statut || m.statut === "disponible").length;
  const resCount = motos.filter((m) => m.statut === "réservé").length;

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: "#007AFF" }]}>{motos.length}</Text>
          <Text style={styles.statLabel}>En stock</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: "#34C759" }]}>{dispoCount}</Text>
          <Text style={styles.statLabel}>Disponible</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: "#FF9500" }]}>{resCount}</Text>
          <Text style={styles.statLabel}>Réservé</Text>
        </View>
      </View>

      {/* ── Recherche ──────────────────────────────────────────────────────── */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color="#999" />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Marque, modèle, immat, châssis…"
          placeholderTextColor="#bbb"
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close-circle" size={16} color="#ccc" />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Filtres ────────────────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {STATUS_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Liste ──────────────────────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#FF9500" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(m) => m.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF9500" />
          }
          renderItem={({ item }) => (
            <MotoStockCard
              moto={item}
              onPress={() => router.push({ pathname: "/moto/[id]", params: { id: item.id } } as any)}
              onSell={() => setSellMoto(item)}
              onReserver={() => handleUpdateStatut(item.id, "réservé")}
              onDispo={() => handleUpdateStatut(item.id, "disponible")}
              onDelete={() => handleDelete(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="bicycle-outline" size={48} color="#ddd" />
              <Text style={styles.emptyTitle}>Aucune moto trouvée</Text>
              <Text style={styles.emptyText}>
                {search ? "Essayez un autre terme de recherche" : "Ajoutez des motos pour les voir ici"}
              </Text>
            </View>
          }
        />
      )}

      {/* ── FAB ────────────────────────────────────────────────────────────── */}
      <TouchableOpacity style={styles.fab} onPress={() => router.push("/moto" as any)} activeOpacity={0.8}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* ── Modal vente ────────────────────────────────────────────────────── */}
      <VenteModal
        visible={sellMoto !== null}
        moto={sellMoto}
        onClose={() => setSellMoto(null)}
        onConfirm={handleVente}
        saving={saving}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F2F2F7" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },

  statsBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5ea",
  },
  statItem: { flex: 1, alignItems: "center" },
  statNum: { fontSize: 22, fontWeight: "800" },
  statLabel: { fontSize: 11, color: "#8E8E93", marginTop: 2 },
  statDivider: { width: StyleSheet.hairlineWidth, backgroundColor: "#e5e5ea" },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    margin: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e5ea",
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: "#1C1C1E" },

  filterRow: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e5ea",
  },
  filterChipActive: { backgroundColor: "#1C1C1E", borderColor: "#1C1C1E" },
  filterText: { fontSize: 13, fontWeight: "600", color: "#666" },
  filterTextActive: { color: "#fff" },

  listContent: { padding: 8, paddingBottom: 100 },
  row: { gap: 10, marginBottom: 10, paddingHorizontal: 4 },

  card: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  cardThumb: { width: "100%", height: 120, backgroundColor: "#f3f3f3" },
  cardThumbEmpty: { justifyContent: "center", alignItems: "center" },
  statutBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
  },
  statutDot: { width: 6, height: 6, borderRadius: 3 },
  statutText: { fontSize: 10, fontWeight: "700" },
  cardBody: { padding: 10 },
  cardTitle: { fontSize: 13, fontWeight: "700", color: "#1C1C1E" },
  cardSub: { fontSize: 11, color: "#8E8E93", marginTop: 2 },
  cardPrice: { fontSize: 13, fontWeight: "700", color: "#FF9500", marginTop: 4 },
  cardImmat: { fontSize: 10, color: "#aaa", marginTop: 2 },
  sellFastBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#fff",
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },

  emptyBox: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#999" },
  emptyText: { fontSize: 13, color: "#bbb", textAlign: "center" },

  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    backgroundColor: "#FF9500",
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#FF9500",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "92%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#1C1C1E" },
  modalSub: { fontSize: 13, color: "#8E8E93", marginTop: 2 },
  modalCloseBtn: { padding: 4 },
  modalBody: { padding: 20, gap: 2 },

  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#444",
    marginTop: 12,
    marginBottom: 4,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: "#e5e5ea",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: "#fafafa",
  },
  fieldHint: { fontSize: 12, color: "#8E8E93", marginTop: 4, marginLeft: 2 },

  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    margin: 20,
    backgroundColor: "#34C759",
    paddingVertical: 16,
    borderRadius: 14,
  },
  confirmBtnText: { fontSize: 16, fontWeight: "800", color: "#fff" },
});
