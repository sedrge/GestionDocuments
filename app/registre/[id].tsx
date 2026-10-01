// app/registre/[id].tsx

import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
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
import { WebView } from "react-native-webview";
import { AuthImage } from "../../components/AuthImage";
import { api } from "../../lib/api";
import { resolveAuthImages } from "../../lib/authImageDataUri";
import { printAndSharePdf } from "../../lib/sharePdf";

const REGISTRE_FILE_FIELDS = [
  "signature_uri",
  "signature_documents_uri",
  "client_id_recto",
  "client_id_verso",
  "carte_grise_recto",
  "carte_grise_verso",
  "certificat_vente",
];

type PreviewData = {
  title: string;
  rectoUri: string | null | undefined;
  versoUri: string | null | undefined;
  single?: boolean;
  onExport: () => void;
};

export default function RegistreDetail() {
  const { id } = useLocalSearchParams();
  const [registre, setRegistre] = useState<any>(null);
  const [imageData, setImageData] = useState<Record<string, string | null>>({});
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewFace, setPreviewFace] = useState<"recto" | "verso">("recto");

  const fetchRegistre = async () => {
    try {
      const data = await api.getRegistre(String(id));
      setRegistre(data);
      setImageData(
        await resolveAuthImages(
          "registres",
          String(id),
          REGISTRE_FILE_FIELDS,
          api.fileUrl,
          (field) => !!data[field],
        ),
      );
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    }
  };

  useEffect(() => {
    fetchRegistre();
  }, []);

  if (!registre) return null;

  const formatDate = (d: string) => {
    if (!d) return "—";
    if (d.includes("/")) return d;
    const parts = d.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return d;
  };

  const openPreview = (data: PreviewData) => {
    setPreviewFace("recto");
    setPreview(data);
  };

  const exportPieceHtml = (
    title: string,
    rectoUri: string | null | undefined,
    versoUri: string | null | undefined,
    single = false,
  ) => `
<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8" /><style>
@page { size: A4 landscape; margin: 15mm; } * { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, sans-serif; color: #000; padding: 10px; } h1 { text-align: center; font-size: 16px; margin-bottom: 6px; text-transform: uppercase; }
.meta { text-align: center; font-size: 11px; color: #555; margin-bottom: 18px; } .row { display: flex; justify-content: center; gap: 20px; }
.face { display: flex; flex-direction: column; align-items: center; } .label { font-size: 12px; font-weight: bold; margin-bottom: 6px; }
.piece-img { width: 100%; max-height: 75vh; object-fit: contain; border: 1px solid #999; } .duo .face { width: 48%; } .single .face { width: 60%; }
.piece-empty { width: 100%; aspect-ratio: 85/54; border: 1px dashed #999; display: flex; align-items: center; justify-content: center; color: #999; font-style: italic; font-size: 12px; }
</style></head><body><h1>${title}</h1><div class="meta">Client : ${registre.nom_prenom || "—"}</div>
<div class="row ${single ? "single" : "duo"}"><div class="face"><div class="label">${single ? "Document" : "Recto"}</div>${rectoUri ? `<img src="${rectoUri}" class="piece-img" />` : `<div class="piece-empty">Aucune photo</div>`}</div>
${single ? "" : `<div class="face"><div class="label">Verso</div>${versoUri ? `<img src="${versoUri}" class="piece-img" />` : `<div class="piece-empty">Aucune photo</div>`}</div>`}</div></body></html>`;

  const exportPdf = async (html: string, title: string) => {
    try {
      await printAndSharePdf(html, title);
    } catch (e: any) {
      Alert.alert("Erreur d'export", e?.message ?? String(e));
    }
  };

  const exportPiece = async (
    title: string,
    fields: string[],
    single = false,
  ) => {
    if (!fields.some((field) => registre[field]))
      return Alert.alert(
        "Aucune photo",
        "Aucune image du document à exporter.",
      );
    await exportPdf(
      exportPieceHtml(
        title,
        imageData[fields[0]],
        imageData[fields[1]],
        single,
      ),
      `Exporter ${title}`,
    );
  };

  const previewPiece = (title: string, fields: string[], single = false) => {
    if (!fields.some((field) => registre[field]))
      return Alert.alert(
        "Aucune photo",
        "Aucune image du document à afficher.",
      );
    openPreview({
      title,
      rectoUri: imageData[fields[0]],
      versoUri: imageData[fields[1]],
      single,
      onExport: () => exportPiece(title, fields, single),
    });
  };

  const handlePrint = async () => {
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8" /><style>
      body { font-family: Arial, sans-serif; font-size: 13px; color: #000; padding: 30px 40px; } h1 { text-align: center; font-size: 17px; border-bottom: 2px solid #000; padding-bottom: 10px; }
      h2 { font-size: 14px; margin-top: 18px; border-bottom: 1px solid #ccc; padding-bottom: 4px; } p { margin: 8px 0; line-height: 1.5; } strong { font-weight: bold; }
      .signatures { display: flex; gap: 25px; margin-top: 30px; }.signature { flex: 1; border-top: 1px solid #000; padding-top: 8px; }.signature img { width: 100%; height: 70px; object-fit: contain; }
    </style></head><body><h1>REGISTRE DE RÉCUPÉRATION</h1>
      <p><strong>Date :</strong> ${formatDate(registre.date)}</p><p><strong>Nom & Prénom :</strong> ${registre.nom_prenom || "—"}</p><p><strong>Téléphone :</strong> ${registre.telephone || "—"}</p>
      <h2>Démarcheur</h2><p><strong>Nom :</strong> ${registre.nom_demarcheur || "—"}</p><p><strong>Téléphone :</strong> ${registre.telephone_demarcheur || "—"}</p>
      <h2>Moto</h2><p><strong>N° Série :</strong> ${registre.numero_serie || "—"}</p><p><strong>Immatriculation :</strong> ${registre.immatriculation || "—"}</p><p><strong>Provenance :</strong> ${registre.provenance || "—"}</p><p><strong>Nature :</strong> ${registre.nature || "—"}</p><p><strong>Signateur :</strong> ${registre.nom_signateur || "—"}</p>
      <h2>Récupération</h2><p>Moto : <strong>${registre.moto_recuperee ? "Récupérée" : "Non récupérée"}</strong> | Documents : <strong>${registre.documents_recuperes ? "Récupérés" : "Non récupérés"}</strong></p><p><strong>Types de documents :</strong> ${registre.types_documents || "—"}</p>
      <div class="signatures"><div class="signature"><strong>Récupération moto</strong>${imageData.signature_uri ? `<img src="${imageData.signature_uri}" />` : "<p>—</p>"}</div><div class="signature"><strong>Récupération documents</strong>${imageData.signature_documents_uri ? `<img src="${imageData.signature_documents_uri}" />` : "<p>—</p>"}</div></div>
    </body></html>`;
    await exportPdf(html, "Exporter le registre");
  };

  const buildZoomHtml = (uri: string) =>
    `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=6, user-scalable=yes" /><style>html,body{margin:0;padding:0;height:100%;background:#000}body{display:flex;justify-content:center;align-items:center}img{max-width:100%;max-height:100%;object-fit:contain}</style></head><body><img src="${uri}" /></body></html>`;
  const currentPreviewUri = preview
    ? previewFace === "recto"
      ? preview.rectoUri
      : preview.versoUri
    : null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen
        options={{
          title: `Registre — ${registre.nom_prenom}`,
          headerRight: () => (
            <TouchableOpacity onPress={handlePrint} style={{ marginRight: 10 }}>
              <Ionicons name="print-outline" size={24} color="#007AFF" />
            </TouchableOpacity>
          ),
        }}
      />
      <TouchableOpacity style={styles.printBtn} onPress={handlePrint}>
        <Ionicons name="print-outline" size={20} color="#fff" />
        <Text style={styles.printBtnText}>Imprimer / Exporter PDF</Text>
      </TouchableOpacity>

      <Text style={styles.label}>Date :</Text>
      <Text style={styles.value}>{formatDate(registre.date)}</Text>

      <Text style={styles.label}>Nom & Prénom :</Text>
      <Text style={styles.value}>{registre.nom_prenom || "—"}</Text>

      <Text style={styles.label}>Téléphone :</Text>
      <Text style={styles.value}>{registre.telephone || "—"}</Text>

      <Text style={styles.sectionTitle}>Démarcheur</Text>
      <Text style={styles.label}>Nom :</Text>
      <Text style={styles.value}>{registre.nom_demarcheur || "—"}</Text>
      <Text style={styles.label}>Téléphone :</Text>
      <Text style={styles.value}>{registre.telephone_demarcheur || "—"}</Text>

      <Text style={styles.sectionTitle}>Moto</Text>
      <Text style={styles.label}>N° Série Moto :</Text>
      <Text style={styles.value}>{registre.numero_serie || "—"}</Text>

      <Text style={styles.label}>Immatriculation :</Text>
      <Text style={styles.value}>{registre.immatriculation || "—"}</Text>

      <Text style={styles.label}>Provenance :</Text>
      <Text style={styles.value}>{registre.provenance || "—"}</Text>

      <Text style={styles.label}>Nature :</Text>
      <Text style={styles.value}>{registre.nature || "—"}</Text>

      <Text style={styles.label}>Nom du Signateur :</Text>
      <Text style={styles.value}>{registre.nom_signateur || "—"}</Text>

      <Text style={styles.sectionTitle}>Statut de récupération</Text>
      <View style={styles.badgeRow}>
        <View
          style={[
            styles.badge,
            registre.moto_recuperee ? styles.badgeOk : styles.badgeKo,
          ]}
        >
          <Ionicons
            name={registre.moto_recuperee ? "checkmark-circle" : "close-circle"}
            size={14}
            color="#fff"
          />
          <Text style={styles.badgeText}>
            {registre.moto_recuperee ? "Moto récupérée" : "Moto non récupérée"}
          </Text>
        </View>
        <View
          style={[
            styles.badge,
            registre.documents_recuperes ? styles.badgeOk : styles.badgeKo,
          ]}
        >
          <Ionicons
            name={
              registre.documents_recuperes ? "checkmark-circle" : "close-circle"
            }
            size={14}
            color="#fff"
          />
          <Text style={styles.badgeText}>
            {registre.documents_recuperes
              ? "Documents récupérés"
              : "Documents non récupérés"}
          </Text>
        </View>
      </View>

      {registre.documents_recuperes && registre.types_documents ? (
        <>
          <Text style={styles.label}>Type(s) de document(s) :</Text>
          <Text style={styles.value}>{registre.types_documents}</Text>
        </>
      ) : null}

      {/* Signatures côte à côte */}
      {(registre.moto_recuperee || registre.documents_recuperes) && (
        <>
          <Text style={styles.sectionTitle}>Signatures</Text>
          <View style={styles.sigRow}>
            {registre.moto_recuperee && (
              <View style={styles.sigBlock}>
                <Text style={styles.sigTitle}>Récupération moto</Text>
                {registre.signature_uri ? (
                  <AuthImage
                    uri={api.fileUrl("registres", String(id), "signature_uri")}
                    style={styles.sigImage}
                    resizeMode="contain"
                  />
                ) : (
                  <Text style={styles.noSignature}>Aucune signature</Text>
                )}
              </View>
            )}
            {registre.documents_recuperes && (
              <View style={styles.sigBlock}>
                <Text style={styles.sigTitle}>Récupération documents</Text>
                {registre.signature_documents_uri ? (
                  <AuthImage
                    uri={api.fileUrl(
                      "registres",
                      String(id),
                      "signature_documents_uri",
                    )}
                    style={styles.sigImage}
                    resizeMode="contain"
                  />
                ) : (
                  <Text style={styles.noSignature}>Aucune signature</Text>
                )}
              </View>
            )}
          </View>
        </>
      )}

      {/* Pièces justificatives */}
      <Text style={styles.sectionTitle}>Pièces justificatives</Text>

      <DocumentHeader
        title={
          registre.client_id_type === "passport"
            ? "Passeport du client"
            : "CNIB du client"
        }
        onPreview={() =>
          previewPiece(
            "Pièce d'identité du client",
            ["client_id_recto", "client_id_verso"],
            registre.client_id_type === "passport",
          )
        }
        onExport={() =>
          exportPiece(
            "la pièce d'identité du client",
            ["client_id_recto", "client_id_verso"],
            registre.client_id_type === "passport",
          )
        }
      />
      <View style={styles.docsRow}>
        <PhotoCard
          label={
            registre.client_id_type === "passport" ? "Page principale" : "Recto"
          }
          uri={imageData.client_id_recto}
        />
        {registre.client_id_type !== "passport" && (
          <PhotoCard label="Verso" uri={imageData.client_id_verso} />
        )}
      </View>

      <DocumentHeader
        title="Carte grise"
        onPreview={() =>
          previewPiece("Carte grise", [
            "carte_grise_recto",
            "carte_grise_verso",
          ])
        }
        onExport={() =>
          exportPiece("la carte grise", [
            "carte_grise_recto",
            "carte_grise_verso",
          ])
        }
      />
      <View style={styles.docsRow}>
        <PhotoCard label="Recto" uri={imageData.carte_grise_recto} />
        <PhotoCard label="Verso" uri={imageData.carte_grise_verso} />
      </View>

      <DocumentHeader
        title="Certificat de vente"
        onPreview={() =>
          previewPiece("Certificat de vente", ["certificat_vente"], true)
        }
        onExport={() =>
          exportPiece("le certificat de vente", ["certificat_vente"], true)
        }
      />
      <View style={styles.docsRow}>
        <PhotoCard label="Recto" uri={imageData.certificat_vente} tall />
      </View>

      <Modal
        visible={!!preview}
        animationType="fade"
        onRequestClose={() => setPreview(null)}
        statusBarTranslucent
      >
        <View style={styles.previewFullOverlay}>
          <View style={styles.previewHeader}>
            <TouchableOpacity onPress={() => setPreview(null)}>
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.previewHeaderTitle} numberOfLines={1}>
                {preview?.title}
              </Text>
              <Text style={styles.previewHeaderSubtitle}>
                Client : {registre.nom_prenom || "—"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={async () => {
                const fn = preview?.onExport;
                setPreview(null);
                if (fn) await fn();
              }}
            >
              <Ionicons name="print-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
          {!preview?.single && (
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
          <View style={styles.previewImageArea}>
            {currentPreviewUri ? (
              <WebView
                source={{ html: buildZoomHtml(currentPreviewUri) }}
                style={styles.previewWebView}
                scalesPageToFit={false}
                javaScriptEnabled={false}
              />
            ) : (
              <View style={styles.previewNoImage}>
                <Ionicons name="image-outline" size={48} color="#666" />
                <Text style={styles.previewNoImageText}>Aucune photo</Text>
              </View>
            )}
          </View>
          <Text style={styles.previewHint}>
            Pincer pour zoomer · Double-tap pour ajuster
          </Text>
        </View>
      </Modal>
    </ScrollView>
  );
}

function PhotoCard({
  label,
  uri,
  tall,
}: {
  label: string;
  uri: string | null | undefined;
  tall?: boolean;
}) {
  return (
    <View style={styles.photoCard}>
      <Text style={styles.photoCardLabel}>{label}</Text>
      {uri ? (
        <Image
          source={{ uri }}
          style={[styles.photoCardImg, tall && { height: 220 }]}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.photoCardEmpty, tall && { height: 220 }]}>
          <Ionicons name="image-outline" size={28} color="#999" />
          <Text style={styles.photoCardEmptyText}>Aucune photo</Text>
        </View>
      )}
    </View>
  );
}

function DocumentHeader({
  title,
  onPreview,
  onExport,
}: {
  title: string;
  onPreview: () => void;
  onExport: () => void;
}) {
  return (
    <View style={styles.groupHeaderRow}>
      <Text style={styles.docsGroupTitle}>{title}</Text>
      <View style={styles.actionBtnRow}>
        <TouchableOpacity style={styles.previewSmallBtn} onPress={onPreview}>
          <Ionicons name="eye-outline" size={14} color="#fff" />
          <Text style={styles.exportSmallBtnText}>Aperçu</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.exportSmallBtn} onPress={onExport}>
          <Ionicons name="print-outline" size={14} color="#fff" />
          <Text style={styles.exportSmallBtnText}>Exporter</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 40 },
  printBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#007AFF",
    paddingVertical: 11,
    borderRadius: 8,
    marginBottom: 12,
  },
  printBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  label: { fontWeight: "bold", marginTop: 12, fontSize: 14, color: "#333" },
  value: { marginTop: 4, fontSize: 15, color: "#000" },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#007AFF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 22,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    paddingBottom: 4,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeOk: { backgroundColor: "#4CAF50" },
  badgeKo: { backgroundColor: "#9e9e9e" },
  badgeText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  sigRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  sigBlock: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: "#000",
    paddingTop: 6,
  },
  sigTitle: { fontSize: 12, fontWeight: "800", marginBottom: 4 },
  sigImage: {
    width: "100%",
    height: 90,
    backgroundColor: "#fafafa",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  noSignature: {
    fontSize: 12,
    fontStyle: "italic",
    color: "#888",
    paddingVertical: 12,
    textAlign: "center",
  },
  docsGroupTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#444",
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
    marginTop: 14,
  },
  actionBtnRow: { flexDirection: "row", gap: 6 },
  previewSmallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#5856D6",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  exportSmallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#007AFF",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  exportSmallBtnText: { color: "#fff", fontSize: 11, fontWeight: "700" },
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
  previewFullOverlay: { flex: 1, backgroundColor: "#000" },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#111",
    gap: 8,
  },
  previewHeaderTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  previewHeaderSubtitle: { color: "#aaa", fontSize: 11, marginTop: 2 },
  previewTabs: {
    flexDirection: "row",
    backgroundColor: "#111",
    paddingHorizontal: 16,
  },
  previewTab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  previewTabActive: { borderBottomColor: "#007AFF" },
  previewTabText: { color: "#aaa", fontWeight: "600" },
  previewTabTextActive: { color: "#fff" },
  previewImageArea: { flex: 1 },
  previewWebView: { flex: 1, backgroundColor: "#000" },
  previewNoImage: { flex: 1, justifyContent: "center", alignItems: "center" },
  previewNoImageText: { color: "#aaa", marginTop: 8 },
  previewHint: {
    color: "#888",
    textAlign: "center",
    fontSize: 11,
    paddingVertical: 10,
  },
});
