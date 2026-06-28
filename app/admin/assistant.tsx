import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { useFocusEffect } from "expo-router";
import { useTenant } from "../../context/TenantContext";
import { FeatureGate } from "../../components/FeatureGate";

const { width } = Dimensions.get("window");

// ─── Types ────────────────────────────────────────────────────────────────────
type Moto = {
  id: string;
  marque: string | null;
  modele: string | null;
  type: string | null;
  prix_achat: number | null;
  prix_vente: number | null;
  statut: string | null;
  date_vente: string | null;
  like_count: number | null;
  created_at: string;
};

// ─── Utilitaires ──────────────────────────────────────────────────────────────
const MOIS_COURTS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
const MOIS_LONGS  = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

const shortCFA = (n: number): string => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(".0", "") + "M FCFA";
  if (n >= 1_000) return Math.round(n / 1_000) + "k FCFA";
  return n.toLocaleString("fr-FR") + " FCFA";
};

// ─── Sous-composants ──────────────────────────────────────────────────────────

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.secTitle}>{title}</Text>
      {sub ? <Text style={styles.secSub}>{sub}</Text> : null}
    </View>
  );
}

type RecType = "urgent" | "warning" | "success" | "info";

function RecCard({ type, icon, title, desc }: { type: RecType; icon: string; title: string; desc: string }) {
  const color = type === "urgent" ? "#FF3B30" : type === "warning" ? "#FF9500" : type === "success" ? "#34C759" : "#007AFF";
  return (
    <View style={[styles.recCard, { borderLeftColor: color }]}>
      <View style={[styles.recIcon, { backgroundColor: color + "20" }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.recTitle, { color }]}>{title}</Text>
        <Text style={styles.recDesc}>{desc}</Text>
      </View>
    </View>
  );
}

