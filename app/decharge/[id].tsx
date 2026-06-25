// app/decharge/[id].tsx

import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { printAndSharePdf } from "../../lib/sharePdf";
import { WebView } from "react-native-webview";
import { supabase } from "../../lib/supabase";

type PhotoColumn =
  | "vendeur_id_recto"
  | "vendeur_id_verso"
  | "carte_grise_recto"
  | "carte_grise_verso";

type PreviewData = {
  title: string;
  rectoUri: string | null | undefined;
  versoUri: string | null | undefined;
  isPassport: boolean;
  onExport: () => void;
};

export default function DechargeDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [decharge, setDecharge] = useState<any>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewFace, setPreviewFace] = useState<"recto" | "verso">("recto");

  const openPreview = (data: PreviewData) => {
    setPreviewFace("recto");
    setPreview(data);
  };

  const fetchDecharge = async () => {
    const { data, error } = await supabase
      .from("decharges")
      .select("*")
      .eq("id", id)
      .single();
    if (error) { Alert.alert("Erreur", error.message); return; }
    setDecharge(data);
  };

  useEffect(() => { fetchDecharge(); }, []);

  const updatePhoto = async (column: PhotoColumn, value: string | null) => {
    const { error } = await supabase
      .from("decharges")
      .update({ [column]: value })
      .eq("id", id);
    if (error) {
      Alert.alert("Erreur", error.message);
      return;
    }
    fetchDecharge();
  };

  const aspectFor = (column: PhotoColumn): [number, number] => {
    if (column === "vendeur_id_recto" && decharge?.vendeur_id_type === "passport") {
      return [88, 125];
    }
    return [85, 54];
  };

  const pickAndReplacePhoto = (column: PhotoColumn) => {
    const aspect = aspectFor(column);
    Alert.alert("Modifier la photo", "Choisissez une action", [
      {
        text: "Caméra",
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== "granted") {
            return Alert.alert("Permission refusée", "Accès caméra refusé.");
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect,
            quality: 0.5,
            base64: true,
          });
          if (!result.canceled && result.assets?.[0]?.base64) {
            await updatePhoto(column, `data:image/jpeg;base64,${result.assets[0].base64}`);
          }
        },
      },
      {
        text: "Galerie",
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect,
            quality: 0.5,
            base64: true,
          });
          if (!result.canceled && result.assets?.[0]?.base64) {
            await updatePhoto(column, `data:image/jpeg;base64,${result.assets[0].base64}`);
          }
        },
      },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () => updatePhoto(column, null),
      },
      { text: "Annuler", style: "cancel" },
    ]);
  };

  if (!decharge) return null;

  // Formatage date stockée (YYYY-MM-DD) → JJ/MM/AAAA
  const formatDate = (d: string) => {
    if (!d) return "—";
    if (d.includes("/")) return d;
    const parts = d.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return d;
  };

  const formatPrixNum = (prix: number | null) => {
    if (!prix) return "—";
    return prix.toLocaleString("fr-FR") + " FCFA";
  };

  // ─── Export PDF via HTML ────────────────────────────────────────────────────
  const handlePrint = async () => {
    const d = decharge;

    // Convertir les data URI signature en balises img HTML
    const sigVendeurHtml = d.signature_uri
      ? `<img src="${d.signature_uri}" style="height:70px;max-width:200px;" />`
      : "<em>—</em>";
    const sigAcheteurHtml = d.signature_acheteur_uri
      ? `<img src="${d.signature_acheteur_uri}" style="height:70px;max-width:200px;" />`
      : "<em>—</em>";

    const representantSection = d.nom_representant
      ? `
        <p>Représenté pour la présente transaction par :</p>
        <p><strong>M. ${d.nom_representant},</strong></p>
        <p>Titulaire de la CNIB N° : <strong>${d.cnib_representant || "—"}</strong></p>
        <p>Dûment mandaté pour effectuer l'achat en son nom.</p>
      `
      : "";

    const telVendeurLine = d.telephone_vendeur
      ? `<p>Téléphone : <span class="underline">${d.telephone_vendeur}</span></p>`
      : "";
    const telAcheteurLine = d.telephone_acheteur
      ? `<p>Téléphone : <span class="underline">${d.telephone_acheteur}</span></p>`
      : "";
    const chassisLine = d.numero_chassis
      ? `<p>&nbsp;&nbsp;&nbsp;N° Châssis : <span class="underline">${d.numero_chassis}</span></p>`
      : "";
    const immatLine = d.immatriculation
      ? `<p>&nbsp;&nbsp;&nbsp;N° Immatriculation : <span class="underline">${d.immatriculation}</span></p>`
      : "";

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #000; padding: 30px 40px; }
    h1 { text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 20px; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 10px; }
    p { margin: 6px 0; line-height: 1.6; }
    .section { margin-top: 14px; }
    .underline { text-decoration: underline; font-weight: bold; }
    .prix-num { font-size: 14px; font-weight: bold; }
    .legal { margin-top: 14px; font-style: italic; font-size: 12px; border-top: 1px solid #ccc; padding-top: 10px; }
    .signatures { display: flex; justify-content: space-between; margin-top: 30px; gap: 20px; }
    .sig-block { width: 48%; }
    .sig-block p { font-weight: bold; margin-bottom: 4px; }
    .sig-line { border-bottom: 1px solid #000; height: 20px; margin: 10px 0; }
  </style>
</head>
<body>
  <h1>DÉCHARGE / ACTE DE VENTE DE MOTO</h1>

  <p>Je soussigné,</p>

  <div class="section">
    <p>Nom du vendeur : <span class="underline">${d.nom_vendeur || "—"}</span></p>
    <p>Titulaire de la CNIB N° : <span class="underline">${d.cnib_vendeur || "—"}</span></p>
    ${telVendeurLine}
  </div>

  <div class="section">
    <p>Déclare avoir vendu ce jour la moto désignée ci-dessous à :</p>
    <p><strong>M. ${d.nom_acheteur || "—"},</strong></p>
    <p>Titulaire de la CNIB N° : <span class="underline">${d.cnib_acheteur || "—"}</span></p>
    ${telAcheteurLine}
  </div>

  ${representantSection}

  <div class="section">
    <p><strong>Désignation du véhicule :</strong></p>
    <p>&nbsp;&nbsp;&nbsp;Marque : ${d.marque || "—"}</p>
    <p>&nbsp;&nbsp;&nbsp;Modèle : ${d.modele || "—"}</p>
    <p>&nbsp;&nbsp;&nbsp;Couleur : <span class="underline">${d.couleur || "—"}</span></p>
    ${chassisLine}
    ${immatLine}
  </div>

  <div class="section">
    <p><strong>Prix de vente :</strong></p>
    <p>La présente moto est vendue au prix de : <span class="prix-num">${formatPrixNum(d.prix)}</span></p>
    <p>(En lettres : <em>${d.prix_lettres || "—"}</em>)</p>
  </div>

  <div class="legal">
    <p>Le vendeur reconnaît avoir reçu l'intégralité de la somme convenue et déclare ne plus avoir
    aucun droit ni réclamation sur ladite moto à compter de ce jour.</p>
    <p style="margin-top:8px;">La moto est vendue dans l'état et l'acheteur en prend possession à compter de la signature
    du présent document.</p>
  </div>

  <div class="section" style="margin-top:20px;">
    <p>Fait à <strong>${d.lieu || "—"}</strong></p>
    <p>Le : <strong>${formatDate(d.date)}</strong></p>
    <p>Signatures :</p>
  </div>

  <div class="signatures">
    <div class="sig-block">
      <p>Le Vendeur :</p>
      <p>Nom : ${d.nom_vendeur || "—"}</p>
      <p>Signature :</p>
      ${sigVendeurHtml}
    </div>
    <div class="sig-block">
      <p>Pour l'Acheteur (Représentant) :</p>
      <p>Nom : ${d.nom_representant || d.nom_acheteur || "—"}</p>
      <p>Signature :</p>
      ${sigAcheteurHtml}
    </div>
  </div>
</body>
</html>`;

    try {
      await printAndSharePdf(html, "Exporter la décharge");
    } catch (e: any) {
      Alert.alert("Erreur d'export", e?.message ?? String(e));
    }
  };
  // ───────────────────────────────────────────────────────────────────────────

  // ─── Export PDF d'une pièce (recto/verso côte à côte) ─────────────────────
  const exportPieceHtml = (
    title: string,
    rectoUri: string | null | undefined,
    versoUri: string | null | undefined,
    isPassport: boolean = false,
  ) => {
    const rectoBlock = rectoUri
      ? `<img src="${rectoUri}" class="piece-img" />`
      : `<div class="piece-empty">Aucune photo</div>`;
    const versoBlock = isPassport
      ? ""
      : versoUri
        ? `<img src="${versoUri}" class="piece-img" />`
        : `<div class="piece-empty">Aucune photo</div>`;

    const sideClass = isPassport ? "single" : "duo";

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <style>
    @page { size: A4 landscape; margin: 15mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; color: #000; padding: 10px; }
    h1 { text-align: center; font-size: 16px; margin-bottom: 6px; text-transform: uppercase; }
    .meta { text-align: center; font-size: 11px; color: #555; margin-bottom: 18px; }
    .row { display: flex; flex-direction: row; justify-content: center; align-items: flex-start; gap: 20px; }
    .face { display: flex; flex-direction: column; align-items: center; }
    .face .label { font-size: 12px; font-weight: bold; margin-bottom: 6px; }
    .duo .piece-img { max-width: 48%; max-height: 70vh; height: auto; width: auto; border: 1px solid #999; }
    .single .piece-img { max-width: 60%; max-height: 80vh; height: auto; width: auto; border: 1px solid #999; }
    .duo .face { width: 48%; }
    .duo .face .piece-img { width: 100%; max-width: 100%; }
    .single .face { width: 60%; }
    .single .face .piece-img { width: 100%; max-width: 100%; }
    .piece-empty { width: 100%; aspect-ratio: 85/54; border: 1px dashed #999; display: flex; align-items: center; justify-content: center; color: #999; font-style: italic; font-size: 12px; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="meta">Vendeur : ${decharge.nom_vendeur || "—"}</div>
  <div class="row ${sideClass}">
    <div class="face">
      <div class="label">${isPassport ? "Page principale" : "Recto"}</div>
      ${rectoBlock}
    </div>
    ${isPassport ? "" : `
    <div class="face">
      <div class="label">Verso</div>
      ${versoBlock}
    </div>`}
  </div>
</body>
</html>`;
  };

  const exportPdf = async (html: string, dialogTitle: string) => {
    try {
      await printAndSharePdf(html, dialogTitle);
    } catch (e: any) {
      Alert.alert("Erreur d'export", e?.message ?? String(e));
    }
  };

  const handlePrintPiece = async () => {
    const isPassport = decharge.vendeur_id_type === "passport";
    if (!decharge.vendeur_id_recto && (isPassport || !decharge.vendeur_id_verso)) {
      return Alert.alert("Aucune photo", "Aucune image de la pièce d'identité à exporter.");
    }
    const title = isPassport ? "Passeport du vendeur" : "Pièce d'identité du vendeur (CNIB)";
    const html = exportPieceHtml(
      title,
      decharge.vendeur_id_recto,
      decharge.vendeur_id_verso,
      isPassport,
    );
    await exportPdf(html, "Exporter la pièce d'identité");
  };

  const handlePrintCarteGrise = async () => {
    if (!decharge.carte_grise_recto && !decharge.carte_grise_verso) {
      return Alert.alert("Aucune photo", "Aucune image de la carte grise à exporter.");
    }
    const html = exportPieceHtml(
      "Carte grise du véhicule",
      decharge.carte_grise_recto,
      decharge.carte_grise_verso,
      false,
    );
    await exportPdf(html, "Exporter la carte grise");
  };

  const handlePreviewPiece = () => {
    const isPassport = decharge.vendeur_id_type === "passport";
    if (!decharge.vendeur_id_recto && (isPassport || !decharge.vendeur_id_verso)) {
      return Alert.alert("Aucune photo", "Aucune image de la pièce d'identité à afficher.");
    }
    openPreview({
      title: isPassport ? "Passeport du vendeur" : "Pièce d'identité du vendeur (CNIB)",
      rectoUri: decharge.vendeur_id_recto,
      versoUri: decharge.vendeur_id_verso,
      isPassport,
      onExport: handlePrintPiece,
    });
  };

  const handlePreviewCarteGrise = () => {
    if (!decharge.carte_grise_recto && !decharge.carte_grise_verso) {
      return Alert.alert("Aucune photo", "Aucune image de la carte grise à afficher.");
    }
    openPreview({
      title: "Carte grise du véhicule",
      rectoUri: decharge.carte_grise_recto,
      versoUri: decharge.carte_grise_verso,
      isPassport: false,
      onExport: handlePrintCarteGrise,
    });
  };

  const buildZoomHtml = (uri: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=6, user-scalable=yes" />
  <style>
    html, body { margin: 0; padding: 0; height: 100%; background: #000; }
    body { display: flex; justify-content: center; align-items: center; touch-action: pinch-zoom; }
    img { max-width: 100%; max-height: 100%; object-fit: contain; -webkit-user-select: none; user-select: none; }
  </style>
</head>
<body>
  <img src="${uri}" />
</body>
</html>`;

  const currentPreviewUri = preview
    ? previewFace === "recto"
      ? preview.rectoUri
      : preview.versoUri
    : null;
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f5f5f7" }}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
      <Stack.Screen
        options={{
          title: `Décharge — ${decharge.nom_vendeur}`,
          headerRight: () => (
            <TouchableOpacity onPress={handlePrint} style={{ marginRight: 10 }}>
              <Ionicons name="print-outline" size={24} color="#FF9500" />
            </TouchableOpacity>
          ),
        }}
      />

      {/* Bouton Modifier */}
      <TouchableOpacity
        style={styles.editBtn}
        onPress={() => router.push({ pathname: "/decharge", params: { id: decharge.id, dossierId: decharge.annee_mois_id } })}
      >
        <Ionicons name="create-outline" size={16} color="#fff" />
        <Text style={styles.editBtnText}>Modifier</Text>
      </TouchableOpacity>

      {/* ── DOCUMENT OFFICIEL ─────────────────────────────────────── */}
      <View style={styles.document}>

        <Text style={styles.mainTitle}>DÉCHARGE / ACTE DE VENTE DE MOTO</Text>
        <View style={styles.hrBold} />

        <Text style={styles.bodyText}>Je soussigné,</Text>

        {/* Vendeur */}
        <View style={styles.section}>
          <Text style={styles.bodyText}>
            Nom du vendeur : <Text style={styles.underline}>{decharge.nom_vendeur || "—"}</Text>
          </Text>
          <Text style={styles.bodyText}>
            Titulaire de la CNIB N° : <Text style={styles.underline}>{decharge.cnib_vendeur || "—"}</Text>
          </Text>
          {decharge.telephone_vendeur ? (
            <Text style={styles.bodyText}>
              Téléphone : <Text style={styles.underline}>{decharge.telephone_vendeur}</Text>
            </Text>
          ) : null}
        </View>

        {/* Acheteur */}
        <View style={styles.section}>
          <Text style={styles.bodyText}>Déclare avoir vendu ce jour la moto désignée ci-dessous à :</Text>
          <Text style={styles.bodyText}>
            <Text style={styles.bold}>M. {decharge.nom_acheteur || "—"},</Text>
          </Text>
          <Text style={styles.bodyText}>
            Titulaire de la CNIB N° : <Text style={styles.underline}>{decharge.cnib_acheteur || "—"}</Text>
          </Text>
          {decharge.telephone_acheteur ? (
            <Text style={styles.bodyText}>
              Téléphone : <Text style={styles.underline}>{decharge.telephone_acheteur}</Text>
            </Text>
          ) : null}
        </View>

        {/* Représentant */}
        {decharge.nom_representant ? (
          <View style={styles.section}>
            <Text style={styles.bodyText}>Représenté pour la présente transaction par :</Text>
            <Text style={styles.bodyText}>
              <Text style={styles.bold}>M. {decharge.nom_representant},</Text>
            </Text>
            <Text style={styles.bodyText}>
              Titulaire de la CNIB N° : <Text style={styles.underline}>{decharge.cnib_representant || "—"}</Text>
            </Text>
            <Text style={styles.bodyText}>Dûment mandaté pour effectuer l'achat en son nom.</Text>
          </View>
        ) : null}

        {/* Moto */}
        <View style={styles.section}>
          <Text style={styles.bold}>Désignation du véhicule :</Text>
          <Text style={styles.bodyText}>{"   "}Marque : {decharge.marque || "—"}</Text>
          <Text style={styles.bodyText}>{"   "}Modèle : {decharge.modele || "—"}</Text>
          <Text style={styles.bodyText}>
            {"   "}Couleur : <Text style={styles.underline}>{decharge.couleur || "—"}</Text>
          </Text>
          {decharge.numero_chassis ? (
            <Text style={styles.bodyText}>
              {"   "}N° Châssis : <Text style={styles.underline}>{decharge.numero_chassis}</Text>
            </Text>
          ) : null}
          {decharge.immatriculation ? (
            <Text style={styles.bodyText}>
              {"   "}N° Immatriculation : <Text style={styles.underline}>{decharge.immatriculation}</Text>
            </Text>
          ) : null}
        </View>

        {/* Prix */}
        <View style={styles.section}>
          <Text style={styles.bold}>Prix de vente :</Text>
          <Text style={styles.bodyText}>
            La présente moto est vendue au prix de :{" "}
            <Text style={styles.prixNum}>{decharge.prix ? decharge.prix.toLocaleString("fr-FR") : "—"} FCFA</Text>
          </Text>
          {decharge.prix_lettres ? (
            <Text style={styles.bodyText}>
              (En lettres : <Text style={styles.italic}>{decharge.prix_lettres}</Text>)
            </Text>
          ) : null}
        </View>

        {/* Clauses légales */}
        <View style={styles.legalBox}>
          <Text style={styles.legalText}>
            Le vendeur reconnaît avoir reçu l'intégralité de la somme convenue et déclare ne plus avoir
            aucun droit ni réclamation sur ladite moto à compter de ce jour.
          </Text>
          <Text style={[styles.legalText, { marginTop: 8 }]}>
            La moto est vendue dans l'état et l'acheteur en prend possession à compter de la signature
            du présent document.
          </Text>
        </View>

        {/* Fait à / Date */}
        <View style={styles.section}>
          <Text style={styles.bodyText}>
            Fait à <Text style={styles.bold}>{decharge.lieu || "—"}</Text>
          </Text>
          <Text style={styles.bodyText}>
            Le : <Text style={styles.bold}>{formatDate(decharge.date)}</Text>
          </Text>
          <Text style={styles.bodyText}>Signatures :</Text>
        </View>

        {/* ── Signatures côte à côte ── */}
        <View style={styles.sigRow}>
          {/* Vendeur */}
          <View style={styles.sigBlock}>
            <Text style={styles.sigTitle}>Le Vendeur :</Text>
            <Text style={styles.sigName}>Nom : {decharge.nom_vendeur || "—"}</Text>
            <Text style={styles.sigLabel}>Signature :</Text>
            {decharge.signature_uri ? (
              <Image
                source={{ uri: decharge.signature_uri }}
                style={styles.sigImage}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.sigEmpty}><Text style={styles.sigEmptyText}>—</Text></View>
            )}
          </View>

          {/* Acheteur / Représentant */}
          <View style={styles.sigBlock}>
            <Text style={styles.sigTitle}>Pour l'Acheteur (Représentant) :</Text>
            <Text style={styles.sigName}>
              Nom : {decharge.nom_representant || decharge.nom_acheteur || "—"}
            </Text>
            <Text style={styles.sigLabel}>Signature :</Text>
            {decharge.signature_acheteur_uri ? (
              <Image
                source={{ uri: decharge.signature_acheteur_uri }}
                style={styles.sigImage}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.sigEmpty}><Text style={styles.sigEmptyText}>—</Text></View>
            )}
          </View>
        </View>

      </View>
      {/* ─── FIN DOCUMENT ─────────────────────────────────────────── */}

      {/* Pièces justificatives (non incluses dans le PDF) */}
      <View style={styles.docsSection}>
        <Text style={styles.docsTitle}>Pièces justificatives</Text>
        <Text style={styles.docsSubtitle}>
          Visibles uniquement dans l'application — non incluses dans l'impression / l'export.
        </Text>

        <View style={styles.groupHeaderRow}>
          <Text style={styles.docsGroupTitle}>
            {decharge.vendeur_id_type === "passport"
              ? "Passeport du vendeur"
              : "CNIB du vendeur"}
          </Text>
          <View style={styles.actionBtnRow}>
            <TouchableOpacity style={styles.previewSmallBtn} onPress={handlePreviewPiece}>
              <Ionicons name="eye-outline" size={14} color="#fff" />
              <Text style={styles.exportSmallBtnText}>Aperçu</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportSmallBtn} onPress={handlePrintPiece}>
              <Ionicons name="print-outline" size={14} color="#fff" />
              <Text style={styles.exportSmallBtnText}>Exporter</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.docsRow}>
          <PhotoCard
            label="Recto"
            uri={decharge.vendeur_id_recto}
            onPress={() => pickAndReplacePhoto("vendeur_id_recto")}
          />
          {decharge.vendeur_id_type !== "passport" && (
            <PhotoCard
              label="Verso"
              uri={decharge.vendeur_id_verso}
              onPress={() => pickAndReplacePhoto("vendeur_id_verso")}
            />
          )}
        </View>

        <View style={styles.groupHeaderRow}>
          <Text style={styles.docsGroupTitle}>Carte grise</Text>
          <View style={styles.actionBtnRow}>
            <TouchableOpacity style={styles.previewSmallBtn} onPress={handlePreviewCarteGrise}>
              <Ionicons name="eye-outline" size={14} color="#fff" />
              <Text style={styles.exportSmallBtnText}>Aperçu</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportSmallBtn} onPress={handlePrintCarteGrise}>
              <Ionicons name="print-outline" size={14} color="#fff" />
              <Text style={styles.exportSmallBtnText}>Exporter</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.docsRow}>
          <PhotoCard
            label="Recto"
            uri={decharge.carte_grise_recto}
            onPress={() => pickAndReplacePhoto("carte_grise_recto")}
          />
          <PhotoCard
            label="Verso"
            uri={decharge.carte_grise_verso}
            onPress={() => pickAndReplacePhoto("carte_grise_verso")}
          />
        </View>
      </View>

      {/* Bouton imprimer bas de page */}
      <TouchableOpacity style={styles.printBtn} onPress={handlePrint}>
        <Ionicons name="print-outline" size={20} color="#fff" />
        <Text style={styles.printBtnText}>Imprimer / Exporter PDF</Text>
      </TouchableOpacity>

      {/* ── Modale d'aperçu plein écran avec pinch-to-zoom ── */}
      <Modal
        visible={!!preview}
        animationType="fade"
        onRequestClose={() => setPreview(null)}
        statusBarTranslucent
      >
        <View style={styles.previewFullOverlay}>
          {/* Header */}
          <View style={styles.previewHeader}>
            <TouchableOpacity
              style={styles.previewCloseBtn}
              onPress={() => setPreview(null)}
            >
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.previewHeaderTitle} numberOfLines={1}>
                {preview?.title}
              </Text>
              <Text style={styles.previewHeaderSubtitle} numberOfLines={1}>
                Vendeur : {decharge.nom_vendeur || "—"}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.previewExportBtn}
              onPress={async () => {
                const fn = preview?.onExport;
                setPreview(null);
                if (fn) await fn();
              }}
            >
              <Ionicons name="print-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Toggle Recto/Verso (sauf passeport) */}
          {!preview?.isPassport && (
            <View style={styles.previewTabs}>
              <TouchableOpacity
                style={[
                  styles.previewTab,
                  previewFace === "recto" && styles.previewTabActive,
                ]}
                onPress={() => setPreviewFace("recto")}
              >
                <Text
                  style={[
                    styles.previewTabText,
                    previewFace === "recto" && styles.previewTabTextActive,
                  ]}
                >
                  Recto
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.previewTab,
                  previewFace === "verso" && styles.previewTabActive,
                ]}
                onPress={() => setPreviewFace("verso")}
              >
                <Text
                  style={[
                    styles.previewTabText,
                    previewFace === "verso" && styles.previewTabTextActive,
                  ]}
                >
                  Verso
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Zone d'image zoomable */}
          <View style={styles.previewImageArea}>
            {currentPreviewUri ? (
              <WebView
                key={`${preview?.title}-${previewFace}`}
                originWhitelist={["*"]}
                source={{ html: buildZoomHtml(currentPreviewUri) }}
                style={styles.previewWebView}
                scalesPageToFit={false}
                javaScriptEnabled={false}
                bounces={false}
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View style={styles.previewNoImage}>
                <Ionicons name="image-outline" size={48} color="#666" />
                <Text style={styles.previewNoImageText}>Aucune photo</Text>
              </View>
            )}
          </View>

          {/* Hint */}
          <Text style={styles.previewHint}>
            Pincer pour zoomer · Double-tap pour ajuster
          </Text>
        </View>
      </Modal>
    </ScrollView>
    </SafeAreaView>
  );
}

function PhotoCard({
  label,
  uri,
  onPress,
}: {
  label: string;
  uri: string | null | undefined;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.photoCard} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.photoCardLabel}>{label}</Text>
      {uri ? (
        <Image source={{ uri }} style={styles.photoCardImg} resizeMode="cover" />
      ) : (
        <View style={styles.photoCardEmpty}>
          <Ionicons name="camera-outline" size={28} color="#999" />
          <Text style={styles.photoCardEmptyText}>Ajouter</Text>
        </View>
      )}
      <View style={styles.photoCardEditBadge}>
        <Ionicons name={uri ? "create-outline" : "add"} size={14} color="#fff" />
        <Text style={styles.photoCardEditText}>{uri ? "Modifier" : "Ajouter"}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { padding: 15, paddingBottom: 50, backgroundColor: "#f0f0f0" },

  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    backgroundColor: "#FF9500",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
    gap: 6,
  },
  editBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  // ── Document blanc style papier ──
  document: {
    backgroundColor: "#fff",
    borderRadius: 4,
    padding: 20,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  mainTitle: {
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
    color: "#000",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  hrBold: { height: 2, backgroundColor: "#000", marginBottom: 12 },

  section: { marginTop: 10 },
  bodyText: { fontSize: 13, color: "#000", lineHeight: 20, marginTop: 3 },
  bold: { fontWeight: "bold" },
  underline: { textDecorationLine: "underline" },
  italic: { fontStyle: "italic" },
  prixNum: { fontWeight: "bold", fontSize: 14 },

  legalBox: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#ccc",
  },
  legalText: { fontSize: 12, color: "#333", lineHeight: 18, fontStyle: "italic" },

  // ── Signatures ──
  sigRow: {
    flexDirection: "row",
    marginTop: 20,
    gap: 10,
  },
  sigBlock: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: "#000",
    paddingTop: 8,
  },
  sigTitle: { fontSize: 12, fontWeight: "800", marginBottom: 4 },
  sigName: { fontSize: 12, color: "#222", marginBottom: 4 },
  sigLabel: { fontSize: 12, color: "#444" },
  sigImage: {
    width: "100%",
    height: 80,
    marginTop: 6,
    backgroundColor: "#fafafa",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  sigEmpty: {
    height: 60,
    borderWidth: 1,
    borderColor: "#ddd",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 6,
    backgroundColor: "#fafafa",
  },
  sigEmptyText: { color: "#aaa", fontSize: 12 },

  // ── Pièces justificatives ──
  docsSection: {
    marginTop: 20,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 15,
    borderWidth: 1,
    borderColor: "#eee",
  },
  docsTitle: { fontSize: 15, fontWeight: "800", color: "#222" },
  docsSubtitle: { fontSize: 11, color: "#888", fontStyle: "italic", marginTop: 2 },
  docsGroupTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FF9500",
    marginTop: 14,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  groupHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  actionBtnRow: {
    flexDirection: "row",
    gap: 6,
  },
  exportSmallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#007AFF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 14,
    marginBottom: 6,
  },
  previewSmallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#5856D6",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 14,
    marginBottom: 6,
  },
  exportSmallBtnText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  // ── Modale d'aperçu plein écran ──
  previewFullOverlay: {
    flex: 1,
    backgroundColor: "#000",
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 44,
    paddingBottom: 10,
    backgroundColor: "#111",
    gap: 6,
  },
  previewCloseBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  previewExportBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#007AFF",
    borderRadius: 8,
  },
  previewHeaderTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  previewHeaderSubtitle: {
    color: "#bbb",
    fontSize: 11,
    marginTop: 2,
  },
  previewTabs: {
    flexDirection: "row",
    backgroundColor: "#1a1a1a",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  previewTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#2a2a2a",
    alignItems: "center",
  },
  previewTabActive: {
    backgroundColor: "#FF9500",
  },
  previewTabText: {
    color: "#aaa",
    fontSize: 13,
    fontWeight: "700",
  },
  previewTabTextActive: {
    color: "#fff",
  },
  previewImageArea: {
    flex: 1,
    backgroundColor: "#000",
  },
  previewWebView: {
    flex: 1,
    backgroundColor: "#000",
  },
  previewNoImage: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  previewNoImageText: {
    color: "#888",
    fontStyle: "italic",
    fontSize: 13,
  },
  previewHint: {
    textAlign: "center",
    color: "#888",
    fontSize: 11,
    paddingVertical: 10,
    backgroundColor: "#111",
  },
  docsRow: { flexDirection: "row", gap: 10 },
  photoCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#fafafa",
  },
  photoCardLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#555",
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 4,
  },
  photoCardImg: { width: "100%", height: 130 },
  photoCardEmpty: {
    height: 130,
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  photoCardEmptyText: { color: "#999", fontSize: 11 },
  photoCardEditBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "#FF9500",
    paddingVertical: 6,
  },
  photoCardEditText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  // ── Bouton print ──
  printBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#007AFF",
    padding: 16,
    borderRadius: 10,
    marginTop: 20,
    gap: 8,
  },
  printBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
