import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
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
import { FeatureGate } from "../../components/FeatureGate";

type Vente = {
  id: string;
  marque: string | null;
  modele: string | null;
  type: string | null;
  couleur: string | null;
  etat: string | null;
  prix_achat: number | null;
  prix_vente: number | null;
  nom_acheteur: string | null;
  telephone_acheteur: string | null;
  date_vente: string | null;
  notes_vente: string | null;
  created_at: string;
  moto_images?: { image_uri: string; is_principal: boolean }[];
};

type Period = "mois" | "trimestre" | "annee" | "tout" | "custom";

const PERIODS: { key: Period; label: string }[] = [
  { key: "mois", label: "Ce mois" },
  { key: "trimestre", label: "3 mois" },
  { key: "annee", label: "Cette année" },
  { key: "tout", label: "Tout" },
  { key: "custom", label: "Personnalisé" },
];

const parseDMY = (s: string): Date | null => {
  const p = s.split("/");
  if (p.length !== 3) return null;
  const d = new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]));
  return isNaN(d.getTime()) ? null : d;
};

const getDateRange = (
  p: Period,
  customFrom?: string,
  customTo?: string
): { start: Date | null; end: Date | null } => {
  const now = new Date();
  if (p === "mois") return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: null };
  if (p === "trimestre") {
    const d = new Date(now); d.setMonth(d.getMonth() - 3); return { start: d, end: null };
  }
  if (p === "annee") return { start: new Date(now.getFullYear(), 0, 1), end: null };
  if (p === "custom") {
    const end = customTo ? parseDMY(customTo) : null;
    if (end) end.setHours(23, 59, 59, 999);
    return { start: customFrom ? parseDMY(customFrom) : null, end };
  }
  return { start: null, end: null };
};

const formatDate = (s: string | null): string => {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
  });
};

const shortCFA = (n: number): string => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(".0", "") + "M FCFA";
  if (n >= 1_000) return Math.round(n / 1_000) + "k FCFA";
  return n.toLocaleString("fr-FR") + " FCFA";
};

// ─── Détail d'une vente ───────────────────────────────────────────────────────

function VenteDetailModal({ vente, onClose, onAnnuler }: {
  vente: Vente | null;
  onClose: () => void;
  onAnnuler: () => void;
}) {
  if (!vente) return null;

  const benefice = (vente.prix_vente || 0) - (vente.prix_achat || 0);
  const thumb = vente.moto_images?.find((i) => i.is_principal)?.image_uri
    || vente.moto_images?.[0]?.image_uri
    || null;

  return (
    <Modal visible={!!vente} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.detailOverlay}>
        <View style={styles.detailSheet}>
          {/* Header */}
          <View style={styles.detailHeader}>
            <Text style={styles.detailTitle}>Détails de la vente</Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20 }}>
            {/* Image moto */}
            {thumb ? (
              <Image source={{ uri: thumb }} style={styles.detailImage} resizeMode="cover" />
            ) : (
              <View style={[styles.detailImage, styles.detailImageEmpty]}>
                <Ionicons name="bicycle-outline" size={48} color="#ccc" />
              </View>
            )}

            {/* Nom moto */}
            <Text style={styles.detailMotoName}>
              {[vente.marque, vente.modele, vente.type].filter(Boolean).join(" ") || "Moto"}
            </Text>
            <Text style={styles.detailMotoSub}>
              {[vente.couleur, vente.etat].filter(Boolean).join(" · ") || "—"}
            </Text>

            {/* Financier */}
            <View style={styles.detailFinanRow}>
              <View style={styles.detailFinanCard}>
                <Text style={styles.detailFinanLabel}>Prix d'achat</Text>
                <Text style={styles.detailFinanVal}>
                  {vente.prix_achat ? shortCFA(vente.prix_achat) : "—"}
                </Text>
              </View>
              <View style={styles.detailFinanCard}>
                <Text style={styles.detailFinanLabel}>Prix de vente</Text>
                <Text style={[styles.detailFinanVal, { color: "#FF9500" }]}>
                  {vente.prix_vente ? shortCFA(vente.prix_vente) : "—"}
                </Text>
              </View>
              <View style={[styles.detailFinanCard, { borderColor: benefice >= 0 ? "#34C759" : "#FF3B30" }]}>
                <Text style={styles.detailFinanLabel}>Bénéfice</Text>
                <Text style={[styles.detailFinanVal, { color: benefice >= 0 ? "#34C759" : "#FF3B30" }]}>
                  {vente.prix_achat && vente.prix_vente ? (benefice >= 0 ? "+" : "") + shortCFA(benefice) : "—"}
                </Text>
              </View>
            </View>

            {/* Acheteur */}
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Acheteur</Text>
              <DetailRow icon="person-outline" label="Nom" value={vente.nom_acheteur || "—"} />
              <DetailRow icon="call-outline" label="Téléphone" value={vente.telephone_acheteur || "—"} />
              <DetailRow icon="calendar-outline" label="Date de vente" value={formatDate(vente.date_vente)} />
            </View>

            {vente.notes_vente && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Notes</Text>
                <Text style={styles.detailNotes}>{vente.notes_vente}</Text>
              </View>
            )}

            {/* Annuler la vente */}
            <TouchableOpacity
              style={styles.annulerBtn}
              onPress={onAnnuler}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-undo-outline" size={18} color="#FF3B30" />
              <Text style={styles.annulerBtnText}>Annuler la vente (remettre en stock)</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function DetailRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon as any} size={16} color="#8E8E93" />
      <Text style={styles.detailRowLabel}>{label}</Text>
      <Text style={styles.detailRowValue}>{value}</Text>
    </View>
  );
}