function BarChart({
  data,
  color,
  suffix,
  maxVal,
}: {
  data: { label: string; value: number; highlight?: boolean }[];
  color: string;
  suffix: string;
  maxVal: number;
}) {
  const barMaxW = width - 120;
  return (
    <View style={{ gap: 10 }}>
      {data.map((d, i) => (
        <View key={i}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              {d.highlight && <Ionicons name="star" size={12} color="#FF9500" />}
              <Text style={[styles.barLabel, d.highlight && { color: "#FF9500", fontWeight: "700" }]}>{d.label}</Text>
            </View>
            <Text style={[styles.barVal, { color: d.highlight ? "#FF9500" : color }]}>{d.value}{suffix}</Text>
          </View>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: maxVal > 0 ? Math.max(barMaxW * d.value / maxVal, 6) : 6, backgroundColor: d.highlight ? "#FF9500" : color }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

function InsightChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.chip, { borderColor: color + "40", backgroundColor: color + "12" }]}>
      <Text style={[styles.chipVal, { color }]}>{value}</Text>
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

// ─── Écran principal ──────────────────────────────────────────────────────────
function AssistantContent() {
  const router = useRouter();
  const { tenant } = useTenant();
  const [motos, setMotos] = useState<Moto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!tenant?.enterprise_id) { setLoading(false); return; }
    const { data } = await supabase
      .from("motos")
      .select("id,marque,modele,type,prix_achat,prix_vente,statut,date_vente,like_count,created_at")
      .eq("enterprise_id", tenant.enterprise_id);
    if (data) setMotos(data as Moto[]);
    setLoading(false);
    setRefreshing(false);
  }, [tenant?.enterprise_id]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF2D55" />
        <Text style={styles.loadingText}>Analyse en cours…</Text>
      </View>
    );
  }

  // ── Calculs de base ──────────────────────────────────────────────────────────
  const vendues    = motos.filter(m => m.statut === "vendu");
  const stock      = motos.filter(m => !m.statut || m.statut === "disponible" || m.statut === "réservé");
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  // Ventes par mois (année en cours)
  const salesByMonth: number[] = Array(12).fill(0);
  const caByMonth:    number[] = Array(12).fill(0);
  vendues.forEach(m => {
    if (!m.date_vente) return;
    const d = new Date(m.date_vente);
    if (d.getFullYear() === currentYear) {
      salesByMonth[d.getMonth()]++;
      caByMonth[d.getMonth()] += m.prix_vente ?? 0;
    }
  });
  const maxMonthSales = Math.max(...salesByMonth, 1);
  const peakIdx = salesByMonth.indexOf(Math.max(...salesByMonth));
  const totalVentesAnnee = salesByMonth.reduce((s, v) => s + v, 0);
  const totalCAannee = caByMonth.reduce((s, v) => s + v, 0);

  // Ventes du mois en cours
  const ventesMoisActuel = salesByMonth[currentMonth];
  const caMoisActuel     = caByMonth[currentMonth];

  // Ventes par trimestre
  const q1 = salesByMonth.slice(0, 3).reduce((s, v) => s + v, 0);
  const q2 = salesByMonth.slice(3, 6).reduce((s, v) => s + v, 0);
  const q3 = salesByMonth.slice(6, 9).reduce((s, v) => s + v, 0);
  const q4 = salesByMonth.slice(9, 12).reduce((s, v) => s + v, 0);
  const bestQ = Math.max(q1, q2, q3, q4);

  // Stock par marque
  const stockParMarque: Record<string, number> = {};
  stock.forEach(m => { const k = m.marque ?? "Inconnu"; stockParMarque[k] = (stockParMarque[k] ?? 0) + 1; });

  // Ventes par marque (toutes périodes)
  const ventesParMarque: Record<string, number> = {};
  vendues.forEach(m => { const k = m.marque ?? "Inconnu"; ventesParMarque[k] = (ventesParMarque[k] ?? 0) + 1; });
  const topVentes = Object.entries(ventesParMarque).sort((a, b) => b[1] - a[1]).slice(0, 7);

  // Likes par marque (depuis le stock + vendues)
  const likesByBrand: Record<string, number> = {};
  motos.forEach(m => {
    const k = m.marque ?? "Inconnu";
    likesByBrand[k] = (likesByBrand[k] ?? 0) + (m.like_count ?? 0);
  });
  const topLikedBrands = Object.entries(likesByBrand)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7);

  // Motos individuelle les + likées
  const topLikedMotos = [...motos]
    .filter(m => (m.like_count ?? 0) > 0)
    .sort((a, b) => (b.like_count ?? 0) - (a.like_count ?? 0))
    .slice(0, 6);

  const totalLikes = motos.reduce((s, m) => s + (m.like_count ?? 0), 0);

  // Bénéfice total année
  const beneficeAnnee = vendues
    .filter(m => m.date_vente && new Date(m.date_vente).getFullYear() === currentYear)
    .reduce((s, m) => s + ((m.prix_vente ?? 0) - (m.prix_achat ?? 0)), 0);

  // Taux de vente global
  const tauxVente = motos.length > 0 ? Math.round((vendues.length / motos.length) * 100) : 0;

  // ── Recommandations ──────────────────────────────────────────────────────────
  const recs: { type: RecType; icon: string; title: string; desc: string }[] = [];

  topVentes.forEach(([brand, cnt]) => {
    const s = stockParMarque[brand] ?? 0;
    if (cnt >= 2 && s <= 1) recs.push({ type: "urgent", icon: "warning", title: `Stock critique : ${brand}`, desc: `${cnt} ventes réalisées, mais seulement ${s} en stock. Commandez dès maintenant.` });
    else if (cnt >= 2 && s <= 3) recs.push({ type: "warning", icon: "alert-circle", title: `Stock bas : ${brand}`, desc: `${cnt} ventes · ${s} en stock — envisagez un réapprovisionnement prochainement.` });
  });

  topLikedBrands.forEach(([brand, likes]) => {
    if ((stockParMarque[brand] ?? 0) === 0 && likes > 0) {
      recs.push({ type: "warning", icon: "heart", title: `${brand} : forte demande`, desc: `${likes} like(s) public(s) mais aucune moto en stock actuellement.` });
    }
  });

  if (peakIdx >= 0 && maxMonthSales > 0) {
    const moisSuivant = MOIS_LONGS[(peakIdx - 1 + 12) % 12];
    recs.push({ type: "info", icon: "calendar", title: `Préparez ${MOIS_LONGS[peakIdx]} (pic de ventes)`, desc: `Reconstituez votre stock avant ${moisSuivant} pour profiter de la meilleure période.` });
  }

  const bestQLabel = ["Q1 (Jan–Mar)", "Q2 (Avr–Jun)", "Q3 (Jul–Sep)", "Q4 (Oct–Déc)"];
  const bestQIdx = [q1, q2, q3, q4].indexOf(bestQ);
  if (bestQ > 0) recs.push({ type: "info", icon: "bar-chart", title: `Meilleur trimestre : ${bestQLabel[bestQIdx]}`, desc: `${bestQ} ventes · Anticipez les commandes de stock pour cette période.` });

  if (tauxVente >= 70) recs.push({ type: "success", icon: "trophy", title: "Excellent taux de vente !", desc: `${tauxVente}% des motos vendues. Pensez à diversifier le stock.` });
  else if (tauxVente >= 40) recs.push({ type: "success", icon: "trending-up", title: "Bonne performance !", desc: `Taux de vente de ${tauxVente}%. Mettez en avant les marques tendance.` });

  const topLikedBrand = topLikedBrands[0];
  const topVenteBrand  = topVentes[0];
  if (topLikedBrand && topVenteBrand && topLikedBrand[0] !== topVenteBrand[0]) {
    recs.push({ type: "info", icon: "flame", title: `Opportunité : ${topLikedBrand[0]}`, desc: `Marque la plus likée (${topLikedBrand[1]} likes) mais pas N°1 des ventes. Mettez-la en avant.` });
  }

  // ─── Rendu ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 50 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF2D55" colors={["#FF2D55"]} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color="#1C1C1E" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.headerTitle}>Assistant de gestion</Text>
          <Text style={styles.headerSub}>{tenant?.enterprise_name ?? "Mon Entreprise"}</Text>
        </View>
        <View style={[styles.aiChip]}>
          <Ionicons name="bulb" size={14} color="#FF2D55" />
          <Text style={{ fontSize: 11, fontWeight: "700", color: "#FF2D55" }}>IA</Text>
        </View>
      </View>

      {/* KPIs rapides */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 10 }}>
        <InsightChip label="Likes totaux" value={String(totalLikes)} color="#FF3B30" />
        <InsightChip label={`Ventes ${currentYear}`} value={String(totalVentesAnnee)} color="#34C759" />
        <InsightChip label={`CA ${currentYear}`} value={shortCFA(totalCAannee)} color="#FF9500" />
        <InsightChip label="Bénéfice" value={shortCFA(beneficeAnnee)} color={beneficeAnnee >= 0 ? "#5856D6" : "#FF3B30"} />
        <InsightChip label="Taux vente" value={`${tauxVente}%`} color="#007AFF" />
        <InsightChip label="En stock" value={String(stock.length)} color="#34C759" />
      </ScrollView>

      {/* Recommandations */}
      {recs.length > 0 && (
        <View style={styles.section}>
          <SectionTitle title="Recommandations" sub="Conseils pour optimiser votre gestion" />
          <View style={{ gap: 10 }}>
            {recs.map((r, i) => <RecCard key={i} {...r} />)}
          </View>
        </View>
      )}

      {/* Analyse saisonnière */}
      <View style={styles.section}>
        <SectionTitle title="Ventes par mois" sub={`Analyse saisonnière ${currentYear}`} />
        {totalVentesAnnee === 0 ? (
          <View style={styles.empty}><Ionicons name="bar-chart-outline" size={36} color="#ddd" /><Text style={styles.emptyText}>Aucune vente enregistrée cette année</Text></View>
        ) : (
          <>
            <BarChart
              data={MOIS_COURTS.map((label, idx) => ({ label, value: salesByMonth[idx], highlight: idx === peakIdx }))}
              color="#34C759"
              suffix=""
              maxVal={maxMonthSales}
            />
            <View style={[styles.insight, { marginTop: 14 }]}>
              <Ionicons name="information-circle" size={16} color="#007AFF" />
              <Text style={styles.insightText}>
                Pic de ventes en <Text style={{ fontWeight: "700" }}>{MOIS_LONGS[peakIdx]}</Text> avec {maxMonthSales} vente{maxMonthSales > 1 ? "s" : ""}.
                {"\n"}Reconstituez votre stock avant {MOIS_LONGS[(peakIdx - 1 + 12) % 12]}.
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Analyse trimestrielle */}
      {totalVentesAnnee > 0 && (
        <View style={styles.section}>
          <SectionTitle title="Vue trimestrielle" sub={`Ventes par trimestre ${currentYear}`} />
          <BarChart
            data={[
              { label: "T1 Jan–Mar", value: q1, highlight: bestQ === q1 },
              { label: "T2 Avr–Jun", value: q2, highlight: bestQ === q2 },
              { label: "T3 Jul–Sep", value: q3, highlight: bestQ === q3 },
              { label: "T4 Oct–Déc", value: q4, highlight: bestQ === q4 },
            ]}
            color="#007AFF"
            suffix=" vente(s)"
            maxVal={Math.max(q1, q2, q3, q4, 1)}
          />
        </View>
      )}

      {/* Marques les plus vendues */}
      <View style={styles.section}>
        <SectionTitle title="Marques les plus vendues" sub="Toutes périodes confondues" />
        {topVentes.length === 0 ? (
          <View style={styles.empty}><Ionicons name="bicycle-outline" size={36} color="#ddd" /><Text style={styles.emptyText}>Aucune vente enregistrée</Text></View>
        ) : (
          <>
            <BarChart
              data={topVentes.map(([label, value], i) => ({ label, value, highlight: i === 0 }))}
              color="#34C759"
              suffix=" vendue(s)"
              maxVal={topVentes[0]?.[1] ?? 1}
            />
            <View style={[styles.insight, { marginTop: 14 }]}>
              <Ionicons name="trophy" size={16} color="#FF9500" />
              <Text style={styles.insightText}>
                <Text style={{ fontWeight: "700" }}>{topVentes[0]?.[0]}</Text> est votre marque championne.
                Assurez-vous d'avoir du stock disponible en permanence.
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Marques les plus likées */}
      <View style={styles.section}>
        <SectionTitle title="Marques les plus demandées" sub="Classement par likes publics (intérêt clients)" />
        {topLikedBrands.length === 0 ? (
          <View style={styles.empty}><Ionicons name="heart-outline" size={36} color="#ddd" /><Text style={styles.emptyText}>Aucun like enregistré pour l'instant</Text></View>
        ) : (
          <>
            <BarChart
              data={topLikedBrands.map(([label, value], i) => ({ label, value, highlight: i === 0 }))}
              color="#FF3B30"
              suffix=" like(s)"
              maxVal={topLikedBrands[0]?.[1] ?? 1}
            />
            <View style={[styles.insight, { marginTop: 14 }]}>
              <Ionicons name="flame" size={16} color="#FF3B30" />
              <Text style={styles.insightText}>
                Les likes indiquent l'intérêt des visiteurs. Une marque très likée mais peu vendue est une opportunité à saisir.
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Motos les plus populaires */}
      {topLikedMotos.length > 0 && (
        <View style={styles.section}>
          <SectionTitle title="Motos les plus populaires" sub="Top par nombre de likes individuels" />
          <View style={{ gap: 0 }}>
            {topLikedMotos.map((m, i) => {
              const profit = (m.prix_vente ?? 0) - (m.prix_achat ?? 0);
              return (
                <View key={m.id} style={styles.motoRow}>
                  <View style={[styles.rankBadge, { backgroundColor: i === 0 ? "#FF9500" : "#f0f0f0" }]}>
                    <Text style={[styles.rankText, { color: i === 0 ? "#fff" : "#666" }]}>#{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.motoTitle} numberOfLines={1}>
                      {[m.marque, m.modele, m.type].filter(Boolean).join(" ") || "Moto sans nom"}
                    </Text>
                    <Text style={styles.motoSub}>
                      {m.statut === "vendu" ? "✓ Vendue" : m.statut === "réservé" ? "⏳ Réservée" : "📦 En stock"}
                      {m.prix_vente ? ` · ${shortCFA(m.prix_vente)}` : ""}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Ionicons name="heart" size={13} color="#FF3B30" />
                      <Text style={styles.likeCount}>{m.like_count}</Text>
                    </View>
                    {m.statut === "vendu" && m.prix_achat && m.prix_vente && (
                      <Text style={[styles.profitText, { color: profit >= 0 ? "#34C759" : "#FF3B30" }]}>
                        {profit >= 0 ? "+" : ""}{shortCFA(profit)}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Conseil stratégique stock vs demande */}
      <View style={styles.section}>
        <SectionTitle title="Stock vs Demande" sub="Marques à prioriser pour le réapprovisionnement" />
        {topVentes.length === 0 && topLikedBrands.length === 0 ? (
          <View style={styles.empty}><Ionicons name="analytics-outline" size={36} color="#ddd" /><Text style={styles.emptyText}>Pas encore assez de données</Text></View>
        ) : (
          <>
            {(() => {
              const allBrands = new Set([
                ...topVentes.map(([b]) => b),
                ...topLikedBrands.map(([b]) => b),
              ]);
              return [...allBrands].slice(0, 6).map(brand => {
                const ventes = ventesParMarque[brand] ?? 0;
                const likes  = likesByBrand[brand] ?? 0;
                const stock  = stockParMarque[brand] ?? 0;
                const score  = ventes * 3 + likes;
                const priority = score >= 9 ? "Haute" : score >= 4 ? "Moyenne" : "Faible";
                const pColor  = priority === "Haute" ? "#FF3B30" : priority === "Moyenne" ? "#FF9500" : "#8E8E93";
                return (
                  <View key={brand} style={styles.priorityRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.priorityBrand}>{brand}</Text>
                      <Text style={styles.prioritySub}>
                        {ventes} vente{ventes > 1 ? "s" : ""} · {likes} like{likes > 1 ? "s" : ""} · {stock} en stock
                      </Text>
                    </View>
                    <View style={[styles.priorityBadge, { borderColor: pColor, backgroundColor: pColor + "15" }]}>
                      <Text style={[styles.priorityText, { color: pColor }]}>{priority}</Text>
                    </View>
                  </View>
                );
              });
            })()}
            <View style={[styles.insight, { marginTop: 10 }]}>
              <Ionicons name="bulb" size={16} color="#5856D6" />
              <Text style={styles.insightText}>
                Priorité = (ventes × 3) + likes. Les marques à haute priorité génèrent le plus de revenus et d'intérêt client — réapprovisionnez-les en premier.
              </Text>
            </View>
          </>
        )}
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}

export default function AssistantScreen() {
  return (
    <FeatureGate featureKey="assistant_ia.actif" featureName="Assistant IA">
      <AssistantContent />
    </FeatureGate>
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
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5ea",
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#1C1C1E" },
  headerSub: { fontSize: 12, color: "#8E8E93", marginTop: 2 },
  aiChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#FF2D55",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#FFF0F3",
  },

  section: {
    backgroundColor: "#fff",
    marginBottom: 10,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  secTitle: { fontSize: 16, fontWeight: "700", color: "#1C1C1E" },
  secSub: { fontSize: 12, color: "#8E8E93", marginTop: 3 },

  chip: {
    minWidth: 90,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  chipVal: { fontSize: 18, fontWeight: "800" },
  chipLabel: { fontSize: 11, color: "#8E8E93", marginTop: 3, textAlign: "center" },

  recCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderLeftWidth: 4,
    paddingLeft: 12,
    paddingVertical: 12,
    backgroundColor: "#FAFAFA",
    borderRadius: 10,
  },
  recIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  recTitle: { fontSize: 13, fontWeight: "700", marginBottom: 3 },
  recDesc: { fontSize: 12, color: "#555", lineHeight: 18 },

  barLabel: { fontSize: 13, color: "#1C1C1E", flex: 1 },
  barVal: { fontSize: 13, fontWeight: "700" },
  barTrack: { height: 8, backgroundColor: "#f0f0f0", borderRadius: 4, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4 },

  insight: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#F0F7FF",
    borderRadius: 10,
    padding: 12,
  },
  insightText: { flex: 1, fontSize: 12, color: "#444", lineHeight: 18 },

  empty: { alignItems: "center", paddingVertical: 30, gap: 10 },
  emptyText: { fontSize: 13, color: "#bbb" },

  motoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
  },
  rankBadge: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  rankText: { fontSize: 11, fontWeight: "800" },
  motoTitle: { fontSize: 13, fontWeight: "600", color: "#1C1C1E" },
  motoSub: { fontSize: 11, color: "#8E8E93", marginTop: 2 },
  likeCount: { fontSize: 13, fontWeight: "700", color: "#FF3B30" },
  profitText: { fontSize: 11, fontWeight: "600", marginTop: 3 },

  priorityRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
    gap: 10,
  },
  priorityBrand: { fontSize: 13, fontWeight: "700", color: "#1C1C1E" },
  prioritySub: { fontSize: 11, color: "#8E8E93", marginTop: 2 },
  priorityBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  priorityText: { fontSize: 12, fontWeight: "700" },
});
