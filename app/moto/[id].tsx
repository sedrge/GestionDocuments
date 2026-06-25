// app/moto/[id].tsx
//
// Détail d'une moto :
//  • toutes les infos
//  • QR code généré à partir des infos clés (imprimable)
//  • photo principale en petit, swipe + zoom plein écran sur clic

import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
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
import QRCode from "react-native-qrcode-svg";
import { WebView } from "react-native-webview";
import { supabase } from "../../lib/supabase";

const { width: WINDOW_W, height: WINDOW_H } = Dimensions.get("window");

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
  moto_images?: {
    id: string;
    image_uri: string;
    is_principal: boolean;
    position: number;
  }[];
};

// Données encodées dans le QR code
const buildQrPayload = (m: Moto): string => {
  const payload: Record<string, any> = {
    id: m.id,
    marque: m.marque,
    modele: m.modele,
    type: m.type,
    categorie: m.categorie,
    couleur: m.couleur,
    annee: m.annee_fabrication,
    cylindree: m.cylindree,
    chassis: m.numero_chassis,
    moteur: m.numero_moteur,
    immat: m.immatriculation,
    etat: m.etat,
    prix_vente: m.prix_vente,
  };
  // On retire les nulls/undefined pour limiter la taille du QR
  Object.keys(payload).forEach((k) => {
    if (payload[k] == null || payload[k] === "") delete payload[k];
  });
  return JSON.stringify(payload);
};

