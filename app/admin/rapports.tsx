import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import * as Print from "expo-print";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { printAndSharePdf } from "../../lib/sharePdf";
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
  nom_acheteur: string | null;
  telephone_acheteur: string | null;
  date_vente: string | null;
  created_at: string;
};

type ReportType = "stock" | "ventes" | "complet";
type Period = "mois" | "trimestre" | "annee" | "tout" | "custom";

const REPORT_TYPES: { key: ReportType; label: string; icon: string; desc: string }[] = [
  {
    key: "stock",
    label: "Rapport de Stock",
    icon: "layers-outline",
    desc: "Liste des motos disponibles et réservées",
  },
  {
    key: "ventes",
    label: "Rapport de Ventes",
    icon: "bag-check-outline",
    desc: "Historique des ventes avec bénéfices",
  },
  {
    key: "complet",
    label: "Rapport Complet",
    icon: "document-text-outline",
    desc: "Stock + Ventes + Analyse complète",
  },
];

const PERIODS: { key: Period; label: string }[] = [
  { key: "mois", label: "Ce mois" },
  { key: "trimestre", label: "3 derniers mois" },
  { key: "annee", label: "Cette année" },
  { key: "tout", label: "Tout l'historique" },
  { key: "custom", label: "Dates personnalisées" },
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
    const d = new Date(now);
    d.setMonth(d.getMonth() - 3);
    return { start: d, end: null };
  }
  if (p === "annee") return { start: new Date(now.getFullYear(), 0, 1), end: null };
  if (p === "custom") {
    const end = customTo ? parseDMY(customTo) : null;
    if (end) end.setHours(23, 59, 59, 999);
    return { start: customFrom ? parseDMY(customFrom) : null, end };
  }
  return { start: null, end: null };
};

const fmt = (n: number) => n.toLocaleString("fr-FR") + " FCFA";
const shortFmt = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(".0", "") + "M FCFA";
  if (n >= 1_000) return Math.round(n / 1_000) + "k FCFA";
  return n.toLocaleString("fr-FR") + " FCFA";
};
const fmtDate = (s: string | null) => {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
};
const nowStr = () =>
  new Date().toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

// ─── Génération HTML ──────────────────────────────────────────────────────────

