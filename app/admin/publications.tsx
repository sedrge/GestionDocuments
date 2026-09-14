import { Ionicons } from "@expo/vector-icons";
import { File, UploadType } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FeatureGate } from "../../components/FeatureGate";
import { useFeatureFlags } from "../../context/FeatureFlagsContext";
import { useTenant } from "../../context/TenantContext";
import { useTheme } from "../../context/ThemeContext";
import { api, getToken } from "../../lib/api";
import { localUriToFormFile } from "../../lib/formUpload";

type Publication = {
  id: string;
  enterprise_id: string;
  texte: string | null;
  images: string[];
  image_urls: string[];
  video: string | null;
  video_url: string | null;
  created_at: string;
  scheduled_at: string | null;
  fb_post_id: string | null;
  fb_published_at: string | null;
  fb_publish_error: string | null;
  fb_publish_status: "not_published" | "published" | "error";
  selected_platforms: string[];
  platform_statuses: {
    platform: string;
    external_post_id: string | null;
    status: "not_published" | "published" | "error";
    error_message: string | null;
  }[];
};

type SocialPlatform = "facebook" | "tiktok";

type TikTokStatus = {
  external_post_id: string | null;
  status: "not_published" | "published" | "error";
  error_message: string | null;
};

type PublishMode = "now" | "schedule";

type MotoLite = {
  id: string;
  marque: string | null;
  modele: string | null;
  etat: string | null;
  prix_vente: number | null;
  created_at: string;
  statut: string | null;
  images?: { image_uri: string; is_principal: boolean }[];
};

type AutoMode = "aleatoire" | "nouvelle" | "ancienne";

// Lecture vidéo façon "reel" : muet, en boucle, sans contrôles. Isolé en
// composant dédié car useVideoPlayer doit être appelé de façon stable (même
// nombre de hooks à chaque rendu), ce qu'un renderItem de FlatList ne garantit
// pas si le hook était appelé directement dans la closure.
function VideoThumb({ uri, style }: { uri: string; style: any }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <VideoView
      player={player}
      style={style}
      contentFit="cover"
      nativeControls={false}
      pointerEvents="none"
    />
  );
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildPromoText(motos: MotoLite[], mode: AutoMode): string {
  const lines: string[] = [];
  const n = motos.length;
  if (mode === "nouvelle") {
    lines.push(
      `🆕 Nouveautés ! ${n} moto${n > 1 ? "s" : ""} fraîchement arrivée${n > 1 ? "s" : ""} en stock :`,
    );
  } else if (mode === "ancienne") {
    lines.push(
      `⏳ Offre spéciale sur ${n} moto${n > 1 ? "s" : ""} en stock depuis un moment, à saisir vite :`,
    );
  } else {
    lines.push(
      `🔥 Sélection du jour : ${n} moto${n > 1 ? "s" : ""} disponible${n > 1 ? "s" : ""} chez nous :`,
    );
  }

  const MAX_ITEM_LINES = 7; // header(1) + items(<=7) + note(<=1) + CTA(1) = <=10
  const shown = motos.slice(0, MAX_ITEM_LINES);
  for (const m of shown) {
    const nom = [m.marque, m.modele].filter(Boolean).join(" ") || "Moto";
    const etat = m.etat ? ` (${m.etat})` : "";
    const prix = m.prix_vente
      ? ` — ${m.prix_vente.toLocaleString("fr-FR")} FCFA`
      : "";
    lines.push(`• ${nom}${etat}${prix}`);
  }
  const remaining = n - shown.length;
  if (remaining > 0) {
    lines.push(
      `… et ${remaining} autre${remaining > 1 ? "s" : ""} modèle${remaining > 1 ? "s" : ""} disponible${remaining > 1 ? "s" : ""} !`,
    );
  }
  lines.push("📲 Contactez-nous vite, stock limité !");
  return lines.slice(0, 10).join("\n");
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Il y a ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `Il y a ${days}j`;
  return new Date(dateStr).toLocaleDateString("fr-FR");
}

function isPublicationScheduled(pub: Publication): boolean {
  return (
    !!pub.scheduled_at && new Date(pub.scheduled_at).getTime() > Date.now()
  );
}

function formatScheduleLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()} à ${hh}:${min}`;
}

function formatDateInput(t: string): string {
  let v = t.replace(/[^0-9]/g, "");
  if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2);
  if (v.length > 5) v = v.slice(0, 5) + "/" + v.slice(5);
  return v.slice(0, 10);
}

function formatTimeInput(t: string): string {
  let v = t.replace(/[^0-9]/g, "");
  if (v.length > 2) v = v.slice(0, 2) + ":" + v.slice(2);
  return v.slice(0, 5);
}

// Renvoie une heure par défaut (+1h) au format JJ/MM/AAAA + HH:MM
function defaultScheduleValues(): { date: string; time: string } {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 60);
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return { date: `${dd}/${mm}/${now.getFullYear()}`, time: `${hh}:${min}` };
}

// Parse "JJ/MM/AAAA" + "HH:MM" en Date locale, ou null si invalide
function parseScheduledDateTime(dateStr: string, timeStr: string): Date | null {
  const dateMatch = dateStr.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!dateMatch) return null;
  const day = parseInt(dateMatch[1], 10);
  const month = parseInt(dateMatch[2], 10);
  const year = parseInt(dateMatch[3], 10);

  let hour = 0;
  let minute = 0;
  const timeTrimmed = timeStr.trim();
  if (timeTrimmed) {
    const timeMatch = timeTrimmed.match(/^(\d{1,2}):(\d{2})$/);
    if (!timeMatch) return null;
    hour = parseInt(timeMatch[1], 10);
    minute = parseInt(timeMatch[2], 10);
  }

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59
  )
    return null;

  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    date.getDate() !== day ||
    date.getMonth() !== month - 1 ||
    date.getFullYear() !== year
  ) {
    return null; // ex : 31/02 qui déborde sur mars
  }
  return date;
}

/**
 * Upload d'une vidéo de publication via la tâche native expo-file-system
 * (createUploadTask), pas fetch/FormData — voir le commentaire dans
 * handleSave pour le pourquoi. Les champs texte du formulaire passent en
 * `parameters` (multipart), avec la notation `champ[i]` pour les tableaux
 * (convention PHP standard, reconstituée par Laravel comme un vrai tableau).
 */
async function uploadVideoPublication(
  texte: string,
  videoUri: string,
  selectedPlatforms: string[],
  scheduledAt: string | null,
  enterpriseId: string,
): Promise<Publication> {
  const ext = videoUri.split(".").pop()?.toLowerCase().split("?")[0] || "mp4";
  const mimeType = ext === "mov" ? "video/quicktime" : "video/mp4";
  const token = await getToken();

  const parameters: Record<string, string> = { enterprise_id: enterpriseId };
  if (texte.trim()) parameters.texte = texte.trim();
  selectedPlatforms.forEach((p, i) => {
    parameters[`selected_platforms[${i}]`] = p;
  });
  if (scheduledAt) parameters.scheduled_at = scheduledAt;

  const file = new File(videoUri);
  const task = file.createUploadTask(api.publicationsUploadUrl(), {
    httpMethod: "POST",
    uploadType: UploadType.MULTIPART,
    fieldName: "video",
    mimeType,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    parameters,
  });

  const result = await task.uploadAsync();
  if (!result) throw new Error("Échec de l'envoi de la vidéo.");
  if (result.status < 200 || result.status >= 300) {
    let message = `Erreur HTTP ${result.status}`;
    try {
      const data = JSON.parse(result.body);
      if (data?.message) message = data.message;
    } catch {
      // corps non-JSON : on garde le message générique
    }
    throw new Error(message);
  }
  return JSON.parse(result.body);
}

function AdminPublicationsContent() {
  const { theme } = useTheme();
  const { publication_id } = useLocalSearchParams<{
    publication_id?: string;
  }>();
  const { tenant } = useTenant();
  const { isFeatureEnabled } = useFeatureFlags();
  const autoGenEnabled = isFeatureEnabled("publications.auto");
  const scheduleEnabled = isFeatureEnabled("publications.programmation");
  const fbEnabled = isFeatureEnabled("publications.facebook");
  const tiktokEnabled = isFeatureEnabled("publications.tiktok");
  const [publications, setPublications] = useState<Publication[]>([]);
  const [tiktokStatus, setTiktokStatus] = useState<
    Record<string, TikTokStatus>
  >({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [publishingFbId, setPublishingFbId] = useState<string | null>(null);
  const [publishingTiktokId, setPublishingTiktokId] = useState<string | null>(
    null,
  );
  const [fbConnected, setFbConnected] = useState(false);
  const [tiktokConnected, setTiktokConnected] = useState(false);

  // Form state
  const [formText, setFormText] = useState("");
  const [formImages, setFormImages] = useState<string[]>([]);
  const [formVideo, setFormVideo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>(
    [],
  );
  const [autoSelectedPlatforms, setAutoSelectedPlatforms] = useState<
    SocialPlatform[]
  >([]);

  // Programmation (publication manuelle)
  const [publishMode, setPublishMode] = useState<PublishMode>("now");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");

  // Auto-génération
  const [showAutoModal, setShowAutoModal] = useState(false);
  const [autoCountInput, setAutoCountInput] = useState("");
  const [autoMode, setAutoMode] = useState<AutoMode>("aleatoire");
  const [autoGenerating, setAutoGenerating] = useState(false);

  // Programmation (génération automatique)
  const [autoPublishMode, setAutoPublishMode] = useState<PublishMode>("now");
  const [autoScheduleDate, setAutoScheduleDate] = useState("");
  const [autoScheduleTime, setAutoScheduleTime] = useState("");

  const fetchPublications = useCallback(async () => {
    if (!tenant?.enterprise_id) {
      setLoading(false);
      return;
    }
    try {
      const result = await api.listPublications(tenant.enterprise_id);
      const pubs = (result?.data ?? result ?? []) as Publication[];
      setPublications(pubs);
      if (
        publication_id &&
        pubs.some((publication) => publication.id === publication_id)
      ) {
        setExpandedIds((previous) => new Set(previous).add(publication_id));
      }

      const statusMap: Record<string, TikTokStatus> = {};
      pubs.forEach((p) => {
        const tk = p.platform_statuses?.find((s) => s.platform === "tiktok");
        if (tk) {
          statusMap[p.id] = {
            external_post_id: tk.external_post_id,
            status: tk.status,
            error_message: tk.error_message,
          };
        }
      });
      setTiktokStatus(statusMap);
    } catch (e: any) {
      Alert.alert(
        "Erreur",
        e.message || "Impossible de charger les publications.",
      );
    }
    setLoading(false);
  }, [publication_id, tenant]);

  const fetchConnections = useCallback(async () => {
    if (!tenant?.enterprise_id) return;
    try {
      const connections = await api.listSocialConnections(tenant.enterprise_id);
      setFbConnected(!!connections?.facebook);
      setTiktokConnected(!!connections?.tiktok);
    } catch {
      // Non bloquant : l'écran reste utilisable sans les boutons de connexion.
    }
  }, [tenant]);

  useFocusEffect(
    useCallback(() => {
      fetchPublications();
      fetchConnections();
    }, [fetchPublications, fetchConnections]),
  );

  const togglePlatform = (
    platform: SocialPlatform,
    setter: React.Dispatch<React.SetStateAction<SocialPlatform[]>>,
  ) => {
    setter((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform],
    );
  };

  // Construit un message récapitulatif "Facebook : publié ✓ / erreur" à partir
  // d'une publication fraîchement créée (le serveur a déjà tenté la diffusion
  // immédiate de façon synchrone, pas besoin d'un second appel réseau).
  const summarizeDispatchResults = (
    pub: Publication,
    platforms: SocialPlatform[],
  ): string[] => {
    return platforms.map((platform) => {
      const label = platform === "facebook" ? "Facebook" : "TikTok";
      if (platform === "facebook") {
        return pub.fb_publish_status === "published"
          ? `${label} : publié ✓`
          : `${label} : ${pub.fb_publish_error || "échec de la publication."}`;
      }
      const status = pub.platform_statuses?.find(
        (s) => s.platform === "tiktok",
      );
      return status?.status === "published"
        ? `${label} : publié ✓`
        : `${label} : ${status?.error_message || "échec de la publication."}`;
    });
  };

  const handlePickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      return Alert.alert("Permission refusée", "Accès galerie refusé.");
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.6,
    });
    if (result.canceled || !result.assets) return;
    setFormVideo(null); // une publication est soit images, soit vidéo, jamais les deux
    setFormImages((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
  };

  const handlePickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      return Alert.alert("Permission refusée", "Accès galerie refusé.");
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: 90,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setFormImages([]); // une publication est soit images, soit vidéo, jamais les deux
    setFormVideo(result.assets[0].uri);
  };

  const handleRecordVideo = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      return Alert.alert("Permission refusée", "Accès caméra refusé.");
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: 90,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setFormImages([]);
    setFormVideo(result.assets[0].uri);
  };

  const handleSave = async () => {
    if (!formText.trim() && formImages.length === 0 && !formVideo) {
      return Alert.alert(
        "Publication vide",
        "Ajoutez du texte, des images ou une vidéo.",
      );
    }
    if (!tenant?.enterprise_id) return;

    let scheduledAt: string | null = null;
    if (scheduleEnabled && publishMode === "schedule") {
      const parsed = parseScheduledDateTime(scheduleDate, scheduleTime);
      if (!parsed) {
        return Alert.alert(
          "Date invalide",
          "Vérifiez la date (JJ/MM/AAAA) et l'heure (HH:MM) de programmation.",
        );
      }
      if (parsed.getTime() <= Date.now()) {
        return Alert.alert(
          "Date passée",
          "Choisissez une date et une heure dans le futur.",
        );
      }
      scheduledAt = parsed.toISOString();
    }

    setSaving(true);
    try {
      let created: Publication;
      if (formVideo) {
        // Upload natif (expo-file-system), pas fetch/FormData : expo/fetch
        // (WinterCG, installé par défaut par Expo) ne supporte pas la
        // convention RN {uri, name, type} pour les fichiers et lève
        // "Unsupported FormDataPart implementation" — l'upload natif
        // contourne complètement cette histoire d'implémentation fetch.
        created = await uploadVideoPublication(
          formText,
          formVideo,
          selectedPlatforms,
          scheduledAt,
          tenant.enterprise_id,
        );
      } else {
        const form = new FormData();
        form.append("enterprise_id", tenant.enterprise_id);
        if (formText.trim()) form.append("texte", formText.trim());
        formImages.forEach((uri, i) => {
          form.append("images[]", localUriToFormFile(uri, `pub_${i}`) as any);
        });
        selectedPlatforms.forEach((p) =>
          form.append("selected_platforms[]", p),
        );
        if (scheduledAt) form.append("scheduled_at", scheduledAt);
        created = await api.createPublication(form);
      }
      const platformsToPush = selectedPlatforms;
      resetForm();
      fetchPublications();
      if (publishMode === "now" && platformsToPush.length > 0) {
        Alert.alert(
          "Diffusion sur les réseaux",
          summarizeDispatchResults(created, platformsToPush).join("\n"),
        );
      }
    } catch (e: any) {
      Alert.alert("Erreur", e.message || "Échec de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const handlePublishNow = (pub: Publication) => {
    Alert.alert(
      "Publier maintenant",
      "Rendre cette publication visible immédiatement sur le fil d'actualité ?",
      [
        { text: "Annuler" },
        {
          text: "Publier",
          onPress: async () => {
            try {
              await api.updatePublication(pub.id, { scheduled_at: null });
            } catch (e: any) {
              Alert.alert("Erreur", e.message);
            }
            fetchPublications();
          },
        },
      ],
    );
  };

  const handlePublishToFacebook = (pub: Publication) => {
    Alert.alert(
      "Publier sur Facebook",
      "Publier ce contenu sur la Page Facebook de l'entreprise ?",
      [
        { text: "Annuler" },
        {
          text: "Publier",
          onPress: async () => {
            setPublishingFbId(pub.id);
            try {
              const updated: Publication =
                await api.publishPublicationToPlatform(pub.id, "facebook");
              if (updated.fb_publish_status === "error") {
                Alert.alert(
                  "Erreur",
                  updated.fb_publish_error ||
                    "Échec de la publication Facebook.",
                );
              }
            } catch (e: any) {
              Alert.alert("Erreur", e.message);
            }
            setPublishingFbId(null);
            fetchPublications();
          },
        },
      ],
    );
  };

  const handlePublishToTikTok = (pub: Publication) => {
    Alert.alert(
      "Publier sur TikTok",
      "Publier ce contenu sur le compte TikTok de l'entreprise ?",
      [
        { text: "Annuler" },
        {
          text: "Publier",
          onPress: async () => {
            setPublishingTiktokId(pub.id);
            try {
              const updated: Publication =
                await api.publishPublicationToPlatform(pub.id, "tiktok");
              const status = updated.platform_statuses?.find(
                (s) => s.platform === "tiktok",
              );
              if (status?.status === "error") {
                Alert.alert(
                  "Erreur",
                  status.error_message || "Échec de la publication TikTok.",
                );
              }
            } catch (e: any) {
              Alert.alert("Erreur", e.message);
            }
            setPublishingTiktokId(null);
            fetchPublications();
          },
        },
      ],
    );
  };

  const handleDelete = (pub: Publication) => {
    Alert.alert("Supprimer", "Supprimer cette publication ?", [
      { text: "Annuler" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            await api.deletePublication(pub.id);
          } catch (e: any) {
            Alert.alert("Erreur", e.message);
          }
          fetchPublications();
        },
      },
    ]);
  };

  const resetForm = () => {
    setFormText("");
    setFormImages([]);
    setFormVideo(null);
    setPublishMode("now");
    setScheduleDate("");
    setScheduleTime("");
    setSelectedPlatforms([]);
    setShowCreate(false);
  };

  const resetAutoForm = () => {
    setAutoCountInput("");
    setAutoMode("aleatoire");
    setAutoPublishMode("now");
    setAutoScheduleDate("");
    setAutoScheduleTime("");
    setAutoSelectedPlatforms([]);
    setShowAutoModal(false);
  };

  const handleAutoGenerate = async () => {
    if (!tenant?.enterprise_id || !autoGenEnabled) return;

    let scheduledAt: string | null = null;
    if (scheduleEnabled && autoPublishMode === "schedule") {
      const parsedSchedule = parseScheduledDateTime(
        autoScheduleDate,
        autoScheduleTime,
      );
      if (!parsedSchedule) {
        return Alert.alert(
          "Date invalide",
          "Vérifiez la date (JJ/MM/AAAA) et l'heure (HH:MM) de programmation.",
        );
      }
      if (parsedSchedule.getTime() <= Date.now()) {
        return Alert.alert(
          "Date passée",
          "Choisissez une date et une heure dans le futur.",
        );
      }
      scheduledAt = parsedSchedule.toISOString();
    }

    const parsed = parseInt(autoCountInput, 10);
    const count =
      Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 30) : 6;

    setAutoGenerating(true);

    let motos: MotoLite[];
    try {
      const result = await api.listMyMotos({
        enterprise_id: tenant.enterprise_id,
        per_page: 1000,
      });
      const all = ((result?.data ?? result ?? []) as MotoLite[]).filter(
        (m) => m.statut !== "vendu",
      );
      // Le serveur trie toujours par date de création décroissante (plus
      // récentes d'abord) : on inverse pour "ancienne", on tire au sort pour
      // "aleatoire", on tranche directement pour "nouvelle".
      if (autoMode === "nouvelle") {
        motos = all.slice(0, count);
      } else if (autoMode === "ancienne") {
        motos = all.slice().reverse().slice(0, count);
      } else {
        motos = shuffle(all).slice(0, count);
      }
    } catch (e: any) {
      setAutoGenerating(false);
      return Alert.alert("Erreur", e.message);
    }
    setAutoGenerating(false);

    if (motos.length === 0) {
      return Alert.alert(
        "Aucune moto disponible",
        "Aucune moto en stock ne correspond à ces critères pour générer une publicité.",
      );
    }

    const texte = buildPromoText(motos, autoMode);
    const images = motos
      .map((m) => {
        const imgs = m.images || [];
        return (imgs.find((im) => im.is_principal) || imgs[0])?.image_uri;
      })
      .filter((uri): uri is string => !!uri);

    const form = new FormData();
    form.append("enterprise_id", tenant.enterprise_id);
    form.append("texte", texte);
    images.forEach((url) => form.append("source_images[]", url));
    autoSelectedPlatforms.forEach((p) =>
      form.append("selected_platforms[]", p),
    );
    form.append("is_auto_generated", "1");
    if (scheduledAt) form.append("scheduled_at", scheduledAt);

    setSaving(true);
    try {
      const created: Publication = await api.createPublication(form);
      const platformsToPush = autoSelectedPlatforms;
      resetAutoForm();
      fetchPublications();
      if (autoPublishMode === "now" && platformsToPush.length > 0) {
        Alert.alert(
          "Diffusion sur les réseaux",
          summarizeDispatchResults(created, platformsToPush).join("\n"),
        );
      }
    } catch (e: any) {
      Alert.alert("Erreur", e.message || "Échec de la génération.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.card, borderBottomColor: theme.border },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={[styles.headerTitle, { color: theme.text }]}
            numberOfLines={1}
          >
            Publications
          </Text>
          <Text
            style={[styles.headerSub, { color: theme.subText }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Visibles publiquement dans le fil d'actualité
          </Text>
        </View>
        <View style={styles.headerBtns}>
          {fbEnabled && (
            <TouchableOpacity
              style={[
                styles.newBtn,
                {
                  backgroundColor: theme.card,
                  borderWidth: 1,
                  borderColor: "#1877F2",
                  paddingHorizontal: 8,
                },
              ]}
              onPress={() => router.push("/admin/facebook")}
            >
              <Ionicons name="logo-facebook" size={16} color="#1877F2" />
            </TouchableOpacity>
          )}
          {tiktokEnabled && (
            <TouchableOpacity
              style={[
                styles.newBtn,
                {
                  backgroundColor: theme.card,
                  borderWidth: 1,
                  borderColor: "#000000",
                  paddingHorizontal: 8,
                },
              ]}
              onPress={() => router.push("/admin/tiktok")}
            >
              <Ionicons name="logo-tiktok" size={16} color={theme.text} />
            </TouchableOpacity>
          )}
          {autoGenEnabled && (
            <TouchableOpacity
              style={[
                styles.newBtn,
                {
                  backgroundColor: theme.card,
                  borderWidth: 1,
                  borderColor: theme.primary,
                },
              ]}
              onPress={() => setShowAutoModal(true)}
            >
              <Ionicons name="sparkles" size={16} color={theme.primary} />
              <Text style={[styles.newBtnText, { color: theme.primary }]}>
                Auto
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.newBtn, { backgroundColor: theme.primary }]}
            onPress={() => setShowCreate(true)}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.newBtnText}>Nouveau</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={theme.primary} />
      ) : (
        <FlatList
          data={publications}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons
                name="megaphone-outline"
                size={64}
                color={theme.border}
              />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                Aucune publication
              </Text>
              <Text style={[styles.emptyText, { color: theme.subText }]}>
                Appuyez sur « Nouveau » pour créer votre première publication.
                {"\n"}Elle sera visible par tous vos clients.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const scheduled = isPublicationScheduled(item);
            return (
              <View
                style={[
                  styles.pubCard,
                  {
                    backgroundColor: theme.card,
                    borderColor: scheduled ? "#FF9500" : theme.border,
                  },
                  scheduled && styles.pubCardScheduled,
                ]}
              >
                {/* Card header */}
                <View style={styles.pubCardHeader}>
                  <Ionicons
                    name={scheduled ? "alarm-outline" : "megaphone-outline"}
                    size={15}
                    color={scheduled ? "#FF9500" : theme.primary}
                  />
                  <Text
                    style={[
                      styles.pubDate,
                      { color: scheduled ? "#FF9500" : theme.subText },
                    ]}
                  >
                    {scheduled
                      ? `Programmée · ${formatScheduleLabel(item.scheduled_at!)}`
                      : timeAgo(item.created_at)}
                  </Text>
                  {scheduled && (
                    <TouchableOpacity
                      onPress={() => handlePublishNow(item)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{ marginRight: 4 }}
                    >
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={20}
                        color={theme.primary}
                      />
                    </TouchableOpacity>
                  )}
                  {fbEnabled && (
                    <>
                      {publishingFbId === item.id ? (
                        <ActivityIndicator
                          size="small"
                          color="#1877F2"
                          style={{ marginRight: 4 }}
                        />
                      ) : item.fb_publish_status === "published" ? (
                        <TouchableOpacity
                          onPress={() =>
                            item.fb_post_id &&
                            Linking.openURL(
                              `https://facebook.com/${item.fb_post_id}`,
                            )
                          }
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={{ marginRight: 4 }}
                        >
                          <Ionicons
                            name="checkmark-circle"
                            size={18}
                            color="#34C759"
                          />
                        </TouchableOpacity>
                      ) : item.fb_publish_status === "error" ? (
                        <TouchableOpacity
                          onPress={() =>
                            Alert.alert(
                              "Erreur Facebook",
                              item.fb_publish_error ??
                                "Échec de la publication.",
                            )
                          }
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={{ marginRight: 4 }}
                        >
                          <Ionicons
                            name="alert-circle"
                            size={18}
                            color="#FF3B30"
                          />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          onPress={() => handlePublishToFacebook(item)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={{ marginRight: 4 }}
                        >
                          <Ionicons
                            name="logo-facebook"
                            size={18}
                            color="#1877F2"
                          />
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                  {tiktokEnabled && (
                    <>
                      {publishingTiktokId === item.id ? (
                        <ActivityIndicator
                          size="small"
                          color={theme.text}
                          style={{ marginRight: 4 }}
                        />
                      ) : tiktokStatus[item.id]?.status === "published" ? (
                        <TouchableOpacity
                          onPress={() =>
                            Alert.alert(
                              "Publié sur TikTok",
                              "Cette publication a été poussée sur le compte TikTok connecté.",
                            )
                          }
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={{ marginRight: 4 }}
                        >
                          <Ionicons
                            name="checkmark-circle"
                            size={18}
                            color="#34C759"
                          />
                        </TouchableOpacity>
                      ) : tiktokStatus[item.id]?.status === "error" ? (
                        <TouchableOpacity
                          onPress={() =>
                            Alert.alert(
                              "Erreur TikTok",
                              tiktokStatus[item.id]?.error_message ??
                                "Échec de la publication.",
                            )
                          }
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={{ marginRight: 4 }}
                        >
                          <Ionicons
                            name="alert-circle"
                            size={18}
                            color="#FF3B30"
                          />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          onPress={() => handlePublishToTikTok(item)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={{ marginRight: 4 }}
                        >
                          <Ionicons
                            name="logo-tiktok"
                            size={18}
                            color={theme.text}
                          />
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                  <TouchableOpacity
                    onPress={() => handleDelete(item)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                  </TouchableOpacity>
                </View>

                {/* Text */}
                {item.texte ? (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() =>
                      setExpandedIds((prev) => {
                        const next = new Set(prev);
                        next.has(item.id)
                          ? next.delete(item.id)
                          : next.add(item.id);
                        return next;
                      })
                    }
                  >
                    <Text
                      style={[styles.pubText, { color: theme.text }]}
                      numberOfLines={expandedIds.has(item.id) ? undefined : 3}
                    >
                      {item.texte}
                    </Text>
                    {!expandedIds.has(item.id) && item.texte.length > 120 ? (
                      <Text style={[styles.seeMore, { color: theme.primary }]}>
                        Voir plus
                      </Text>
                    ) : expandedIds.has(item.id) ? (
                      <Text style={[styles.seeMore, { color: theme.primary }]}>
                        Voir moins
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                ) : null}

                {/* Vidéo ou vignettes images */}
                {item.video_url ? (
                  <VideoThumb uri={item.video_url} style={styles.videoThumb} />
                ) : item.image_urls && item.image_urls.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.thumbRow}
                  >
                    {item.image_urls.map((img, i) => (
                      <Image
                        key={i}
                        source={{ uri: img }}
                        style={styles.thumb}
                      />
                    ))}
                  </ScrollView>
                ) : null}

                <Text style={[styles.imgCount, { color: theme.subText }]}>
                  {item.video_url
                    ? "1 vidéo"
                    : `${item.image_urls?.length ?? 0} image${(item.image_urls?.length ?? 0) !== 1 ? "s" : ""}`}
                </Text>
              </View>
            );
          }}
        />
      )}

      {/* ── Modal de création ───────────────────────────────────────────────── */}
      <Modal
        visible={showCreate}
        animationType="slide"
        onRequestClose={resetForm}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={[styles.createContainer, { backgroundColor: theme.bg }]}>
            {/* Header */}
            <View
              style={[
                styles.createHeader,
                {
                  backgroundColor: theme.card,
                  borderBottomColor: theme.border,
                },
              ]}
            >
              <TouchableOpacity onPress={resetForm}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
              <Text style={[styles.createTitle, { color: theme.text }]}>
                Nouvelle publication
              </Text>
              <TouchableOpacity
                style={[
                  styles.publishBtn,
                  { backgroundColor: saving ? theme.border : theme.primary },
                ]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.publishBtnText}>
                    {publishMode === "schedule" ? "Programmer" : "Publier"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.createContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Zone de texte */}
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.card,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                placeholder="Quoi de neuf ? Partagez une offre, une info, un modèle disponible…"
                placeholderTextColor={theme.subText}
                multiline
                value={formText}
                onChangeText={setFormText}
                textAlignVertical="top"
              />

              {/* Prévisualisation des images sélectionnées */}
              {formImages.length > 0 ? (
                <View style={styles.previewGrid}>
                  {formImages.map((img, i) => (
                    <View key={i} style={styles.previewWrap}>
                      <Image source={{ uri: img }} style={styles.previewImg} />
                      <TouchableOpacity
                        style={styles.removeImgBtn}
                        onPress={() =>
                          setFormImages((prev) =>
                            prev.filter((_, idx) => idx !== i),
                          )
                        }
                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      >
                        <Ionicons
                          name="close-circle"
                          size={22}
                          color="#FF3B30"
                        />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Prévisualisation de la vidéo sélectionnée */}
              {formVideo ? (
                <View style={[styles.previewWrap, { marginBottom: 16 }]}>
                  <VideoThumb uri={formVideo} style={styles.videoPreview} />
                  <TouchableOpacity
                    style={styles.removeImgBtn}
                    onPress={() => setFormVideo(null)}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  >
                    <Ionicons name="close-circle" size={22} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              ) : null}

              {/* Boutons ajout média : images XOR vidéo */}
              {formVideo ? null : (
                <TouchableOpacity
                  style={[styles.addImgBtn, { borderColor: theme.primary }]}
                  onPress={handlePickImages}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name="images-outline"
                    size={20}
                    color={theme.primary}
                  />
                  <Text style={[styles.addImgText, { color: theme.primary }]}>
                    Ajouter des photos
                  </Text>
                </TouchableOpacity>
              )}

              {formImages.length === 0 && (
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TouchableOpacity
                    style={[
                      styles.addImgBtn,
                      { borderColor: theme.primary, flex: 1 },
                    ]}
                    onPress={handlePickVideo}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name="videocam-outline"
                      size={20}
                      color={theme.primary}
                    />
                    <Text style={[styles.addImgText, { color: theme.primary }]}>
                      Ajouter une vidéo
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.addImgBtn,
                      { borderColor: theme.primary, flex: 1 },
                    ]}
                    onPress={handleRecordVideo}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name="radio-button-on-outline"
                      size={20}
                      color={theme.primary}
                    />
                    <Text style={[styles.addImgText, { color: theme.primary }]}>
                      Filmer un reel
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Publier aussi sur les réseaux connectés */}
              {(fbConnected || tiktokConnected) && (
                <View
                  style={[
                    styles.scheduleBox,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                >
                  <Text style={[styles.scheduleTitle, { color: theme.text }]}>
                    Publier aussi sur
                  </Text>
                  <View style={styles.autoModeRow}>
                    {fbConnected && (
                      <TouchableOpacity
                        style={[
                          styles.autoModeChip,
                          {
                            borderColor: selectedPlatforms.includes("facebook")
                              ? "#1877F2"
                              : theme.border,
                            backgroundColor: selectedPlatforms.includes(
                              "facebook",
                            )
                              ? "#1877F2"
                              : "transparent",
                            flexDirection: "row",
                            gap: 6,
                          },
                        ]}
                        onPress={() =>
                          togglePlatform("facebook", setSelectedPlatforms)
                        }
                      >
                        <Ionicons
                          name="logo-facebook"
                          size={14}
                          color={
                            selectedPlatforms.includes("facebook")
                              ? "#fff"
                              : theme.text
                          }
                        />
                        <Text
                          style={[
                            styles.autoModeChipText,
                            {
                              color: selectedPlatforms.includes("facebook")
                                ? "#fff"
                                : theme.text,
                            },
                          ]}
                        >
                          Facebook
                        </Text>
                      </TouchableOpacity>
                    )}
                    {tiktokConnected && (
                      <TouchableOpacity
                        style={[
                          styles.autoModeChip,
                          {
                            borderColor: selectedPlatforms.includes("tiktok")
                              ? theme.text
                              : theme.border,
                            backgroundColor: selectedPlatforms.includes(
                              "tiktok",
                            )
                              ? theme.text
                              : "transparent",
                            flexDirection: "row",
                            gap: 6,
                          },
                        ]}
                        onPress={() =>
                          togglePlatform("tiktok", setSelectedPlatforms)
                        }
                      >
                        <Ionicons
                          name="logo-tiktok"
                          size={14}
                          color={
                            selectedPlatforms.includes("tiktok")
                              ? theme.bg
                              : theme.text
                          }
                        />
                        <Text
                          style={[
                            styles.autoModeChipText,
                            {
                              color: selectedPlatforms.includes("tiktok")
                                ? theme.bg
                                : theme.text,
                            },
                          ]}
                        >
                          TikTok
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={[styles.autoHint, { color: theme.subText }]}>
                    Sélectionnez les réseaux sur lesquels diffuser cette
                    publication en même temps que sur SenMoto. Vous pourrez
                    aussi le faire plus tard depuis la liste.
                  </Text>
                </View>
              )}

              {/* Programmation */}
              {scheduleEnabled && (
                <View
                  style={[
                    styles.scheduleBox,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                >
                  <Text style={[styles.scheduleTitle, { color: theme.text }]}>
                    Quand publier ?
                  </Text>
                  <View style={styles.scheduleModeRow}>
                    <TouchableOpacity
                      style={[
                        styles.scheduleModeChip,
                        {
                          borderColor:
                            publishMode === "now"
                              ? theme.primary
                              : theme.border,
                          backgroundColor:
                            publishMode === "now"
                              ? theme.primary
                              : "transparent",
                        },
                      ]}
                      onPress={() => setPublishMode("now")}
                    >
                      <Ionicons
                        name="flash-outline"
                        size={14}
                        color={publishMode === "now" ? "#fff" : theme.text}
                      />
                      <Text
                        style={[
                          styles.scheduleModeChipText,
                          {
                            color: publishMode === "now" ? "#fff" : theme.text,
                          },
                        ]}
                      >
                        Maintenant
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.scheduleModeChip,
                        {
                          borderColor:
                            publishMode === "schedule"
                              ? theme.primary
                              : theme.border,
                          backgroundColor:
                            publishMode === "schedule"
                              ? theme.primary
                              : "transparent",
                        },
                      ]}
                      onPress={() => {
                        setPublishMode("schedule");
                        if (!scheduleDate && !scheduleTime) {
                          const d = defaultScheduleValues();
                          setScheduleDate(d.date);
                          setScheduleTime(d.time);
                        }
                      }}
                    >
                      <Ionicons
                        name="alarm-outline"
                        size={14}
                        color={publishMode === "schedule" ? "#fff" : theme.text}
                      />
                      <Text
                        style={[
                          styles.scheduleModeChipText,
                          {
                            color:
                              publishMode === "schedule" ? "#fff" : theme.text,
                          },
                        ]}
                      >
                        Programmer
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {publishMode === "schedule" && (
                    <View
                      style={{ flexDirection: "row", gap: 10, marginTop: 12 }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.scheduleLabel,
                            { color: theme.subText },
                          ]}
                        >
                          Date (JJ/MM/AAAA)
                        </Text>
                        <TextInput
                          style={[
                            styles.scheduleInput,
                            {
                              backgroundColor: theme.bg,
                              color: theme.text,
                              borderColor: theme.border,
                            },
                          ]}
                          placeholder="31/12/2026"
                          placeholderTextColor={theme.subText}
                          keyboardType="numeric"
                          maxLength={10}
                          value={scheduleDate}
                          onChangeText={(t) =>
                            setScheduleDate(formatDateInput(t))
                          }
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.scheduleLabel,
                            { color: theme.subText },
                          ]}
                        >
                          Heure (HH:MM)
                        </Text>
                        <TextInput
                          style={[
                            styles.scheduleInput,
                            {
                              backgroundColor: theme.bg,
                              color: theme.text,
                              borderColor: theme.border,
                            },
                          ]}
                          placeholder="14:00"
                          placeholderTextColor={theme.subText}
                          keyboardType="numeric"
                          maxLength={5}
                          value={scheduleTime}
                          onChangeText={(t) =>
                            setScheduleTime(formatTimeInput(t))
                          }
                        />
                      </View>
                    </View>
                  )}

                  {publishMode === "schedule" && (
                    <Text
                      style={[styles.scheduleHint, { color: theme.subText }]}
                    >
                      La publication restera masquée puis deviendra
                      automatiquement visible dans le fil d'actualité à la date
                      et l'heure choisies.
                    </Text>
                  )}
                </View>
              )}

              {/* Info */}
              <View
                style={[
                  styles.infoBox,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Ionicons
                  name="information-circle-outline"
                  size={16}
                  color={theme.primary}
                />
                <Text style={[styles.infoText, { color: theme.subText }]}>
                  Cette publication sera visible par tous les utilisateurs du
                  catalogue dans le fil d'actualité. Vos contacts (téléphone,
                  WhatsApp…) restent ceux définis dans{" "}
                  <Text style={{ fontWeight: "700" }}>Contacts</Text>.
                </Text>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal de génération automatique ─────────────────────────────────── */}
      <Modal
        visible={showAutoModal}
        animationType="slide"
        transparent
        onRequestClose={resetAutoForm}
      >
        <View style={styles.autoOverlay}>
          <View style={[styles.autoSheet, { backgroundColor: theme.card }]}>
            <View style={styles.autoHeader}>
              <Text style={[styles.createTitle, { color: theme.text }]}>
                Publication automatique
              </Text>
              <TouchableOpacity onPress={resetAutoForm}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.autoLabel, { color: theme.subText }]}>
              Nombre de motos (par défaut : 6)
            </Text>
            <TextInput
              style={[
                styles.autoInput,
                {
                  backgroundColor: theme.bg,
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
              placeholder="Ex : 7"
              placeholderTextColor={theme.subText}
              keyboardType="number-pad"
              value={autoCountInput}
              onChangeText={setAutoCountInput}
            />

            <Text
              style={[
                styles.autoLabel,
                { color: theme.subText, marginTop: 14 },
              ]}
            >
              Motos à mettre en avant
            </Text>
            <View style={styles.autoModeRow}>
              {(
                [
                  { key: "aleatoire", label: "Aléatoire" },
                  { key: "nouvelle", label: "Nouvelles" },
                  { key: "ancienne", label: "Anciennes" },
                ] as { key: AutoMode; label: string }[]
              ).map((opt) => {
                const active = autoMode === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.autoModeChip,
                      {
                        borderColor: active ? theme.primary : theme.border,
                        backgroundColor: active ? theme.primary : "transparent",
                      },
                    ]}
                    onPress={() => setAutoMode(opt.key)}
                  >
                    <Text
                      style={[
                        styles.autoModeChipText,
                        { color: active ? "#fff" : theme.text },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.autoHint, { color: theme.subText }]}>
              « Nouvelles » sélectionne les motos les plus récemment
              enregistrées, « Anciennes » celles en stock depuis le plus
              longtemps (non vendues). Un texte promotionnel est généré
              automatiquement.
            </Text>

            {(fbConnected || tiktokConnected) && (
              <View
                style={[
                  styles.scheduleBox,
                  {
                    backgroundColor: theme.bg,
                    borderColor: theme.border,
                    marginTop: 14,
                  },
                ]}
              >
                <Text style={[styles.scheduleTitle, { color: theme.text }]}>
                  Publier aussi sur
                </Text>
                <View style={styles.autoModeRow}>
                  {fbConnected && (
                    <TouchableOpacity
                      style={[
                        styles.autoModeChip,
                        {
                          borderColor: autoSelectedPlatforms.includes(
                            "facebook",
                          )
                            ? "#1877F2"
                            : theme.border,
                          backgroundColor: autoSelectedPlatforms.includes(
                            "facebook",
                          )
                            ? "#1877F2"
                            : "transparent",
                          flexDirection: "row",
                          gap: 6,
                        },
                      ]}
                      onPress={() =>
                        togglePlatform("facebook", setAutoSelectedPlatforms)
                      }
                    >
                      <Ionicons
                        name="logo-facebook"
                        size={14}
                        color={
                          autoSelectedPlatforms.includes("facebook")
                            ? "#fff"
                            : theme.text
                        }
                      />
                      <Text
                        style={[
                          styles.autoModeChipText,
                          {
                            color: autoSelectedPlatforms.includes("facebook")
                              ? "#fff"
                              : theme.text,
                          },
                        ]}
                      >
                        Facebook
                      </Text>
                    </TouchableOpacity>
                  )}
                  {tiktokConnected && (
                    <TouchableOpacity
                      style={[
                        styles.autoModeChip,
                        {
                          borderColor: autoSelectedPlatforms.includes("tiktok")
                            ? theme.text
                            : theme.border,
                          backgroundColor: autoSelectedPlatforms.includes(
                            "tiktok",
                          )
                            ? theme.text
                            : "transparent",
                          flexDirection: "row",
                          gap: 6,
                        },
                      ]}
                      onPress={() =>
                        togglePlatform("tiktok", setAutoSelectedPlatforms)
                      }
                    >
                      <Ionicons
                        name="logo-tiktok"
                        size={14}
                        color={
                          autoSelectedPlatforms.includes("tiktok")
                            ? theme.bg
                            : theme.text
                        }
                      />
                      <Text
                        style={[
                          styles.autoModeChipText,
                          {
                            color: autoSelectedPlatforms.includes("tiktok")
                              ? theme.bg
                              : theme.text,
                          },
                        ]}
                      >
                        TikTok
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={[styles.autoHint, { color: theme.subText }]}>
                  Sélectionnez les réseaux sur lesquels diffuser cette publicité
                  en même temps que sur SenMoto. Vous pourrez aussi le faire
                  plus tard depuis la liste.
                </Text>
              </View>
            )}

            {scheduleEnabled && (
              <View
                style={[
                  styles.scheduleBox,
                  {
                    backgroundColor: theme.bg,
                    borderColor: theme.border,
                    marginTop: 14,
                  },
                ]}
              >
                <Text style={[styles.scheduleTitle, { color: theme.text }]}>
                  Quand publier ?
                </Text>
                <View style={styles.scheduleModeRow}>
                  <TouchableOpacity
                    style={[
                      styles.scheduleModeChip,
                      {
                        borderColor:
                          autoPublishMode === "now"
                            ? theme.primary
                            : theme.border,
                        backgroundColor:
                          autoPublishMode === "now"
                            ? theme.primary
                            : "transparent",
                      },
                    ]}
                    onPress={() => setAutoPublishMode("now")}
                  >
                    <Ionicons
                      name="flash-outline"
                      size={14}
                      color={autoPublishMode === "now" ? "#fff" : theme.text}
                    />
                    <Text
                      style={[
                        styles.scheduleModeChipText,
                        {
                          color:
                            autoPublishMode === "now" ? "#fff" : theme.text,
                        },
                      ]}
                    >
                      Maintenant
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.scheduleModeChip,
                      {
                        borderColor:
                          autoPublishMode === "schedule"
                            ? theme.primary
                            : theme.border,
                        backgroundColor:
                          autoPublishMode === "schedule"
                            ? theme.primary
                            : "transparent",
                      },
                    ]}
                    onPress={() => {
                      setAutoPublishMode("schedule");
                      if (!autoScheduleDate && !autoScheduleTime) {
                        const d = defaultScheduleValues();
                        setAutoScheduleDate(d.date);
                        setAutoScheduleTime(d.time);
                      }
                    }}
                  >
                    <Ionicons
                      name="alarm-outline"
                      size={14}
                      color={
                        autoPublishMode === "schedule" ? "#fff" : theme.text
                      }
                    />
                    <Text
                      style={[
                        styles.scheduleModeChipText,
                        {
                          color:
                            autoPublishMode === "schedule"
                              ? "#fff"
                              : theme.text,
                        },
                      ]}
                    >
                      Programmer
                    </Text>
                  </TouchableOpacity>
                </View>

                {autoPublishMode === "schedule" && (
                  <View
                    style={{ flexDirection: "row", gap: 10, marginTop: 12 }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.scheduleLabel, { color: theme.subText }]}
                      >
                        Date (JJ/MM/AAAA)
                      </Text>
                      <TextInput
                        style={[
                          styles.scheduleInput,
                          {
                            backgroundColor: theme.card,
                            color: theme.text,
                            borderColor: theme.border,
                          },
                        ]}
                        placeholder="31/12/2026"
                        placeholderTextColor={theme.subText}
                        keyboardType="numeric"
                        maxLength={10}
                        value={autoScheduleDate}
                        onChangeText={(t) =>
                          setAutoScheduleDate(formatDateInput(t))
                        }
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.scheduleLabel, { color: theme.subText }]}
                      >
                        Heure (HH:MM)
                      </Text>
                      <TextInput
                        style={[
                          styles.scheduleInput,
                          {
                            backgroundColor: theme.card,
                            color: theme.text,
                            borderColor: theme.border,
                          },
                        ]}
                        placeholder="14:00"
                        placeholderTextColor={theme.subText}
                        keyboardType="numeric"
                        maxLength={5}
                        value={autoScheduleTime}
                        onChangeText={(t) =>
                          setAutoScheduleTime(formatTimeInput(t))
                        }
                      />
                    </View>
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.autoGenerateBtn,
                {
                  backgroundColor:
                    autoGenerating || saving ? theme.border : theme.primary,
                },
              ]}
              onPress={handleAutoGenerate}
              disabled={autoGenerating || saving}
            >
              {autoGenerating || saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons
                    name={
                      autoPublishMode === "schedule"
                        ? "alarm-outline"
                        : "sparkles"
                    }
                    size={16}
                    color="#fff"
                  />
                  <Text style={styles.publishBtnText}>
                    {autoPublishMode === "schedule"
                      ? "Programmer la publicité"
                      : "Générer la publicité"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

export default function AdminPublicationsScreen() {
  return (
    <FeatureGate featureKey="publications.actif" featureName="Publications">
      <AdminPublicationsContent />
    </FeatureGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: "bold" },
  headerSub: { fontSize: 12, marginTop: 2 },
  headerBtns: { flexDirection: "row", gap: 8, flexShrink: 0 },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  newBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  empty: {
    alignItems: "center",
    paddingTop: 80,
    gap: 12,
    paddingHorizontal: 24,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
    marginTop: 4,
  },

  pubCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  pubCardScheduled: {
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
  pubCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  pubDate: { flex: 1, fontSize: 12 },
  pubText: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  seeMore: { fontSize: 13, fontWeight: "600", marginBottom: 10 },
  thumbRow: { marginBottom: 8 },
  thumb: {
    width: 76,
    height: 76,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: "#eee",
  },
  videoThumb: {
    width: "100%",
    height: 220,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: "#000",
  },
  imgCount: { fontSize: 11, marginTop: 2 },

  createContainer: { flex: 1 },
  createHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  createTitle: { fontSize: 16, fontWeight: "700" },
  publishBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    minWidth: 74,
    alignItems: "center",
  },
  publishBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  createContent: { padding: 16, paddingBottom: 48 },
  textInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    fontSize: 15,
    minHeight: 150,
    marginBottom: 16,
  },
  previewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  previewWrap: { position: "relative" },
  previewImg: {
    width: 100,
    height: 100,
    borderRadius: 10,
    backgroundColor: "#eee",
  },
  videoPreview: {
    width: "100%",
    height: 260,
    borderRadius: 10,
    backgroundColor: "#000",
  },
  removeImgBtn: { position: "absolute", top: -8, right: -8 },
  addImgBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 20,
  },
  addImgText: { fontSize: 14, fontWeight: "600" },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  infoText: { flex: 1, fontSize: 12, lineHeight: 18 },

  autoOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  autoSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
  },
  autoHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  autoLabel: { fontSize: 13, fontWeight: "600", marginBottom: 8 },
  autoInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  autoModeRow: { flexDirection: "row", gap: 8 },
  autoModeChip: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  autoModeChipText: { fontSize: 13, fontWeight: "700" },
  autoHint: { fontSize: 12, lineHeight: 17, marginTop: 12 },
  autoGenerateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 20,
  },

  scheduleBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  scheduleTitle: { fontSize: 13, fontWeight: "700", marginBottom: 10 },
  scheduleModeRow: { flexDirection: "row", gap: 8 },
  scheduleModeChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 10,
  },
  scheduleModeChipText: { fontSize: 13, fontWeight: "700" },
  scheduleLabel: { fontSize: 12, fontWeight: "600", marginBottom: 6 },
  scheduleInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  scheduleHint: { fontSize: 12, lineHeight: 17, marginTop: 10 },
});