// ─── Carte vente ──────────────────────────────────────────────────────────────

function VenteCard({ vente, onPress }: { vente: Vente; onPress: () => void }) {
  const benefice = (vente.prix_vente || 0) - (vente.prix_achat || 0);
  const thumb = vente.moto_images?.find((i) => i.is_principal)?.image_uri
    || vente.moto_images?.[0]?.image_uri
    || null;

  return (
    <TouchableOpacity style={styles.venteCard} onPress={onPress} activeOpacity={0.85}>
      {/* Image */}
      {thumb ? (
        <Image source={{ uri: thumb }} style={styles.venteThumb} resizeMode="cover" />
      ) : (
        <View style={[styles.venteThumb, styles.venteThumbEmpty]}>
          <Ionicons name="bicycle-outline" size={24} color="#ccc" />
        </View>
      )}

      {/* Info */}
      <View style={styles.venteInfo}>
        <Text style={styles.venteTitle} numberOfLines={1}>
          {[vente.marque, vente.modele, vente.type].filter(Boolean).join(" ") || "Moto"}
        </Text>
        <View style={styles.venteMetaRow}>
          <Ionicons name="person-outline" size={12} color="#8E8E93" />
          <Text style={styles.venteMeta} numberOfLines={1}>
            {vente.nom_acheteur || "Acheteur inconnu"}
          </Text>
        </View>
        <View style={styles.venteMetaRow}>
          <Ionicons name="calendar-outline" size={12} color="#8E8E93" />
          <Text style={styles.venteMeta}>{formatDate(vente.date_vente)}</Text>
        </View>
      </View>

      {/* Prix */}
      <View style={styles.ventePriceCol}>
        <Text style={styles.ventePrix} numberOfLines={1}>
          {vente.prix_vente ? shortCFA(vente.prix_vente) : "—"}
        </Text>
        {vente.prix_achat && vente.prix_vente ? (
          <Text
            style={[
              styles.venteBenef,
              { color: benefice >= 0 ? "#34C759" : "#FF3B30" },
            ]}
          >
            {benefice >= 0 ? "+" : ""}
            {shortCFA(benefice)}
          </Text>
        ) : null}
        <Ionicons name="chevron-forward" size={16} color="#ccc" style={{ marginTop: 4 }} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Écran principal ──────────────────────────────────────────────────────────

function VentesContent() {
  const { tenant } = useTenant();
  const [ventes, setVentes] = useState<Vente[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>("mois");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [search, setSearch] = useState("");
  const [marqueFilter, setMarqueFilter] = useState<string>("Tous");
  const [selectedVente, setSelectedVente] = useState<Vente | null>(null);

  const fetchVentes = async () => {
    if (!tenant?.enterprise_id) { setLoading(false); return; }
    const { data, error } = await supabase
      .from("motos")
      .select("id,marque,modele,type,couleur,etat,prix_achat,prix_vente,nom_acheteur,telephone_acheteur,date_vente,notes_vente,created_at,moto_images(image_uri,is_principal)")
      .eq("enterprise_id", tenant.enterprise_id)
      .eq("statut", "vendu")
      .order("date_vente", { ascending: false, nullsFirst: false });

    if (!error && data) setVentes(data as Vente[]);
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => { fetchVentes(); }, [tenant?.enterprise_id]));
  const onRefresh = () => { setRefreshing(true); fetchVentes(); };

  const handleAnnulerVente = async () => {
    if (!selectedVente) return;
    Alert.alert(
      "Annuler la vente",
      "Cette moto sera remise en stock comme disponible.",
      [
        { text: "Non", style: "cancel" },
        {
          text: "Oui, annuler",
          style: "destructive",
          onPress: async () => {
            await supabase.from("motos").update({
              statut: "disponible",
              date_vente: null,
              nom_acheteur: null,
              telephone_acheteur: null,
              notes_vente: null,
            }).eq("id", selectedVente.id);
            setSelectedVente(null);
            fetchVentes();
          },
        },
      ]
    );
  };

  // Filtres
  const { start: periodStart, end: periodEnd } = getDateRange(period, customFrom, customTo);
  const ventesFiltrees = ventes.filter((v) => {
    const inPeriod = !periodStart && !periodEnd
      ? true
      : v.date_vente
      ? ((!periodStart || new Date(v.date_vente) >= periodStart) && (!periodEnd || new Date(v.date_vente) <= periodEnd))
      : false;
    const inMarque = marqueFilter === "Tous" || v.marque === marqueFilter;
    const inSearch = !search.trim() || [v.marque, v.modele, v.type, v.nom_acheteur, v.telephone_acheteur]
      .filter(Boolean).some((s) => s!.toLowerCase().includes(search.toLowerCase()));
    return inPeriod && inMarque && inSearch;
  });

  // Stats
  const totalCA = ventesFiltrees.reduce((s, v) => s + (v.prix_vente || 0), 0);
  const totalBenef = ventesFiltrees.reduce((s, v) => s + ((v.prix_vente || 0) - (v.prix_achat || 0)), 0);
  const moyennePrix = ventesFiltrees.length > 0 ? totalCA / ventesFiltrees.length : 0;

  // Marques distinctes
  const marques = ["Tous", ...Array.from(new Set(ventes.map((v) => v.marque).filter(Boolean))) as string[]];

  const periodeLabel = period === "custom"
    ? customFrom && customTo
      ? `Du ${customFrom} au ${customTo}`
      : customFrom
      ? `À partir du ${customFrom}`
      : customTo
      ? `Jusqu'au ${customTo}`
      : "Dates personnalisées"
    : PERIODS.find((p) => p.key === period)?.label ?? "";

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF9500" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Stats en-tête ─────────────────────────────────────────────────── */}
      <ScrollView
        style={styles.headerScroll}
        contentContainerStyle={styles.headerContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Sélecteur période */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.periodRow}
        >
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p.key}
              onPress={() => setPeriod(p.key)}
              style={[styles.chip, period === p.key && styles.chipActive]}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, period === p.key && styles.chipTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Dates personnalisées */}
        {period === "custom" && (
          <View style={styles.customDateContainer}>
            <View style={styles.customDateRow}>
              <View style={styles.customDateField}>
                <Text style={styles.customDateLabel}>Du (JJ/MM/AAAA)</Text>
                <TextInput
                  style={styles.customDateInput}
                  value={customFrom}
                  onChangeText={(t) => {
                    let v = t.replace(/[^0-9]/g, "");
                    if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2);
                    if (v.length > 5) v = v.slice(0, 5) + "/" + v.slice(5);
                    setCustomFrom(v.slice(0, 10));
                  }}
                  placeholder="01/01/2025"
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>
              <View style={styles.customDateField}>
                <Text style={styles.customDateLabel}>Au (JJ/MM/AAAA)</Text>
                <TextInput
                  style={styles.customDateInput}
                  value={customTo}
                  onChangeText={(t) => {
                    let v = t.replace(/[^0-9]/g, "");
                    if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2);
                    if (v.length > 5) v = v.slice(0, 5) + "/" + v.slice(5);
                    setCustomTo(v.slice(0, 10));
                  }}
                  placeholder="31/12/2025"
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>
            </View>
          </View>
        )}

        {/* Cartes stats */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { borderTopColor: "#34C759" }]}>
            <Text style={[styles.statCardNum, { color: "#34C759" }]}>
              {ventesFiltrees.length}
            </Text>
            <Text style={styles.statCardLabel}>Motos vendues</Text>
            <Text style={styles.statCardPeriod}>{periodeLabel}</Text>
          </View>
          <View style={[styles.statCard, { borderTopColor: "#FF9500" }]}>
            <Text style={[styles.statCardNum, { color: "#FF9500" }]} numberOfLines={1} adjustsFontSizeToFit>
              {shortCFA(totalCA)}
            </Text>
            <Text style={styles.statCardLabel}>Chiffre d'affaires</Text>
            <Text style={styles.statCardPeriod}>{periodeLabel}</Text>
          </View>
          <View style={[styles.statCard, { borderTopColor: totalBenef >= 0 ? "#5856D6" : "#FF3B30" }]}>
            <Text
              style={[styles.statCardNum, { color: totalBenef >= 0 ? "#5856D6" : "#FF3B30" }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {totalBenef >= 0 ? "+" : ""}{shortCFA(totalBenef)}
            </Text>
            <Text style={styles.statCardLabel}>Bénéfice estimé</Text>
            <Text style={styles.statCardPeriod}>{periodeLabel}</Text>
          </View>
          <View style={[styles.statCard, { borderTopColor: "#007AFF" }]}>
            <Text style={[styles.statCardNum, { color: "#007AFF" }]} numberOfLines={1} adjustsFontSizeToFit>
              {shortCFA(moyennePrix)}
            </Text>
            <Text style={styles.statCardLabel}>Prix moyen</Text>
            <Text style={styles.statCardPeriod}>Par moto</Text>
          </View>
        </View>

        {/* Recherche */}
        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color="#999" />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Moto, acheteur, téléphone…"
            placeholderTextColor="#bbb"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color="#ccc" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filtre par marque */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.marqueFilterRow}
        >
          {marques.map((m) => (
            <TouchableOpacity
              key={m}
              onPress={() => setMarqueFilter(m)}
              style={[styles.marqueChip, marqueFilter === m && styles.marqueChipActive]}
              activeOpacity={0.7}
            >
              <Text style={[styles.marqueChipText, marqueFilter === m && styles.marqueChipTextActive]}>
                {m}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Liste */}
        {ventesFiltrees.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="receipt-outline" size={48} color="#ddd" />
            <Text style={styles.emptyTitle}>Aucune vente trouvée</Text>
            <Text style={styles.emptyText}>
              {search || marqueFilter !== "Tous"
                ? "Essayez d'autres filtres"
                : `Aucune vente ${periodeLabel.toLowerCase()}`}
            </Text>
          </View>
        ) : (
          ventesFiltrees.map((v) => (
            <VenteCard
              key={v.id}
              vente={v}
              onPress={() => setSelectedVente(v)}
            />
          ))
        )}
      </ScrollView>

      {/* ── Modal détail ───────────────────────────────────────────────────── */}
      <VenteDetailModal
        vente={selectedVente}
        onClose={() => setSelectedVente(null)}
        onAnnuler={handleAnnulerVente}
      />
    </SafeAreaView>
  );
}