export default function MotoDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [moto, setMoto] = useState<Moto | null>(null);
  const [loading, setLoading] = useState(true);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const qrRef = useRef<any>(null);
  const [qrBase64, setQrBase64] = useState<string | null>(null);

  const fetchMoto = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("motos")
      .select("*, moto_images(id, image_uri, is_principal, position)")
      .eq("id", id)
      .single();
    if (error || !data) {
      Alert.alert("Erreur", "Impossible de charger cette moto.");
      router.back();
      return;
    }
    if (data.moto_images) {
      data.moto_images.sort((a: any, b: any) => {
        if (a.is_principal && !b.is_principal) return -1;
        if (!a.is_principal && b.is_principal) return 1;
        return (a.position ?? 0) - (b.position ?? 0);
      });
    }
    setMoto(data as Moto);
    setLoading(false);
  };

  useEffect(() => {
    fetchMoto();
  }, [id]);

  // Capture le QR en base64 dès qu'il est rendu, pour l'impression
  useEffect(() => {
    if (!moto) return;
    const t = setTimeout(() => {
      if (qrRef.current?.toDataURL) {
        qrRef.current.toDataURL((b64: string) => setQrBase64(b64));
      }
    }, 400);
    return () => clearTimeout(t);
  }, [moto]);

  if (loading || !moto) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color="#FF9500" />
      </View>
    );
  }

  const imgs = moto.moto_images || [];
  const principal = imgs[0]; // déjà trié

  const openGalleryAt = (i: number) => {
    setGalleryIndex(i);
    setGalleryOpen(true);
  };

  // ── Export PDF avec QR code ───────────────────────────────────────────────
  const ensureQrBase64 = (): Promise<string | null> =>
    new Promise((resolve) => {
      if (qrBase64) return resolve(qrBase64);
      if (qrRef.current?.toDataURL) {
        qrRef.current.toDataURL((b64: string) => {
          setQrBase64(b64);
          resolve(b64);
        });
      } else {
        resolve(null);
      }
    });

  const handlePrint = async () => {
    const b64 = await ensureQrBase64();
    if (!b64) {
      return Alert.alert(
        "QR pas encore prêt",
        "Le QR code n'a pas pu être préparé. Réessayez dans un instant.",
      );
    }

    const principalImg = principal ? principal.image_uri : null;

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; padding: 24px; color: #000; }
    h1 { font-size: 18px; text-align: center; margin-bottom: 6px; text-transform: uppercase; }
    .sub { text-align: center; font-size: 12px; color: #555; margin-bottom: 16px; }
    .grid { display: flex; gap: 20px; margin-bottom: 18px; align-items: flex-start; }
    .col { flex: 1; }
    .qr { width: 220px; text-align: center; }
    .qr img { width: 200px; height: 200px; border: 1px solid #000; padding: 6px; background: #fff; }
    .qr-caption { font-size: 11px; margin-top: 6px; color: #555; }
    .photo { width: 100%; max-height: 220px; object-fit: cover; border-radius: 6px; border: 1px solid #ccc; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    td { padding: 6px 8px; border-bottom: 1px solid #eee; }
    td.k { color: #666; width: 38%; }
    td.v { font-weight: 600; }
    .footer { margin-top: 20px; font-size: 10px; text-align: center; color: #999; }
  </style>
</head>
<body>
  <h1>Fiche moto</h1>
  <div class="sub">${[moto.marque, moto.modele, moto.type].filter(Boolean).join(" ")}</div>

  <div class="grid">
    <div class="col">
      ${principalImg ? `<img class="photo" src="${principalImg}" />` : ""}
      <table style="margin-top: 12px;">
        ${row("Marque", moto.marque)}
        ${row("Modèle", moto.modele)}
        ${row("Type", moto.type)}
        ${row("Catégorie", moto.categorie)}
        ${row("Couleur", moto.couleur)}
        ${row("Année", moto.annee_fabrication)}
        ${row("Cylindrée", moto.cylindree)}
        ${row("État", moto.etat)}
        ${row("N° Châssis", moto.numero_chassis)}
        ${row("N° Moteur", moto.numero_moteur)}
        ${row("Immatriculation", moto.immatriculation)}
        ${row("Prix de vente", moto.prix_vente != null ? `${moto.prix_vente.toLocaleString("fr-FR")} FCFA` : null)}
      </table>
    </div>
    <div class="qr">
      <img src="data:image/png;base64,${b64}" />
      <div class="qr-caption">Scanner pour voir les infos de la moto.</div>
    </div>
  </div>

  <div class="footer">docvault — Imprimez et collez ce QR sur la moto.</div>
</body>
</html>`;

    try {
      await printAndSharePdf(html, "Exporter la fiche moto");
    } catch (e: any) {
      Alert.alert("Erreur d'export", e?.message ?? String(e));
    }
  };

  const handleDelete = () => {
    Alert.alert("Supprimer la moto", "Cette action est irréversible.", [
      { text: "Annuler" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          await supabase.from("moto_images").delete().eq("moto_id", moto.id);
          const { error } = await supabase.from("motos").delete().eq("id", moto.id);
          if (error) Alert.alert("Erreur", error.message);
          else router.back();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f5f5f7" }}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 50 }}>
      <Stack.Screen
        options={{
          title: [moto.marque, moto.modele].filter(Boolean).join(" ") || "Moto",
          headerRight: () => (
            <TouchableOpacity onPress={handlePrint} style={{ marginRight: 10 }}>
              <Ionicons name="print-outline" size={24} color="#FF9500" />
            </TouchableOpacity>
          ),
        }}
      />

      {/* Photo principale (petite) */}
      <View style={styles.heroWrap}>
        {principal ? (
          <TouchableOpacity onPress={() => openGalleryAt(0)} activeOpacity={0.9}>
            <Image source={{ uri: principal.image_uri }} style={styles.hero} resizeMode="cover" />
            {imgs.length > 1 && (
              <View style={styles.heroBadge}>
                <Ionicons name="images-outline" size={14} color="#fff" />
                <Text style={styles.heroBadgeText}>{imgs.length}</Text>
              </View>
            )}
            <View style={styles.heroExpand}>
              <Ionicons name="expand-outline" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
        ) : (
          <View style={[styles.hero, styles.heroEmpty]}>
            <Ionicons name="bicycle-outline" size={50} color="#bbb" />
            <Text style={{ color: "#999", marginTop: 8 }}>Aucune photo</Text>
          </View>
        )}
      </View>

      {/* Bouton Modifier */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: "#FF9500" }]}
          onPress={() => router.push({ pathname: "/moto", params: { id: moto.id } })}
        >
          <Ionicons name="create-outline" size={16} color="#fff" />
          <Text style={styles.actionBtnText}>Modifier</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: "#007AFF" }]}
          onPress={handlePrint}
        >
          <Ionicons name="print-outline" size={16} color="#fff" />
          <Text style={styles.actionBtnText}>Imprimer QR</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: "#ff4444" }]}
          onPress={handleDelete}
        >
          <Ionicons name="trash-outline" size={16} color="#fff" />
          <Text style={styles.actionBtnText}>Supprimer</Text>
        </TouchableOpacity>
      </View>

      {/* QR code */}
      <View style={styles.qrCard}>
        <Text style={styles.cardTitle}>QR Code</Text>
        <View style={styles.qrBox}>
          <QRCode
            value={buildQrPayload(moto)}
            size={180}
            backgroundColor="#fff"
            color="#000"
            getRef={(c) => (qrRef.current = c)}
            onError={() => setQrBase64(null)}
          />
        </View>
        <Text style={styles.qrHint}>
          Scannez pour afficher les informations de cette moto.
        </Text>
      </View>

      {/* Infos */}
      <View style={styles.infoCard}>
        <Text style={styles.cardTitle}>Informations</Text>
        <InfoRow label="Marque" value={moto.marque} />
        <InfoRow label="Modèle" value={moto.modele} />
        <InfoRow label="Type" value={moto.type} />
        <InfoRow label="Catégorie" value={moto.categorie} />
        <InfoRow label="Couleur" value={moto.couleur} />
        <InfoRow label="Année" value={moto.annee_fabrication} />
        <InfoRow label="Cylindrée" value={moto.cylindree} />
        <InfoRow label="État" value={moto.etat} />
        <InfoRow label="N° Châssis" value={moto.numero_chassis} />
        <InfoRow label="N° Moteur" value={moto.numero_moteur} />
        <InfoRow label="Immatriculation" value={moto.immatriculation} />
        <InfoRow
          label="Prix d'achat"
          value={moto.prix_achat != null ? `${moto.prix_achat.toLocaleString("fr-FR")} FCFA` : null}
        />
        <InfoRow
          label="Prix de vente"
          value={moto.prix_vente != null ? `${moto.prix_vente.toLocaleString("fr-FR")} FCFA` : null}
          highlight
        />
      </View>

      {/* Vignettes images */}
      {imgs.length > 1 && (
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Photos ({imgs.length})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {imgs.map((img, i) => (
              <TouchableOpacity key={img.id} onPress={() => openGalleryAt(i)}>
                <Image source={{ uri: img.image_uri }} style={styles.thumb} />
                {img.is_principal && (
                  <View style={styles.thumbBadge}>
                    <Ionicons name="star" size={10} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Galerie plein écran */}
      <Modal visible={galleryOpen} animationType="fade" onRequestClose={() => setGalleryOpen(false)} statusBarTranslucent>
        <View style={styles.galleryOverlay}>
          <View style={styles.galleryHeader}>
            <TouchableOpacity onPress={() => setGalleryOpen(false)} style={styles.galleryCloseBtn}>
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.galleryCounter}>
              {galleryIndex + 1} / {imgs.length}
            </Text>
            <View style={{ width: 40 }} />
          </View>
          <FlatList
            data={imgs}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={galleryIndex}
            getItemLayout={(_, i) => ({ length: WINDOW_W, offset: WINDOW_W * i, index: i })}
            onMomentumScrollEnd={(e) => {
              const i = Math.round(e.nativeEvent.contentOffset.x / WINDOW_W);
              setGalleryIndex(i);
            }}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={{ width: WINDOW_W, height: WINDOW_H - 100 }}>
                <WebView
                  originWhitelist={["*"]}
                  source={{ html: buildZoomHtml(item.image_uri) }}
                  style={{ flex: 1, backgroundColor: "#000" }}
                  scalesPageToFit={false}
                  javaScriptEnabled={false}
                  bounces={false}
                />
              </View>
            )}
          />
          <Text style={styles.galleryHint}>
            Glissez gauche/droite · Pincez pour zoomer
          </Text>
        </View>
      </Modal>
    </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number | null | undefined;
  highlight?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, highlight && styles.infoValueHighlight]}>
        {value == null || value === "" ? "—" : String(value)}
      </Text>
    </View>
  );
}

const row = (k: string, v: any) =>
  v != null && v !== ""
    ? `<tr><td class="k">${k}</td><td class="v">${v}</td></tr>`
    : "";

const buildZoomHtml = (uri: string) => `
<!DOCTYPE html>
<html><head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=6, user-scalable=yes" />
  <style>
    html, body { margin: 0; padding: 0; height: 100%; background: #000; }
    body { display: flex; justify-content: center; align-items: center; touch-action: pinch-zoom; }
    img { max-width: 100%; max-height: 100%; object-fit: contain; }
  </style>
</head><body>
  <img src="${uri}" />
</body></html>`;

const styles = StyleSheet.create({
  loaderWrap: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f5f5f7" },
  heroWrap: { padding: 15 },
  hero: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    backgroundColor: "#eee",
  },
  heroEmpty: { justifyContent: "center", alignItems: "center" },
  heroBadge: {
    position: "absolute",
    bottom: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  heroBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  heroExpand: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 6,
    borderRadius: 18,
  },
  actionsRow: {
    flexDirection: "row",
    paddingHorizontal: 15,
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  qrCard: {
    margin: 15,
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    elevation: 2,
    alignItems: "center",
  },
  qrBox: {
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#eee",
    marginTop: 10,
  },
  qrHint: { marginTop: 10, fontSize: 11, color: "#888", textAlign: "center", fontStyle: "italic" },
  infoCard: {
    margin: 15,
    marginTop: 0,
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#222",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  infoLabel: { fontSize: 13, color: "#888", width: "40%" },
  infoValue: { fontSize: 13, color: "#222", flex: 1, fontWeight: "600" },
  infoValueHighlight: { color: "#FF9500", fontWeight: "800" },
  thumb: { width: 80, height: 80, borderRadius: 8, backgroundColor: "#eee" },
  thumbBadge: {
    position: "absolute",
    top: 4,
    left: 4,
    backgroundColor: "rgba(255,149,0,0.95)",
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  galleryOverlay: { flex: 1, backgroundColor: "#000" },
  galleryHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingTop: 44,
    paddingBottom: 10,
    backgroundColor: "#111",
  },
  galleryCloseBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  galleryCounter: { flex: 1, color: "#fff", textAlign: "center", fontSize: 14, fontWeight: "700" },
  galleryHint: {
    color: "#888",
    fontSize: 11,
    textAlign: "center",
    paddingVertical: 10,
    backgroundColor: "#111",
  },
});
