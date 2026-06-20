import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { useTenant } from "../../context/TenantContext";

const { width } = Dimensions.get("window");

type Moto = {
  id: string;
  marque: string | null;
  modele: string | null;
  type: string | null;
  prix_achat: number | null;
  prix_vente: number | null;
  statut: string | null;
  date_vente: string | null;
  nom_acheteur: string | null;
  created_at: string;
};

type Period = "mois" | "trimestre" | "annee" | "tout";

const PERIODS: { key: Period; label: string }[] = [
  { key: "mois", label: "Ce mois" },
  { key: "trimestre", label: "3 mois" },
  { key: "annee", label: "Cette année" },
  { key: "tout", label: "Tout" },
];

// ─── Sous-composants ──────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <View style={[styles.kpiCard, { borderLeftColor: color, borderLeftWidth: 4 }]}>
      <View style={[styles.kpiIconWrap, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <Text style={[styles.kpiValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiSub}>{sub}</Text>
    </View>
  );
}

function ActionBtn({
  icon,
  label,
  onPress,
  color,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  color: string;
}) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.actionBtnCircle, { backgroundColor: color }]}>
        <Ionicons name={icon as any} size={24} color="#fff" />
      </View>
      <Text style={styles.actionBtnLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function BarRow({
  label,
  value,
  max,
  color,
  suffix,
  rank,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  suffix: string;
  rank: number;
}) {
  const pct = max > 0 ? value / max : 0;
  const barMaxW = width - 80;
  return (
    <View style={styles.barRow}>
      <View style={styles.barLabelRow}>
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          <View style={[styles.rankBadge, { backgroundColor: rank === 1 ? "#FF9500" : "#e5e5ea" }]}>
            <Text style={[styles.rankText, { color: rank === 1 ? "#fff" : "#666" }]}>
              {rank}
            </Text>
          </View>
          <Text style={styles.barLabel} numberOfLines={1}>{label}</Text>
        </View>
        <Text style={[styles.barValueText, { color }]}>
          {value}{suffix}
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: Math.max(barMaxW * pct, 8), backgroundColor: color },
          ]}
        />
      </View>
    </View>
  );
}

// ─── Utilitaires ─────────────────────────────────────────────────────────────

const shortCFA = (n: number): string => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(".0", "") + "M FCFA";
  if (n >= 1_000) return Math.round(n / 1_000) + "k FCFA";
  return n.toLocaleString("fr-FR") + " FCFA";
};

const formatDate = (s: string | null): string => {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getPeriodStart = (period: Period): Date | null => {
  const now = new Date();
  if (period === "mois") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === "trimestre") {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 3);
    return d;
  }
  if (period === "annee") return new Date(now.getFullYear(), 0, 1);
  return null;
};