export default function VentesScreen() {
  return (
    <FeatureGate featureKey="ventes.actif" featureName="Historique Ventes">
      <VentesContent />
    </FeatureGate>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F2F2F7" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },

  headerScroll: { flex: 1 },
  headerContent: { paddingBottom: 40 },

  periodRow: { paddingHorizontal: 12, paddingVertical: 12, gap: 8 },
  customDateContainer: { paddingHorizontal: 12, paddingBottom: 8 },
  customDateRow: { flexDirection: "row", gap: 10 },
  customDateField: { flex: 1 },
  customDateLabel: { fontSize: 11, color: "#8E8E93", fontWeight: "600", marginBottom: 4 },
  customDateInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e5ea",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: "#1C1C1E",
  },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e5ea",
  },
  chipActive: { backgroundColor: "#FF9500", borderColor: "#FF9500" },
  chipText: { fontSize: 13, fontWeight: "600", color: "#666" },
  chipTextActive: { color: "#fff" },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    gap: 10,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderTopWidth: 3,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  statCardNum: { fontSize: 18, fontWeight: "800" },
  statCardLabel: { fontSize: 12, fontWeight: "600", color: "#1C1C1E", marginTop: 4 },
  statCardPeriod: { fontSize: 11, color: "#8E8E93", marginTop: 2 },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e5ea",
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: "#1C1C1E" },

  marqueFilterRow: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  marqueChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e5ea",
  },
  marqueChipActive: { backgroundColor: "#1C1C1E", borderColor: "#1C1C1E" },
  marqueChipText: { fontSize: 13, color: "#666", fontWeight: "600" },
  marqueChipTextActive: { color: "#fff" },

  venteCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 14,
    overflow: "hidden",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  venteThumb: { width: 80, height: 80, backgroundColor: "#f3f3f3" },
  venteThumbEmpty: { justifyContent: "center", alignItems: "center" },
  venteInfo: { flex: 1, paddingHorizontal: 12, paddingVertical: 10 },
  venteTitle: { fontSize: 14, fontWeight: "700", color: "#1C1C1E" },
  venteMetaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  venteMeta: { fontSize: 12, color: "#8E8E93" },
  ventePriceCol: { paddingRight: 14, alignItems: "flex-end" },
  ventePrix: { fontSize: 13, fontWeight: "700", color: "#FF9500" },
  venteBenef: { fontSize: 11, fontWeight: "600", marginTop: 2 },

  emptyBox: { alignItems: "center", paddingTop: 48, paddingHorizontal: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#999" },
  emptyText: { fontSize: 13, color: "#bbb", textAlign: "center" },

  // Modal détail
  detailOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end",
  },
  detailSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "92%",
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
  },
  detailTitle: { fontSize: 18, fontWeight: "800", color: "#1C1C1E" },
  detailImage: {
    width: "100%",
    height: 200,
    borderRadius: 14,
    backgroundColor: "#f3f3f3",
    marginBottom: 16,
  },
  detailImageEmpty: { justifyContent: "center", alignItems: "center" },
  detailMotoName: { fontSize: 20, fontWeight: "800", color: "#1C1C1E" },
  detailMotoSub: { fontSize: 14, color: "#8E8E93", marginTop: 4, marginBottom: 16 },
  detailFinanRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  detailFinanCard: {
    flex: 1,
    backgroundColor: "#f8f8f8",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: "#e5e5ea",
    alignItems: "center",
  },
  detailFinanLabel: { fontSize: 10, color: "#8E8E93", fontWeight: "600", textTransform: "uppercase" },
  detailFinanVal: { fontSize: 14, fontWeight: "800", color: "#1C1C1E", marginTop: 4, textAlign: "center" },
  detailSection: { marginBottom: 16 },
  detailSectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8E8E93",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
  },
  detailRowLabel: { fontSize: 13, color: "#8E8E93", width: 90 },
  detailRowValue: { fontSize: 13, fontWeight: "600", color: "#1C1C1E", flex: 1 },
  detailNotes: {
    fontSize: 14,
    color: "#444",
    lineHeight: 20,
    backgroundColor: "#f8f8f8",
    borderRadius: 10,
    padding: 12,
  },
  annulerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: "#FF3B30",
    borderRadius: 12,
  },
  annulerBtnText: { fontSize: 14, fontWeight: "700", color: "#FF3B30" },
});