function generateHtml(
  report: ReportType,
  motos: Moto[],
  entrepriseName: string,
  periode: string,
  periodStart: Date | null,
  periodEnd: Date | null = null
): string {
  const disponibles = motos.filter((m) => !m.statut || m.statut === "disponible");
  const reserves = motos.filter((m) => m.statut === "réservé");
  const vendues = motos.filter((m) => m.statut === "vendu");
  const vendusPeriod = vendues.filter((m) => {
    if (!periodStart && !periodEnd) return true;
    if (!m.date_vente) return false;
    const d = new Date(m.date_vente);
    return (!periodStart || d >= periodStart) && (!periodEnd || d <= periodEnd);
  });

  const totalCA = vendusPeriod.reduce((s, m) => s + (m.prix_vente || 0), 0);
  const totalBenef = vendusPeriod.reduce((s, m) => s + ((m.prix_vente || 0) - (m.prix_achat || 0)), 0);

  // Marques stats pour stock
  const stockParMarque: Record<string, number> = {};
  [...disponibles, ...reserves].forEach((m) => {
    const k = m.marque || "Inconnu";
    stockParMarque[k] = (stockParMarque[k] || 0) + 1;
  });
  const marqueStockRows = Object.entries(stockParMarque)
    .sort((a, b) => b[1] - a[1])
    .map(([m, c]) => `<tr><td>${m}</td><td style="text-align:center;font-weight:700">${c}</td></tr>`)
    .join("");

  // Marques stats pour ventes
  const ventesParMarque: Record<string, { count: number; ca: number; benef: number }> = {};
  vendusPeriod.forEach((m) => {
    const k = m.marque || "Inconnu";
    if (!ventesParMarque[k]) ventesParMarque[k] = { count: 0, ca: 0, benef: 0 };
    ventesParMarque[k].count++;
    ventesParMarque[k].ca += m.prix_vente || 0;
    ventesParMarque[k].benef += (m.prix_vente || 0) - (m.prix_achat || 0);
  });
  const marqueVentesRows = Object.entries(ventesParMarque)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([m, s]) => `
      <tr>
        <td>${m}</td>
        <td style="text-align:center;font-weight:700;color:#16a34a">${s.count}</td>
        <td style="text-align:right">${fmt(s.ca)}</td>
        <td style="text-align:right;color:${s.benef >= 0 ? "#16a34a" : "#dc2626"}">
          ${s.benef >= 0 ? "+" : ""}${fmt(s.benef)}
        </td>
      </tr>`)
    .join("");

  // Lignes du tableau stock
  const stockTableRows = [...disponibles, ...reserves]
    .map((m) => `
      <tr>
        <td>${[m.marque, m.modele, m.type].filter(Boolean).join(" ") || "—"}</td>
        <td>${m.etat || "—"}</td>
        <td>${m.couleur || "—"}</td>
        <td>${m.immatriculation || "—"}</td>
        <td style="color:${m.statut === "réservé" ? "#d97706" : "#16a34a"};font-weight:700">
          ${m.statut === "réservé" ? "Réservé" : "Disponible"}
        </td>
        <td style="text-align:right">${m.prix_vente ? fmt(m.prix_vente) : "—"}</td>
      </tr>`)
    .join("");

  // Lignes du tableau ventes
  const ventesTableRows = vendusPeriod
    .map((m) => {
      const benef = (m.prix_vente || 0) - (m.prix_achat || 0);
      return `
        <tr>
          <td>${[m.marque, m.modele, m.type].filter(Boolean).join(" ") || "—"}</td>
          <td>${m.nom_acheteur || "—"}</td>
          <td>${m.telephone_acheteur || "—"}</td>
          <td>${fmtDate(m.date_vente)}</td>
          <td style="text-align:right">${m.prix_vente ? fmt(m.prix_vente) : "—"}</td>
          <td style="text-align:right;color:${benef >= 0 ? "#16a34a" : "#dc2626"};font-weight:700">
            ${m.prix_achat && m.prix_vente ? (benef >= 0 ? "+" : "") + fmt(benef) : "—"}
          </td>
        </tr>`;
    })
    .join("");

  const showStock = report === "stock" || report === "complet";
  const showVentes = report === "ventes" || report === "complet";

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Rapport — ${entrepriseName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, Arial, sans-serif; color: #1a1a1a; background: #fff; font-size: 13px; }

    .header { background: linear-gradient(135deg, #FF9500, #FF6B00); color: #fff; padding: 32px 40px 24px; }
    .header-top { display: flex; justify-content: space-between; align-items: flex-start; }
    .enterprise { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
    .report-type { font-size: 14px; opacity: 0.85; margin-top: 4px; }
    .header-meta { text-align: right; font-size: 12px; opacity: 0.8; line-height: 1.6; }
    .periode-badge {
      display: inline-block; background: rgba(255,255,255,0.25);
      padding: 6px 14px; border-radius: 20px; font-weight: 700;
      font-size: 13px; margin-top: 16px;
    }

    .kpi-row { display: flex; gap: 0; background: #fff; border-bottom: 1px solid #e5e7eb; }
    .kpi { flex: 1; padding: 20px 16px; text-align: center; border-right: 1px solid #e5e7eb; }
    .kpi:last-child { border-right: none; }
    .kpi-val { font-size: 22px; font-weight: 800; }
    .kpi-label { font-size: 11px; color: #6b7280; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }

    .content { padding: 32px 40px; }

    h2 {
      font-size: 17px; font-weight: 800; color: #111;
      margin-bottom: 16px; padding-bottom: 8px;
      border-bottom: 2px solid #FF9500;
      display: flex; align-items: center; gap: 8px;
    }
    h2::before { content: ""; width: 4px; height: 18px; background: #FF9500; border-radius: 2px; }

    .section { margin-bottom: 40px; }

    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th {
      background: #f3f4f6; text-align: left; padding: 10px 12px;
      font-weight: 700; font-size: 11px; text-transform: uppercase;
      letter-spacing: 0.4px; color: #374151; border-bottom: 1px solid #d1d5db;
    }
    td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; vertical-align: middle; }
    tr:hover td { background: #fafafa; }
    tr:last-child td { border-bottom: none; }

    .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 32px; }
    .summary-card {
      background: #f9fafb; border-radius: 12px; padding: 16px 20px;
      border-left: 4px solid #FF9500;
    }
    .summary-card.green { border-left-color: #16a34a; }
    .summary-card.blue { border-left-color: #2563eb; }
    .summary-card.purple { border-left-color: #7c3aed; }
    .summary-card-val { font-size: 20px; font-weight: 800; color: #111; }
    .summary-card-label { font-size: 12px; color: #6b7280; margin-top: 4px; }

    .footer {
      margin-top: 40px; padding: 20px 40px;
      background: #f9fafb; border-top: 1px solid #e5e7eb;
      display: flex; justify-content: space-between; align-items: center;
      font-size: 11px; color: #9ca3af;
    }
    .footer strong { color: #374151; }

    .tag {
      display: inline-block; padding: 2px 10px; border-radius: 12px;
      font-size: 11px; font-weight: 700;
    }
    .tag-dispo { background: #dcfce7; color: #16a34a; }
    .tag-res { background: #fef3c7; color: #d97706; }
    .tag-vendu { background: #f3f4f6; color: #6b7280; }

    @media print {
      body { font-size: 11px; }
      .header { padding: 20px 30px; }
      .content { padding: 20px 30px; }
    }
  </style>
</head>
<body>

  <!-- En-tête -->
  <div class="header">
    <div class="header-top">
      <div>
        <div class="enterprise">${entrepriseName}</div>
        <div class="report-type">${
          report === "stock" ? "Rapport de Stock" :
          report === "ventes" ? "Rapport de Ventes" :
          "Rapport Complet"
        }</div>
      </div>
      <div class="header-meta">
        Généré le<br/>
        <strong>${nowStr()}</strong><br/>
        via SenMoto Pro
      </div>
    </div>
    <div class="periode-badge">
      Période : ${
        report === "stock" ? "État actuel" : periode
      }
    </div>
  </div>

  <!-- KPIs globaux -->
  <div class="kpi-row">
    <div class="kpi">
      <div class="kpi-val" style="color:#2563eb">${motos.length}</div>
      <div class="kpi-label">Total motos</div>
    </div>
    <div class="kpi">
      <div class="kpi-val" style="color:#16a34a">${disponibles.length + reserves.length}</div>
      <div class="kpi-label">En stock</div>
    </div>
    <div class="kpi">
      <div class="kpi-val" style="color:#FF9500">${vendues.length}</div>
      <div class="kpi-label">Vendues (total)</div>
    </div>
    ${showVentes ? `
    <div class="kpi">
      <div class="kpi-val" style="color:#FF9500">${shortFmt(totalCA)}</div>
      <div class="kpi-label">CA (${periode})</div>
    </div>
    <div class="kpi">
      <div class="kpi-val" style="color:${totalBenef >= 0 ? "#7c3aed" : "#dc2626"}">${totalBenef >= 0 ? "+" : ""}${shortFmt(totalBenef)}</div>
      <div class="kpi-label">Bénéfice (${periode})</div>
    </div>` : ""}
  </div>

  <div class="content">

    ${showStock ? `
    <!-- === SECTION STOCK === -->
    <div class="section">
      <h2>Stock disponible</h2>

      <div class="summary-grid" style="margin-bottom:24px">
        <div class="summary-card blue">
          <div class="summary-card-val">${disponibles.length}</div>
          <div class="summary-card-label">Motos disponibles</div>
        </div>
        <div class="summary-card" style="border-left-color:#d97706">
          <div class="summary-card-val">${reserves.length}</div>
          <div class="summary-card-label">Motos réservées</div>
        </div>
      </div>

      ${marqueStockRows ? `
      <h2 style="margin-top:0">Répartition par marque</h2>
      <table style="margin-bottom:24px">
        <thead><tr><th>Marque</th><th style="text-align:center">Quantité</th></tr></thead>
        <tbody>${marqueStockRows}</tbody>
      </table>` : ""}

      ${stockTableRows ? `
      <h2>Détail du stock</h2>
      <table>
        <thead>
          <tr>
            <th>Moto</th>
            <th>État</th>
            <th>Couleur</th>
            <th>Immatriculation</th>
            <th>Statut</th>
            <th style="text-align:right">Prix de vente</th>
          </tr>
        </thead>
        <tbody>${stockTableRows}</tbody>
      </table>` : "<p style='color:#9ca3af;padding:20px 0'>Aucune moto en stock.</p>"}
    </div>` : ""}

    ${showVentes ? `
    <!-- === SECTION VENTES === -->
    <div class="section">
      <h2>Performances de vente</h2>

      <div class="summary-grid">
        <div class="summary-card green">
          <div class="summary-card-val">${vendusPeriod.length}</div>
          <div class="summary-card-label">Motos vendues — ${periode}</div>
        </div>
        <div class="summary-card">
          <div class="summary-card-val">${shortFmt(totalCA)}</div>
          <div class="summary-card-label">Chiffre d'affaires — ${periode}</div>
        </div>
        <div class="summary-card purple">
          <div class="summary-card-val" style="color:${totalBenef >= 0 ? "#7c3aed" : "#dc2626"}">
            ${totalBenef >= 0 ? "+" : ""}${shortFmt(totalBenef)}
          </div>
          <div class="summary-card-label">Bénéfice estimé — ${periode}</div>
        </div>
        <div class="summary-card blue">
          <div class="summary-card-val">
            ${vendusPeriod.length > 0 ? shortFmt(Math.round(totalCA / vendusPeriod.length)) : "—"}
          </div>
          <div class="summary-card-label">Prix moyen de vente</div>
        </div>
      </div>

      ${marqueVentesRows ? `
      <h2>Top marques vendues</h2>
      <table style="margin-bottom:24px">
        <thead>
          <tr>
            <th>Marque</th>
            <th style="text-align:center">Quantité</th>
            <th style="text-align:right">CA</th>
            <th style="text-align:right">Bénéfice</th>
          </tr>
        </thead>
        <tbody>${marqueVentesRows}</tbody>
      </table>` : ""}

      ${ventesTableRows ? `
      <h2>Détail des ventes</h2>
      <table>
        <thead>
          <tr>
            <th>Moto</th>
            <th>Acheteur</th>
            <th>Téléphone</th>
            <th>Date</th>
            <th style="text-align:right">Prix vendu</th>
            <th style="text-align:right">Bénéfice</th>
          </tr>
        </thead>
        <tbody>${ventesTableRows}</tbody>
      </table>` : "<p style='color:#9ca3af;padding:20px 0'>Aucune vente sur cette période.</p>"}
    </div>` : ""}

  </div>

  <!-- Pied de page -->
  <div class="footer">
    <div><strong>${entrepriseName}</strong> · Rapport généré automatiquement</div>
    <div>SenMoto Pro · ${new Date().getFullYear()}</div>
  </div>

</body>
</html>`;
}

// ─── Écran principal ──────────────────────────────────────────────────────────

export default function RapportsScreen() {
  const { tenant } = useTenant();
  const [motos, setMotos] = useState<Moto[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [reportType, setReportType] = useState<ReportType>("complet");
  const [period, setPeriod] = useState<Period>("mois");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const fetchMotos = async () => {
    if (!tenant?.enterprise_id) { setLoading(false); return; }
    const { data, error } = await supabase
      .from("motos")
      .select("id,marque,modele,type,couleur,etat,prix_achat,prix_vente,statut,immatriculation,numero_chassis,nom_acheteur,telephone_acheteur,date_vente,notes_vente,created_at")
      .eq("enterprise_id", tenant.enterprise_id)
      .order("created_at", { ascending: false });
    if (!error && data) setMotos(data as Moto[]);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { fetchMotos(); }, [tenant?.enterprise_id]));

  // Stats pour la preview
  const { start: periodStart, end: periodEnd } = getDateRange(period, customFrom, customTo);
  const disponibles = motos.filter((m) => !m.statut || m.statut === "disponible");
  const reserves = motos.filter((m) => m.statut === "réservé");
  const vendues = motos.filter((m) => m.statut === "vendu");
  const vendusPeriod = vendues.filter((m) => {
    if (!periodStart && !periodEnd) return true;
    if (!m.date_vente) return false;
    const d = new Date(m.date_vente);
    return (!periodStart || d >= periodStart) && (!periodEnd || d <= periodEnd);
  });
  const ca = vendusPeriod.reduce((s, m) => s + (m.prix_vente || 0), 0);
  const benef = vendusPeriod.reduce((s, m) => s + ((m.prix_vente || 0) - (m.prix_achat || 0)), 0);

  const periodeLabel =
    period === "custom"
      ? customFrom && customTo
        ? `Du ${customFrom} au ${customTo}`
        : customFrom
        ? `À partir du ${customFrom}`
        : customTo
        ? `Jusqu'au ${customTo}`
        : "Dates personnalisées"
      : PERIODS.find((p) => p.key === period)?.label ?? "";

  const handleGenerate = async (action: "pdf" | "print" | "share") => {
    setGenerating(true);
    try {
      const html = generateHtml(
        reportType,
        motos,
        tenant?.enterprise_name || "Entreprise",
        periodeLabel,
        periodStart,
        periodEnd
      );

      if (action === "print") {
        await Print.printAsync({ html });
      } else if (action === "share") {
        await printAndSharePdf(html, `Rapport ${tenant?.enterprise_name || ""} — ${periodeLabel}`);
      } else {
        // pdf → ouvre l'aperçu pour impression / sauvegarde
        await Print.printAsync({ html });
      }
    } catch (e: any) {
      Alert.alert("Erreur d'export", (e?.message ?? String(e)) || "Impossible de générer le rapport.");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF9500" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Type de rapport ─────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.secTitle}>Type de rapport</Text>
        <View style={{ gap: 10 }}>
          {REPORT_TYPES.map((rt) => (
            <TouchableOpacity
              key={rt.key}
              style={[styles.reportTypeCard, reportType === rt.key && styles.reportTypeCardActive]}
              onPress={() => setReportType(rt.key)}
              activeOpacity={0.8}
            >
              <View style={[styles.reportTypeIcon, { backgroundColor: reportType === rt.key ? "#FF9500" : "#f3f4f6" }]}>
                <Ionicons name={rt.icon as any} size={22} color={reportType === rt.key ? "#fff" : "#666"} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.reportTypeLabel, reportType === rt.key && { color: "#FF9500" }]}>
                  {rt.label}
                </Text>
                <Text style={styles.reportTypeDesc}>{rt.desc}</Text>
              </View>
              {reportType === rt.key && (
                <Ionicons name="checkmark-circle" size={20} color="#FF9500" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Période (masquée si stock uniquement) ───────────────────────────── */}
      {reportType !== "stock" && (
        <View style={styles.section}>
          <Text style={styles.secTitle}>Période des ventes</Text>
          <View style={styles.periodGrid}>
            {PERIODS.map((p) => (
              <TouchableOpacity
                key={p.key}
                onPress={() => setPeriod(p.key)}
                style={[styles.periodBtn, period === p.key && styles.periodBtnActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.periodBtnText, period === p.key && styles.periodBtnTextActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

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
              {customFrom && !parseDMY(customFrom) && (
                <Text style={styles.dateError}>Date de début invalide</Text>
              )}
              {customTo && !parseDMY(customTo) && (
                <Text style={styles.dateError}>Date de fin invalide</Text>
              )}
            </View>
          )}
        </View>
      )}

      {/* ── Aperçu des données ──────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.secTitle}>Aperçu du rapport</Text>
        <View style={styles.previewCard}>
          <View style={styles.previewHeader}>
            <Ionicons name="document-text" size={20} color="#FF9500" />
            <Text style={styles.previewTitle}>
              {REPORT_TYPES.find((r) => r.key === reportType)?.label}
            </Text>
          </View>

          <View style={styles.previewGrid}>
            {(reportType === "stock" || reportType === "complet") && (
              <>
                <PreviewStat label="Disponibles" value={disponibles.length.toString()} color="#34C759" />
                <PreviewStat label="Réservées" value={reserves.length.toString()} color="#FF9500" />
              </>
            )}
            {(reportType === "ventes" || reportType === "complet") && (
              <>
                <PreviewStat label="Vendues" value={vendusPeriod.length.toString()} color="#007AFF" />
                <PreviewStat label="CA" value={shortFmt(ca)} color="#FF9500" />
                <PreviewStat
                  label="Bénéfice"
                  value={(benef >= 0 ? "+" : "") + shortFmt(benef)}
                  color={benef >= 0 ? "#5856D6" : "#FF3B30"}
                />
              </>
            )}
            <PreviewStat label="Total motos" value={motos.length.toString()} color="#8E8E93" />
          </View>

          <Text style={styles.previewNote}>
            {reportType !== "stock" ? `Ventes : ${periodeLabel}` : "Situation actuelle du stock"}
          </Text>
        </View>
      </View>

      {/* ── Boutons d'action ────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.secTitle}>Générer et exporter</Text>
        <View style={{ gap: 12 }}>
          <ExportBtn
            icon="download-outline"
            label="Enregistrer en PDF"
            sub="Sauvegarde le rapport en PDF sur l'appareil"
            color="#007AFF"
            onPress={() => handleGenerate("pdf")}
            disabled={generating}
          />
          <ExportBtn
            icon="share-social-outline"
            label="Partager le rapport"
            sub="Envoie par WhatsApp, email, Drive…"
            color="#34C759"
            onPress={() => handleGenerate("share")}
            disabled={generating}
          />
          <ExportBtn
            icon="print-outline"
            label="Imprimer"
            sub="Impression directe ou via PDF"
            color="#FF9500"
            onPress={() => handleGenerate("print")}
            disabled={generating}
          />
        </View>

        {generating && (
          <View style={styles.generatingBox}>
            <ActivityIndicator size="small" color="#FF9500" />
            <Text style={styles.generatingText}>Génération du rapport en cours…</Text>
          </View>
        )}
      </View>

      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function PreviewStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.previewStat}>
      <Text style={[styles.previewStatVal, { color }]}>{value}</Text>
      <Text style={styles.previewStatLabel}>{label}</Text>
    </View>
  );
}

function ExportBtn({
  icon, label, sub, color, onPress, disabled,
}: {
  icon: string; label: string; sub: string; color: string;
  onPress: () => void; disabled: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.exportBtn, disabled && { opacity: 0.5 }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <View style={[styles.exportBtnIcon, { backgroundColor: color }]}>
        <Ionicons name={icon as any} size={22} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.exportBtnLabel}>{label}</Text>
        <Text style={styles.exportBtnSub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#ccc" />
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F2F2F7" },
  content: { paddingBottom: 40 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },

  section: {
    backgroundColor: "#fff",
    marginBottom: 10,
    padding: 20,
  },
  secTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#8E8E93",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 14,
  },

  reportTypeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#e5e5ea",
    backgroundColor: "#fafafa",
  },
  reportTypeCardActive: {
    borderColor: "#FF9500",
    backgroundColor: "#FFF8EE",
  },
  reportTypeIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  reportTypeLabel: { fontSize: 15, fontWeight: "700", color: "#1C1C1E" },
  reportTypeDesc: { fontSize: 12, color: "#8E8E93", marginTop: 2 },

  periodGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  periodBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#e5e5ea",
    backgroundColor: "#fafafa",
  },
  periodBtnActive: { backgroundColor: "#FF9500", borderColor: "#FF9500" },
  periodBtnText: { fontSize: 13, fontWeight: "600", color: "#666" },
  periodBtnTextActive: { color: "#fff" },

  previewCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#FF9500",
    padding: 16,
    backgroundColor: "#FFF8EE",
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  previewTitle: { fontSize: 15, fontWeight: "700", color: "#FF9500" },
  previewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  previewStat: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    minWidth: 80,
  },
  previewStatVal: { fontSize: 18, fontWeight: "800" },
  previewStatLabel: { fontSize: 11, color: "#8E8E93", marginTop: 2 },
  previewNote: { fontSize: 12, color: "#8E8E93", textAlign: "center", marginTop: 4 },

  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#fafafa",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e5ea",
  },
  exportBtnIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  exportBtnLabel: { fontSize: 15, fontWeight: "700", color: "#1C1C1E" },
  exportBtnSub: { fontSize: 12, color: "#8E8E93", marginTop: 2 },

  generatingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFF8EE",
    borderRadius: 10,
    padding: 14,
    marginTop: 12,
  },
  generatingText: { fontSize: 13, color: "#FF9500", fontWeight: "600" },

  customDateContainer: { marginTop: 14 },
  customDateRow: { flexDirection: "row", gap: 10 },
  customDateField: { flex: 1 },
  customDateLabel: { fontSize: 12, color: "#8E8E93", marginBottom: 6, fontWeight: "600" },
  customDateInput: {
    borderWidth: 1.5,
    borderColor: "#FF9500",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1C1C1E",
    backgroundColor: "#FFF8EE",
  },
  dateError: { fontSize: 11, color: "#FF3B30", marginTop: 4 },
});