// ─── Écran principal ──────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const router = useRouter();
  const { tenant } = useTenant();
  const [motos, setMotos] = useState<Moto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>("mois");

  const fetchData = async () => {
    if (!tenant?.enterprise_id) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("motos")
      .select(
        "id,marque,modele,type,prix_achat,prix_vente,statut,date_vente,nom_acheteur,created_at"
      )
      .eq("enterprise_id", tenant.enterprise_id)
      .order("created_at", { ascending: false });

    if (!error && data) setMotos(data as Moto[]);
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [tenant?.enterprise_id])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // ── Calculs ──────────────────────────────────────────────────────────────────

  const periodStart = getPeriodStart(period);

  const disponibles = motos.filter(
    (m) => !m.statut || m.statut === "disponible" || m.statut === "réservé"
  );
  const reserves = motos.filter((m) => m.statut === "réservé");
  const vendues = motos.filter((m) => m.statut === "vendu");

  const vendusPeriod = vendues.filter((m) => {
    if (!periodStart) return true;
    if (!m.date_vente) return false;
    return new Date(m.date_vente) >= periodStart;
  });

  const ca = vendusPeriod.reduce((s, m) => s + (m.prix_vente || 0), 0);
  const benefice = vendusPeriod.reduce(
    (s, m) => s + ((m.prix_vente || 0) - (m.prix_achat || 0)),
    0
  );

  // Stock par marque (top 5)
  const stockParMarque: Record<string, number> = {};
  disponibles.forEach((m) => {
    const k = m.marque || "Inconnu";
    stockParMarque[k] = (stockParMarque[k] || 0) + 1;
  });
  const topStock = Object.entries(stockParMarque)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Ventes par marque (top 5)
  const ventesParMarque: Record<string, number> = {};
  vendusPeriod.forEach((m) => {
    const k = m.marque || "Inconnu";
    ventesParMarque[k] = (ventesParMarque[k] || 0) + 1;
  });
  const topVentes = Object.entries(ventesParMarque)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Dernières ventes
  const dernieresVentes = [...vendues]
    .sort(
      (a, b) =>
        new Date(b.date_vente || b.created_at).getTime() -
        new Date(a.date_vente || a.created_at).getTime()
    )
    .slice(0, 5);

  const periodeLabel = PERIODS.find((p) => p.key === period)?.label ?? "";

  // ─ Taux de vente ─────────────────────────────────────────────────────────────
  const totalMotosSaisies = motos.length;
  const tauxVente =
    totalMotosSaisies > 0
      ? Math.round((vendues.length / totalMotosSaisies) * 100)
      : 0;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF9500" />
        <Text style={styles.loadingText}>Chargement du tableau de bord…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#FF9500"
          colors={["#FF9500"]}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* ── En-tête ─────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerGreeting}>Tableau de bord</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {tenant?.enterprise_name || "Mon Entreprise"}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.notifBtn}
          onPress={() => router.push("/notifications" as any)}
          activeOpacity={0.7}
        >
          <Ionicons name="notifications-outline" size={24} color="#FF9500" />
        </TouchableOpacity>
      </View>

      {/* Sous-titre avec stats rapides */}
      <View style={styles.quickStats}>
        <View style={styles.quickStatItem}>
          <Text style={styles.quickStatVal}>{motos.length}</Text>
          <Text style={styles.quickStatLabel}>Total motos</Text>
        </View>
        <View style={styles.quickStatDivider} />
        <View style={styles.quickStatItem}>
          <Text style={[styles.quickStatVal, { color: "#34C759" }]}>{tauxVente}%</Text>
          <Text style={styles.quickStatLabel}>Taux de vente</Text>
        </View>
        <View style={styles.quickStatDivider} />
        <View style={styles.quickStatItem}>
          <Text style={[styles.quickStatVal, { color: "#FF9B00" }]}>{reserves.length}</Text>
          <Text style={styles.quickStatLabel}>Réservées</Text>
        </View>
      </View>

      {/* ── Sélecteur de période ─────────────────────────────────────────────── */}
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

      {/* ── KPI Cards ────────────────────────────────────────────────────────── */}
      <View style={styles.kpiGrid}>
        <KpiCard
          icon="layers"
          label="Stock disponible"
          value={disponibles.length.toString()}
          sub={`sur ${motos.length} total`}
          color="#007AFF"
        />
        <KpiCard
          icon="checkmark-circle"
          label="Motos vendues"
          value={vendusPeriod.length.toString()}
          sub={periodeLabel}
          color="#34C759"
        />
        <KpiCard
          icon="cash"
          label="Chiffre d'affaires"
          value={shortCFA(ca)}
          sub={periodeLabel}
          color="#FF9500"
        />
        <KpiCard
          icon="trending-up"
          label="Bénéfice estimé"
          value={shortCFA(benefice)}
          sub={periodeLabel}
          color={benefice >= 0 ? "#5856D6" : "#FF3B30"}
        />
      </View>

      {/* ── Actions rapides ──────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.secTitle}>Actions rapides</Text>
        <View style={styles.actionsRow}>
          <ActionBtn
            icon="layers-outline"
            label="Stock"
            onPress={() => router.push("/admin/stock" as any)}
            color="#007AFF"
          />
          <ActionBtn
            icon="bag-check-outline"
            label="Ventes"
            onPress={() => router.push("/admin/ventes" as any)}
            color="#34C759"
          />
          <ActionBtn
            icon="document-text-outline"
            label="Rapports"
            onPress={() => router.push("/admin/rapports" as any)}
            color="#FF9500"
          />
          <ActionBtn
            icon="people-outline"
            label="Équipe"
            onPress={() => router.push("/admin/users" as any)}
            color="#5856D6"
          />
        </View>
      </View>

      {/* ── Stock par marque ─────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.secHeader}>
          <View>
            <Text style={styles.secTitle}>Stock par marque</Text>
            <Text style={styles.secSub}>Motos disponibles</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/admin/stock" as any)}
            activeOpacity={0.7}
          >
            <Text style={styles.link}>Voir tout →</Text>
          </TouchableOpacity>
        </View>
        {topStock.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="bicycle-outline" size={32} color="#ccc" />
            <Text style={styles.emptyText}>Aucune moto en stock</Text>
          </View>
        ) : (
          topStock.map(([label, value], i) => (
            <BarRow
              key={label}
              label={label}
              value={value}
              max={topStock[0][1]}
              color="#007AFF"
              suffix=" moto(s)"
              rank={i + 1}
            />
          ))
        )}
      </View>

      {/* ── Marques les plus vendues ─────────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.secHeader}>
          <View>
            <Text style={styles.secTitle}>Marques les plus vendues</Text>
            <Text style={styles.secSub}>{periodeLabel}</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/admin/ventes" as any)}
            activeOpacity={0.7}
          >
            <Text style={styles.link}>Voir tout →</Text>
          </TouchableOpacity>
        </View>
        {topVentes.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="bar-chart-outline" size={32} color="#ccc" />
            <Text style={styles.emptyText}>Aucune vente sur cette période</Text>
          </View>
        ) : (
          topVentes.map(([label, value], i) => (
            <BarRow
              key={label}
              label={label}
              value={value}
              max={topVentes[0][1]}
              color="#34C759"
              suffix=" vendue(s)"
              rank={i + 1}
            />
          ))
        )}
      </View>

      {/* ── Dernières ventes ─────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.secHeader}>
          <Text style={styles.secTitle}>Dernières ventes</Text>
          <TouchableOpacity
            onPress={() => router.push("/admin/ventes" as any)}
            activeOpacity={0.7}
          >
            <Text style={styles.link}>Voir tout →</Text>
          </TouchableOpacity>
        </View>
        {dernieresVentes.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="receipt-outline" size={32} color="#ccc" />
            <Text style={styles.emptyText}>Aucune vente enregistrée</Text>
          </View>
        ) : (
          dernieresVentes.map((m) => (
            <View key={m.id} style={styles.venteRow}>
              <View style={styles.venteAvatar}>
                <Ionicons name="bicycle" size={18} color="#FF9500" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.venteTitle} numberOfLines={1}>
                  {[m.marque, m.modele, m.type].filter(Boolean).join(" ") || "Moto"}
                </Text>
                <Text style={styles.venteSub}>
                  {m.nom_acheteur || "Acheteur inconnu"} · {formatDate(m.date_vente)}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.ventePrice}>
                  {m.prix_vente ? shortCFA(m.prix_vente) : "—"}
                </Text>
                {m.prix_achat && m.prix_vente && (
                  <Text
                    style={[
                      styles.venteBenef,
                      {
                        color:
                          m.prix_vente - m.prix_achat >= 0 ? "#34C759" : "#FF3B30",
                      },
                    ]}
                  >
                    {m.prix_vente - m.prix_achat >= 0 ? "+" : ""}
                    {shortCFA(m.prix_vente - m.prix_achat)}
                  </Text>
                )}
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F2F2F7" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { color: "#888", fontSize: 14 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5ea",
  },
  headerLeft: { flex: 1 },
  headerGreeting: { fontSize: 12, color: "#8E8E93", fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.5 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#1C1C1E", marginTop: 2 },
  notifBtn: { padding: 8, marginLeft: 8 },

  quickStats: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5ea",
    marginBottom: 8,
  },
  quickStatItem: { flex: 1, alignItems: "center" },
  quickStatVal: { fontSize: 20, fontWeight: "800", color: "#1C1C1E" },
  quickStatLabel: { fontSize: 11, color: "#8E8E93", marginTop: 2 },
  quickStatDivider: { width: StyleSheet.hairlineWidth, backgroundColor: "#e5e5ea" },

  periodRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e5ea",
  },
  chipActive: { backgroundColor: "#FF9500", borderColor: "#FF9500" },
  chipText: { fontSize: 13, fontWeight: "600", color: "#666" },
  chipTextActive: { color: "#fff" },

  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    gap: 10,
    marginBottom: 8,
  },
  kpiCard: {
    width: (width - 44) / 2,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
  },
  kpiIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  kpiValue: { fontSize: 18, fontWeight: "800", marginBottom: 2 },
  kpiLabel: { fontSize: 12, fontWeight: "600", color: "#1C1C1E" },
  kpiSub: { fontSize: 11, color: "#8E8E93", marginTop: 2 },

  section: {
    backgroundColor: "#fff",
    marginHorizontal: 0,
    marginBottom: 10,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  secHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  secTitle: { fontSize: 16, fontWeight: "700", color: "#1C1C1E" },
  secSub: { fontSize: 12, color: "#8E8E93", marginTop: 2 },
  link: { fontSize: 13, color: "#FF9500", fontWeight: "600", marginTop: 2 },

  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 4,
  },
  actionBtn: { alignItems: "center", gap: 6 },
  actionBtnCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  actionBtnLabel: { fontSize: 12, fontWeight: "600", color: "#444" },

  barRow: { marginBottom: 12 },
  barLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  rankBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  rankText: { fontSize: 10, fontWeight: "800" },
  barLabel: { fontSize: 13, color: "#1C1C1E", fontWeight: "500", flex: 1 },
  barValueText: { fontSize: 13, fontWeight: "700" },
  barTrack: {
    height: 8,
    backgroundColor: "#f0f0f0",
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: { height: 8, borderRadius: 4 },

  emptyBox: { alignItems: "center", paddingVertical: 24, gap: 8 },
  emptyText: { fontSize: 13, color: "#aaa" },

  venteRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
    gap: 12,
  },
  venteAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFF3E0",
    justifyContent: "center",
    alignItems: "center",
  },
  venteTitle: { fontSize: 14, fontWeight: "600", color: "#1C1C1E" },
  venteSub: { fontSize: 12, color: "#8E8E93", marginTop: 2 },
  ventePrice: { fontSize: 13, fontWeight: "700", color: "#FF9500" },
  venteBenef: { fontSize: 11, fontWeight: "600", marginTop: 2 },
});
