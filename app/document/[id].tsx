// app/document/[id].tsx
//
// Visionneuse de document intégrée : évite de faire sortir l'utilisateur de
// l'app (Sharing.shareAsync) pour les types qu'on peut effectivement
// afficher nous-mêmes (image, PDF, vidéo). Pour les autres types (doc, xlsx,
// zip…), on retombe sur le partage OS existant.
import { Ionicons } from "@expo/vector-icons";
import { File, Paths } from "expo-file-system";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Pdf from "react-native-pdf";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { api, getToken } from "../../lib/api";
import { fetchAuthImageDataUri } from "../../lib/authImageDataUri";

const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "heic", "gif"];
const VIDEO_EXTS = ["mp4", "mov", "m4v"];

// Même pattern de visionneuse zoomable (WebView + data URI) que
// decharge/[id].tsx, moto/[id].tsx et registre.tsx.
const buildZoomHtml = (dataUri: string) => `
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
  <img src="${dataUri}" />
</body></html>`;

function VideoDocument({ uri, token }: { uri: string; token: string }) {
  const player = useVideoPlayer(
    { uri, headers: { Authorization: `Bearer ${token}` } },
    (p) => {
      p.play();
    },
  );

  return (
    <VideoView
      player={player}
      style={{ flex: 1 }}
      contentFit="contain"
      nativeControls
    />
  );
}

export default function DocumentViewerScreen() {
  const params = useLocalSearchParams<{
    id: string;
    titre?: string;
    file_url?: string;
  }>();
  const id = String(params.id);
  const titre = params.titre || "Document";
  const ext = (params.file_url || "").split(".").pop()?.toLowerCase() ?? "";
  const isImage = IMAGE_EXTS.includes(ext);
  const isPdf = ext === "pdf";
  const isVideo = VIDEO_EXTS.includes(ext);
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [imageDataUri, setImageDataUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const t = await getToken();
      if (!mounted) return;
      setToken(t);

      if (isImage) {
        const dataUri = await fetchAuthImageDataUri(api.documentDownloadUrl(id));
        if (!mounted) return;
        if (!dataUri) setError("Impossible de charger l'image.");
        setImageDataUri(dataUri);
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  const handleOpenExternally = async () => {
    setOpening(true);
    try {
      const safeName = titre.replace(/[^a-zA-Z0-9.]/g, "_");
      const localFile = new File(Paths.document, safeName);
      const exists = await localFile.exists;

      if (!exists) {
        const t = token || (await getToken());
        await File.downloadFileAsync(api.documentDownloadUrl(id), localFile, {
          headers: t ? { Authorization: `Bearer ${t}` } : {},
        });
      }

      await Sharing.shareAsync(localFile.uri);
    } catch {
      setError("Impossible d'ouvrir ce fichier.");
    } finally {
      setOpening(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {titre}
        </Text>
        <TouchableOpacity
          onPress={handleOpenExternally}
          style={styles.headerBtn}
          disabled={opening}
        >
          {opening ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="share-outline" size={22} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {isPdf ? (
          token ? (
            <Pdf
              source={{
                uri: api.documentDownloadUrl(id),
                headers: { Authorization: `Bearer ${token}` },
                cache: true,
              }}
              style={styles.pdf}
              onError={() => setError("Impossible d'afficher ce PDF.")}
            />
          ) : (
            <ActivityIndicator color="#fff" size="large" style={styles.centered} />
          )
        ) : isVideo ? (
          token ? (
            <VideoDocument uri={api.documentDownloadUrl(id)} token={token} />
          ) : (
            <ActivityIndicator color="#fff" size="large" style={styles.centered} />
          )
        ) : isImage ? (
          loading ? (
            <ActivityIndicator color="#fff" size="large" style={styles.centered} />
          ) : imageDataUri ? (
            <WebView
              originWhitelist={["*"]}
              source={{ html: buildZoomHtml(imageDataUri) }}
              style={{ flex: 1, backgroundColor: "#000" }}
              scalesPageToFit={false}
              javaScriptEnabled={false}
              bounces={false}
            />
          ) : null
        ) : (
          <View style={styles.fallback}>
            <Ionicons name="document-outline" size={64} color="#8E8E93" />
            <Text style={styles.fallbackText}>
              Ce type de fichier ne peut pas être prévisualisé dans l'app.
            </Text>
            <TouchableOpacity
              style={styles.openBtn}
              onPress={handleOpenExternally}
              disabled={opening}
            >
              {opening ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="open-outline" size={18} color="#fff" />
                  <Text style={styles.openBtnText}>Ouvrir avec…</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: "#111",
  },
  headerBtn: { padding: 8 },
  headerTitle: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  content: { flex: 1 },
  centered: { flex: 1 },
  pdf: { flex: 1, backgroundColor: "#000" },
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
  fallbackText: { color: "#8E8E93", fontSize: 14, textAlign: "center" },
  openBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  openBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  errorBanner: {
    position: "absolute",
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: "rgba(255,59,48,0.9)",
    borderRadius: 10,
    padding: 12,
  },
  errorText: { color: "#fff", fontSize: 13, textAlign: "center" },
});
