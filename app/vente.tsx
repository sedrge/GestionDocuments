// app/vente.tsx — Point de Vente
// Recherche une moto par châssis/moteur/immatriculation ou contenu QR code,
// puis ouvre le formulaire réçu pré-rempli.

import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";
import { useTenant } from "../context/TenantContext";

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
  enterprise_id: string | null;
};

function formatPrix(p: number | null) {
  return p == null ? "—" : p.toLocaleString("fr-FR") + " FCFA";
}

function InfoChip({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.chip}>
      <Ionicons name={icon as any} size={13} color="#8E8E93" />
      <Text style={styles.chipLabel}>{label}: </Text>
      <Text style={styles.chipValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

export default function VenteScreen() {
  const router = useRouter();
  const { tenant } = useTenant();

  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [moto, setMoto] = useState<Moto | null>(null);

  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [qrInput, setQrInput] = useState("");

  // ── Recherche par texte libre (châssis / moteur / immat) ─────────────────────
  const searchMoto = async (query: string) => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setMoto(null);

    let req = supabase
      .from("motos")
      .select("*")
      .or(
        `numero_chassis.ilike.%${q}%,numero_moteur.ilike.%${q}%,immatriculation.ilike.%${q}%`
      );

    // Limiter à l'entreprise de l'utilisateur connecté si applicable
    if (tenant?.enterprise_id) {
      req = req.eq("enterprise_id", tenant.enterprise_id);
    }

    const { data, error } = await req.limit(1).maybeSingle();

    if (error) {
      Alert.alert("Erreur", error.message);
    } else if (!data) {
      Alert.alert(
        "Introuvable",
        "Aucune moto trouvée pour ce numéro. Vérifiez le châssis, le moteur ou l'immatriculation."
      );
    } else {
      setMoto(data as Moto);
    }
    setSearching(false);
  };

  // ── Recherche par ID (depuis QR) ─────────────────────────────────────────────
  const searchById = async (id: string) => {
    setSearching(true);
    setMoto(null);
    const { data, error } = await supabase
      .from("motos")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) {
      Alert.alert("Introuvable", "Moto introuvable via ce QR code.");
    } else {
      setMoto(data as Moto);
    }
    setSearching(false);
  };

  // ── Traitement du contenu QR (JSON ou texte libre) ───────────────────────────
  const parseQrAndSearch = () => {
    const raw = qrInput.trim();
    if (!raw) { setQrModalVisible(false); return; }

    try {
      const parsed = JSON.parse(raw);
      setQrModalVisible(false);
      setQrInput("");
      if (parsed.id) {
        searchById(parsed.id);
      } else if (parsed.chassis) {
        setSearchQuery(parsed.chassis);
        searchMoto(parsed.chassis);
      } else {
        Alert.alert("QR invalide", "Le QR code ne contient pas de données moto reconnues.");
      }
    } catch {
      // Texte brut → on le traite comme un numéro de châssis/moteur/immat
      setQrModalVisible(false);
      setSearchQuery(raw);
      setQrInput("");
      searchMoto(raw);
    }
  };

  // ── Démarrage du processus de vente ──────────────────────────────────────────
  const handleVendre = async () => {
    if (!moto) return;

    if (moto.etat?.toLowerCase() === "vendu") {
      return Alert.alert(
        "Déjà vendue",
        "Cette moto est déjà marquée comme vendue dans votre stock."
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return Alert.alert("Erreur", "Utilisateur non connecté.");

    // Trouver ou créer le dossier réçu du mois courant (format YYYY-MM)
    const now = new Date();
    const nomDossier = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    let dossierId: string | undefined;
    const { data: existing } = await supabase
      .from("annees_mois_recu")
      .select("id")
      .eq("user_id", user.id)
      .eq("nom", nomDossier)
      .maybeSingle();

    if (existing) {
      dossierId = existing.id;
    } else {
      const { data: created, error: createErr } = await supabase
        .from("annees_mois_recu")
        .insert([{ nom: nomDossier, user_id: user.id }])
        .select("id")
        .single();
      if (createErr) {
        return Alert.alert(
          "Erreur",
          "Impossible de créer le dossier réçu : " + createErr.message
        );
      }
      dossierId = created?.id;
    }

    // Naviguer vers le formulaire réçu avec les données pré-remplies
    router.push({
      pathname: "/recu",
      params: {
        dossierId,
        moto_id: moto.id,
        prefill_article: [moto.marque, moto.modele].filter(Boolean).join(" "),
        prefill_couleur: moto.couleur || "",
        prefill_marque: moto.marque || "",
        prefill_type: moto.type || "",
        prefill_chassis: moto.numero_chassis || "",
        prefill_moteur: moto.numero_moteur || "",
        prefill_prix: moto.prix_vente != null ? String(moto.prix_vente) : "",
      },
    } as any);
  };

  const etatColor = (etat: string | null) => {
    if (!etat) return "#8E8E93";
    switch (etat.toLowerCase()) {
      case "vendu": return "#FF3B30";
      case "neuf":  return "#34C759";
      default:       return "#FF9500";
    }
  };

  return (
    <SafeAreaView
      style={[
        styles.safe,
        { paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0 },
      ]}
    >
      <Stack.Screen options={{ title: "Point de Vente" }} />

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* En-tête visuel */}
        <View style={styles.heroSection}>
          <View style={styles.heroIcon}>
            <Ionicons name="storefront" size={36} color="#fff" />
          </View>
          <Text style={styles.heroTitle}>Point de Vente</Text>
          <Text style={styles.heroSubtitle}>
            Recherchez la moto par numéro ou QR code pour créer un réçu de vente instantané
          </Text>
        </View>

        {/* Recherche manuelle */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="search-outline" size={18} color="#1C1C1E" />
            <Text style={styles.cardTitle}>Recherche par numéro</Text>
          </View>
          <Text style={styles.cardHint}>
            Numéro de châssis · Numéro de moteur · Immatriculation
          </Text>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Ex : ABC123456 / 1234-TN-12..."
              placeholderTextColor="#AEAEB2"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() => searchMoto(searchQuery)}
            />
            <TouchableOpacity
              style={styles.searchBtn}
              onPress={() => searchMoto(searchQuery)}
              activeOpacity={0.8}
            >
              {searching ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="search" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Bouton QR */}
        <TouchableOpacity
          style={styles.qrCard}
          onPress={() => setQrModalVisible(true)}
          activeOpacity={0.8}
        >
          <View style={styles.qrIconWrap}>
            <Ionicons name="qr-code" size={28} color="#007AFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.qrCardTitle}>Scanner le QR code de la moto</Text>
            <Text style={styles.qrCardHint}>
              Scannez avec l'appareil photo, puis collez le texte résultant ici
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#007AFF" />
        </TouchableOpacity>

        {/* Résultat de recherche */}
        {searching && !moto && (
          <View style={styles.searchingBox}>
            <ActivityIndicator color="#34C759" />
            <Text style={styles.searchingText}>Recherche en cours...</Text>
          </View>
        )}

        {moto && (
          <View style={styles.motoCard}>
            {/* Titre moto */}
            <View style={styles.motoCardHeader}>
              <View style={styles.motoIconWrap}>
                <Ionicons name="bicycle" size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.motoName}>
                  {[moto.marque, moto.modele].filter(Boolean).join(" ") || "Moto"}
                </Text>
                {moto.categorie ? (
                  <Text style={styles.motoSub}>{moto.categorie}</Text>
                ) : null}
              </View>
              {moto.etat ? (
                <View style={[styles.etatBadge, { borderColor: etatColor(moto.etat) }]}>
                  <Text style={[styles.etatText, { color: etatColor(moto.etat) }]}>
                    {moto.etat.toUpperCase()}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Grille d'infos */}
            <View style={styles.chipGrid}>
              {moto.couleur       ? <InfoChip icon="color-palette-outline"  label="Couleur"    value={moto.couleur} /> : null}
              {moto.type          ? <InfoChip icon="layers-outline"          label="Type"       value={moto.type} /> : null}
              {moto.cylindree     ? <InfoChip icon="speedometer-outline"     label="Cylindrée"  value={moto.cylindree} /> : null}
              {moto.annee_fabrication ? <InfoChip icon="calendar-outline"   label="Année"      value={String(moto.annee_fabrication)} /> : null}
              {moto.numero_chassis ? <InfoChip icon="barcode-outline"        label="Châssis"    value={moto.numero_chassis} /> : null}
              {moto.numero_moteur  ? <InfoChip icon="construct-outline"      label="Moteur"     value={moto.numero_moteur} /> : null}
              {moto.immatriculation ? <InfoChip icon="card-outline"          label="Immat."     value={moto.immatriculation} /> : null}
            </View>

            {/* Prix */}
            <View style={styles.priceRow}>
              <Text style={styles.prixLabel}>Prix de vente</Text>
              <Text style={styles.prixValue}>{formatPrix(moto.prix_vente)}</Text>
            </View>

            {/* Séparateur */}
            <View style={styles.divider} />

            {/* Bouton vente ou message déjà vendu */}
            {moto.etat?.toLowerCase() === "vendu" ? (
              <View style={styles.soldBanner}>
                <Ionicons name="close-circle" size={20} color="#FF3B30" />
                <Text style={styles.soldText}>
                  Cette moto a déjà été vendue — elle ne figure plus dans le stock disponible
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.venteBtn}
                onPress={handleVendre}
                activeOpacity={0.85}
              >
                <Ionicons name="receipt-outline" size={20} color="#fff" />
                <Text style={styles.venteBtnText}>Créer le Réçu de Vente</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* Modal saisie QR */}
      <Modal
        visible={qrModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => { setQrModalVisible(false); setQrInput(""); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Ionicons name="qr-code-outline" size={22} color="#007AFF" />
                <Text style={styles.modalTitle}>Contenu du QR Code</Text>
              </View>
              <TouchableOpacity
                onPress={() => { setQrModalVisible(false); setQrInput(""); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalHint}>
              1. Ouvrez l'appareil photo de votre téléphone{"\n"}
              2. Pointez-le sur le QR code collé à la moto{"\n"}
              3. Copiez le texte affiché{"\n"}
              4. Collez-le ci-dessous et appuyez sur "Rechercher"
            </Text>

            <TextInput
              style={styles.qrTextInput}
              placeholder='Collez ici le contenu du QR code…'
              placeholderTextColor="#AEAEB2"
              value={qrInput}
              onChangeText={setQrInput}
              multiline
              autoFocus
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.qrConfirmBtn, !qrInput.trim() && { opacity: 0.5 }]}
              onPress={parseQrAndSearch}
              activeOpacity={0.85}
              disabled={!qrInput.trim()}
            >
              <Ionicons name="search" size={18} color="#fff" />
              <Text style={styles.qrConfirmBtnText}>Rechercher la moto</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F5F7" },
  container: { padding: 16, paddingBottom: 48 },

  // Hero
  heroSection: { alignItems: "center", paddingVertical: 28 },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "#34C759",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
    shadowColor: "#34C759",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  heroTitle: { fontSize: 26, fontWeight: "800", color: "#1C1C1E" },
  heroSubtitle: {
    fontSize: 14,
    color: "#8E8E93",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
    paddingHorizontal: 12,
  },

  // Card générique
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#1C1C1E" },
  cardHint: { fontSize: 12, color: "#8E8E93", marginBottom: 14 },

  // Recherche
  searchRow: { flexDirection: "row", gap: 8 },
  searchInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#E5E5EA",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: "#1C1C1E",
    backgroundColor: "#FAFAFA",
  },
  searchBtn: {
    backgroundColor: "#34C759",
    width: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#34C759",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },

  // QR card
  qrCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EBF5FF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: "#B3D9FF",
    gap: 12,
  },
  qrIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#D6EEFF",
    justifyContent: "center",
    alignItems: "center",
  },
  qrCardTitle: { fontSize: 15, fontWeight: "700", color: "#007AFF" },
  qrCardHint: { fontSize: 12, color: "#5A8AB8", marginTop: 3, lineHeight: 17 },

  // Searching
  searchingBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 20,
  },
  searchingText: { color: "#8E8E93", fontSize: 14 },

  // Moto card
  motoCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
  motoCardHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  motoIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: "#34C759",
    justifyContent: "center",
    alignItems: "center",
  },
  motoName: { fontSize: 18, fontWeight: "800", color: "#1C1C1E" },
  motoSub: { fontSize: 12, color: "#8E8E93", marginTop: 2 },
  etatBadge: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  etatText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },

  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F7",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
    maxWidth: "48%",
  },
  chipLabel: { fontSize: 11, color: "#8E8E93" },
  chipValue: { fontSize: 12, fontWeight: "600", color: "#1C1C1E", flexShrink: 1 },

  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F0FFF4",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  prixLabel: { fontSize: 14, color: "#34C759", fontWeight: "600" },
  prixValue: { fontSize: 20, fontWeight: "800", color: "#34C759" },

  divider: { height: 1, backgroundColor: "#F0F0F2", marginBottom: 14 },

  soldBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FFF0F0",
    borderRadius: 10,
    padding: 12,
  },
  soldText: { flex: 1, color: "#FF3B30", fontWeight: "600", fontSize: 13, lineHeight: 19 },

  venteBtn: {
    backgroundColor: "#34C759",
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#34C759",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  venteBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },

  // Modal QR
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 28,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D1D6",
    alignSelf: "center",
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  modalTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#1C1C1E" },
  modalHint: {
    fontSize: 13,
    color: "#636366",
    marginBottom: 16,
    lineHeight: 22,
    backgroundColor: "#F5F5F7",
    borderRadius: 10,
    padding: 12,
  },
  qrTextInput: {
    borderWidth: 1.5,
    borderColor: "#E5E5EA",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    minHeight: 100,
    color: "#1C1C1E",
    backgroundColor: "#FAFAFA",
    marginBottom: 16,
  },
  qrConfirmBtn: {
    backgroundColor: "#007AFF",
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  qrConfirmBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
