// app/recu/[id].tsx

import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { printAndSharePdf } from "../../lib/sharePdf";
import { supabase } from "../../lib/supabase";

export default function RecuDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [recu, setRecu] = useState<any>(null);
  const [parametres, setParametres] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    const { data: recuData, error } = await supabase
      .from("recus")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !recuData) {
      Alert.alert("Erreur", error?.message || "Réçu introuvable.");
      setLoading(false);
      return;
    }
    setRecu(recuData);

    const { data: paramData } = await supabase
      .from("entreprise_parametres")
      .select("*")
      .eq("user_id", recuData.user_id)
      .maybeSingle();
    setParametres(paramData);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const formatDate = (d: string) => {
    if (!d) return { jj: "—", mm: "—", aaaa: "—", full: "—" };
    const parts = d.split("-");
    if (parts.length === 3) {
      return {
        jj: parts[2],
        mm: parts[1],
        aaaa: parts[0],
        full: `${parts[2]}/${parts[1]}/${parts[0]}`,
      };
    }
    return { jj: "—", mm: "—", aaaa: "—", full: d };
  };

  const formatPrix = (n: number | null) =>
    n == null ? "—" : n.toLocaleString("fr-FR") + " FCFA";

  const buildHtml = () => {
    const d = recu;
    const p = parametres || {};
    const dt = formatDate(d.date);

    const sigVendeurHtml = d.signature_vendeur
      ? `<img src="${d.signature_vendeur}" style="height:60px;max-width:180px;" />`
      : "<em>—</em>";
    const sigClientHtml = d.signature_client
      ? `<img src="${d.signature_client}" style="height:60px;max-width:180px;" />`
      : "<em>—</em>";
    const logoHtml = p.logo_uri
      ? `<img src="${p.logo_uri}" style="max-width:110px;max-height:90px;object-fit:contain;" />`
      : "";

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #000; padding: 24px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding-bottom: 8px; border-bottom: 2px solid #000; }
    .header-left { display: flex; align-items: center; gap: 10px; flex: 1; }
    .company-info .nom { font-size: 22px; font-weight: 800; color: #3d2c66; letter-spacing: 1px; }
    .company-info .sous { font-size: 11px; color: #222; margin-top: 1px; }
    .company-info .ligne { font-size: 11px; color: #333; margin-top: 1px; }
    .header-right { text-align: right; }
    .date-table { border-collapse: collapse; }
    .date-table th, .date-table td { border: 1px solid #000; padding: 4px 10px; font-size: 11px; text-align: center; }
    .facture-num { margin-top: 10px; font-weight: 700; font-size: 13px; }
    .facture-val { font-size: 16px; font-weight: 800; color: #007AFF; letter-spacing: 1px; }
    .client { margin-top: 12px; font-size: 13px; }
    .client p { margin: 4px 0; }
    .dotted { border-bottom: 1px dotted #000; flex: 1; height: 14px; display: inline-block; }
    .box { border: 1px solid #000; padding: 10px; margin-top: 12px; }
    .row { display: flex; justify-content: space-between; gap: 14px; margin: 6px 0; }
    .row .col { flex: 1; }
    .row .label { font-weight: 700; }
    .row .value { font-weight: 600; }
    .footer-row { display: flex; align-items: flex-start; gap: 14px; margin-top: 18px; }
    .col-vendeur, .col-client { width: 25%; text-align: center; font-size: 12px; font-weight: 700; }
    .col-center { flex: 1; }
    .col-center .label { font-weight: 700; font-size: 12px; }
    .col-center .lettres { margin-top: 6px; font-style: italic; min-height: 36px; border-bottom: 1px dotted #000; padding-bottom: 4px; }
    .sig-img { margin-top: 4px; height: 60px; max-width: 180px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      ${logoHtml}
      <div class="company-info">
        <div class="nom">${p.nom_entreprise || "—"}</div>
        ${p.sous_titre ? `<div class="sous">${p.sous_titre}</div>` : ""}
        ${p.telephone ? `<div class="ligne">Tél: ${p.telephone}</div>` : ""}
        ${p.adresse ? `<div class="ligne">${p.adresse}</div>` : ""}
        ${p.localisation ? `<div class="ligne">${p.localisation}</div>` : ""}
      </div>
    </div>
    <div class="header-right">
      <table class="date-table">
        <tr><th>Jour</th><th>Mois</th><th>Année</th></tr>
        <tr><td>${dt.jj}</td><td>${dt.mm}</td><td>${dt.aaaa}</td></tr>
      </table>
      <div class="facture-num">FACTURE N°</div>
      <div class="facture-val">${d.numero_facture || "—"}</div>
    </div>
  </div>

  <div class="client">
    <p><strong>Nom:</strong> ${d.nom_client || "—"}</p>
    <p><strong>Adresse:</strong> ${d.adresse_client || "—"}</p>
  </div>

  <div class="box">
    <div class="row">
      <div class="col"><span class="label">MOTO:</span> <span class="value">${d.article || "—"}</span></div>
      <div class="col"><span class="label">COULEUR:</span> <span class="value">${d.couleur || "—"}</span></div>
    </div>
    <div class="row">
      <div class="col"><span class="label">MARQUE:</span> <span class="value">${d.marque || "—"}</span></div>
      <div class="col"><span class="label">TYPE:</span> <span class="value">${d.type || "—"}</span></div>
    </div>
    <div class="row">
      <div class="col"><span class="label">CHASSIS N°:</span> <span class="value">${d.chassis_no || "—"}</span></div>
      <div class="col"><span class="label">MOTEUR N°:</span> <span class="value">${d.moteur_no || "—"}</span></div>
    </div>
    <div class="row">
      <div class="col"><span class="label">QUANTITÉ:</span> <span class="value">${d.quantite ?? "—"}</span></div>
      <div class="col"><span class="label">PRIX UNITAIRE:</span> <span class="value">${formatPrix(d.prix_unitaire)}</span></div>
      <div class="col"><span class="label">PRIX TOTAL:</span> <span class="value">${formatPrix(d.prix_total)}</span></div>
    </div>
  </div>

  <div class="footer-row">
    <div class="col-vendeur">
      Vendeur
      <div>${sigVendeurHtml}</div>
    </div>
    <div class="col-center">
      <div class="label">Arrêté la présente facture à la somme :</div>
      <div class="lettres">${d.prix_total_lettres || "—"}</div>
    </div>
    <div class="col-client">
      Client
      <div>${sigClientHtml}</div>
    </div>
  </div>
</body>
</html>`;
  };

  const handlePrint = async () => {
    try {
      const html = buildHtml();
      await printAndSharePdf(html, "Exporter le réçu");
    } catch (e: any) {
      Alert.alert("Erreur d'export", e?.message ?? String(e));
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Stack.Screen options={{ title: "Réçu" }} />
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!recu) return null;

  const dt = formatDate(recu.date);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen
        options={{
          title: `Réçu ${recu.numero_facture}`,
          headerRight: () => (
            <TouchableOpacity onPress={handlePrint} style={{ marginRight: 10 }}>
              <Ionicons name="print-outline" size={24} color="#34C759" />
            </TouchableOpacity>
          ),
        }}
      />

      {/* Bouton Modifier */}
      <TouchableOpacity
        style={styles.editBtn}
        onPress={() =>
          router.push({
            pathname: "/recu",
            params: { id: recu.id, dossierId: recu.annee_mois_id },
          })
        }
      >
        <Ionicons name="create-outline" size={16} color="#fff" />
        <Text style={styles.editBtnText}>Modifier</Text>
      </TouchableOpacity>

      {/* DOCUMENT */}
      <View style={styles.document}>
        {/* Entête */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            {parametres?.logo_uri ? (
              <Image
                source={{ uri: parametres.logo_uri }}
                style={styles.logo}
                resizeMode="contain"
              />
            ) : null}
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.compNom} numberOfLines={1}>
                {parametres?.nom_entreprise || "—"}
              </Text>
              {!!parametres?.sous_titre && (
                <Text style={styles.compSousTitre}>
                  {parametres.sous_titre}
                </Text>
              )}
              {!!parametres?.telephone && (
                <Text style={styles.compLigne}>
                  Tél: {parametres.telephone}
                </Text>
              )}
              {!!parametres?.adresse && (
                <Text style={styles.compLigne}>{parametres.adresse}</Text>
              )}
              {!!parametres?.localisation && (
                <Text style={styles.compLigne}>{parametres.localisation}</Text>
              )}
            </View>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.dateTable}>
              <View style={styles.dateRow}>
                <View style={styles.dateCellHead}>
                  <Text style={styles.dateCellHeadText}>Jour</Text>
                </View>
                <View style={styles.dateCellHead}>
                  <Text style={styles.dateCellHeadText}>Mois</Text>
                </View>
                <View style={styles.dateCellHead}>
                  <Text style={styles.dateCellHeadText}>Année</Text>
                </View>
              </View>
              <View style={styles.dateRow}>
                <View style={styles.dateCell}>
                  <Text style={styles.dateCellText}>{dt.jj}</Text>
                </View>
                <View style={styles.dateCell}>
                  <Text style={styles.dateCellText}>{dt.mm}</Text>
                </View>
                <View style={styles.dateCell}>
                  <Text style={styles.dateCellText}>{dt.aaaa}</Text>
                </View>
              </View>
            </View>
            <Text style={styles.factureLabel}>FACTURE N°</Text>
            <Text style={styles.factureValue}>{recu.numero_facture}</Text>
          </View>
        </View>

        <View style={styles.hrBold} />

        {/* Client */}
        <View style={{ marginTop: 8 }}>
          <Text style={styles.clientLine}>
            <Text style={styles.bold}>Nom: </Text>
            {recu.nom_client || "—"}
          </Text>
          <Text style={styles.clientLine}>
            <Text style={styles.bold}>Adresse: </Text>
            {recu.adresse_client || "—"}
          </Text>
        </View>

        {/* Box détails */}
        <View style={styles.itemsBox}>
          <View style={styles.itemRow}>
            <View style={styles.itemCol}>
              <Text>
                <Text style={styles.itemLabel}>MOTO: </Text>
                {recu.article || "—"}
              </Text>
            </View>
            <View style={styles.itemCol}>
              <Text>
                <Text style={styles.itemLabel}>COULEUR : </Text>
                {recu.couleur || "—"}
              </Text>
            </View>
          </View>
          <View style={styles.itemRow}>
            <View style={styles.itemCol}>
              <Text>
                <Text style={styles.itemLabel}>MARQUE: </Text>
                {recu.marque || "—"}
              </Text>
            </View>
            <View style={styles.itemCol}>
              <Text>
                <Text style={styles.itemLabel}>TYPE : </Text>
                {recu.type || "—"}
              </Text>
            </View>
          </View>
          <View style={styles.itemRow}>
            <View style={styles.itemCol}>
              <Text>
                <Text style={styles.itemLabel}>CHASSIS N°: </Text>
                {recu.chassis_no || "—"}
              </Text>
            </View>
            <View style={styles.itemCol}>
              <Text>
                <Text style={styles.itemLabel}>MOTEUR N° : </Text>
                {recu.moteur_no || "—"}
              </Text>
            </View>
          </View>
          <View style={styles.itemRow}>
            <View style={styles.itemCol}>
              <Text>
                <Text style={styles.itemLabel}>QUANTITE: </Text>
                {recu.quantite ?? "—"}
              </Text>
            </View>
            <View style={styles.itemCol}>
              <Text>
                <Text style={styles.itemLabel}>PRIX UNITAIRE : </Text>
                {formatPrix(recu.prix_unitaire)}
              </Text>
            </View>
            <View style={styles.itemCol}>
              <Text>
                <Text style={styles.itemLabel}>PRIX TOTAL : </Text>
                {formatPrix(recu.prix_total)}
              </Text>
            </View>
          </View>
        </View>

        {/* Footer: signatures + arrêté */}
        <View style={styles.footerRow}>
          <View style={styles.sigCol}>
            <Text style={styles.sigCaption}>Vendeur</Text>
            {recu.signature_vendeur ? (
              <Image
                source={{ uri: recu.signature_vendeur }}
                style={styles.sigImg}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.sigEmpty}>
                <Text style={styles.sigEmptyText}>—</Text>
              </View>
            )}
          </View>
          <View style={styles.arreteCol}>
            <Text style={styles.bold}>
              Arrêté la présente facture à la somme :
            </Text>
            <Text style={styles.arreteText}>
              {recu.prix_total_lettres || "—"}
            </Text>
          </View>
          <View style={styles.sigCol}>
            <Text style={styles.sigCaption}>Client</Text>
            {recu.signature_client ? (
              <Image
                source={{ uri: recu.signature_client }}
                style={styles.sigImg}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.sigEmpty}>
                <Text style={styles.sigEmptyText}>—</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.printBtn} onPress={handlePrint}>
        <Ionicons name="print-outline" size={20} color="#fff" />
        <Text style={styles.printBtnText}>Imprimer / Exporter PDF</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function formatPrix(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("fr-FR") + " FCFA";
}

const styles = StyleSheet.create({
  container: { padding: 12, paddingBottom: 60, backgroundColor: "#f0f0f0" },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    backgroundColor: "#34C759",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 10,
    gap: 6,
  },
  editBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  document: {
    backgroundColor: "#fff",
    borderRadius: 4,
    padding: 14,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },

  // Header
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  headerLeft: { flex: 1, flexDirection: "row", alignItems: "center" },
  logo: { width: 80, height: 70 },
  compNom: { fontSize: 18, fontWeight: "800", color: "#3d2c66" },
  compSousTitre: { fontSize: 10, color: "#222", marginTop: 1 },
  compLigne: { fontSize: 10, color: "#333", marginTop: 1 },
  headerRight: { alignItems: "flex-end" },
  dateTable: { borderWidth: 1, borderColor: "#000" },
  dateRow: { flexDirection: "row" },
  dateCellHead: {
    borderWidth: 1,
    borderColor: "#000",
    paddingHorizontal: 8,
    paddingVertical: 2,
    width: 48,
    alignItems: "center",
  },
  dateCellHeadText: { fontSize: 9, fontWeight: "700" },
  dateCell: {
    borderWidth: 1,
    borderColor: "#000",
    paddingVertical: 4,
    width: 48,
    alignItems: "center",
  },
  dateCellText: { fontSize: 11 },
  factureLabel: { fontSize: 11, fontWeight: "700", marginTop: 6 },
  factureValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#007AFF",
    letterSpacing: 1,
  },

  hrBold: { height: 2, backgroundColor: "#000", marginTop: 6 },

  clientLine: { fontSize: 12, marginTop: 4 },
  bold: { fontWeight: "700" },

  itemsBox: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#000",
    padding: 10,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginVertical: 5,
  },
  itemCol: { flex: 1 },
  itemLabel: { fontWeight: "700" },

  footerRow: {
    flexDirection: "row",
    marginTop: 14,
    gap: 6,
    alignItems: "flex-start",
  },
  sigCol: { width: "22%", alignItems: "center" },
  sigCaption: { fontWeight: "700", fontSize: 12 },
  sigImg: {
    width: "100%",
    height: 60,
    marginTop: 4,
    backgroundColor: "#fafafa",
    borderBottomWidth: 1,
    borderBottomColor: "#aaa",
  },
  sigEmpty: {
    width: "100%",
    height: 60,
    marginTop: 4,
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#aaa",
  },
  sigEmptyText: { color: "#aaa", fontSize: 12 },
  arreteCol: { flex: 1, paddingTop: 14, paddingHorizontal: 6 },
  arreteText: {
    fontStyle: "italic",
    color: "#007AFF",
    marginTop: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    paddingBottom: 2,
    minHeight: 30,
  },

  printBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#34C759",
    padding: 16,
    borderRadius: 10,
    marginTop: 20,
    gap: 8,
  },
  printBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
