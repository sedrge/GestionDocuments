import { VoiceMessageBubble } from "@/components/chat/VoiceMessageBubble";
import { VoiceRecorderButton } from "@/components/chat/VoiceRecorderButton";
import { useTheme } from "@/context/ThemeContext";
import { api } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { File, UploadType } from "expo-file-system";
import { router, useLocalSearchParams } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const GREEN = "#34C759";

interface Message {
  id: string;
  sender_type: "client" | "admin";
  sender_name: string;
  message: string | null;
  voice_url?: string | null;
  voice_duration?: number | null;
  created_at: string;
}

export default function ChatScreen() {
  const { theme } = useTheme();
  const {
    enterprise_id,
    enterprise_name,
    moto_name,
    moto_price,
    moto_etat,
    moto_image,
    moto_couleur,
    context_type,
    context_id,
    context_title,
    context_image_url,
  } = useLocalSearchParams<{
    enterprise_id: string;
    enterprise_name: string;
    moto_name?: string;
    moto_price?: string;
    moto_etat?: string;
    moto_image?: string;
    moto_couleur?: string;
    context_type?: "moto" | "publication";
    context_id?: string;
    context_title?: string;
    context_image_url?: string;
  }>();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<"name" | "chat">("name");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [chatId, setChatId] = useState<string | null>(null);
  const [clientToken, setClientToken] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMsg, setInputMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendingVoice, setSendingVoice] = useState(false);
  const listRef = useRef<FlatList>(null);

  // Tente de restaurer une session de chat existante
  useEffect(() => {
    const restore = async () => {
      if (!enterprise_id) return;
      const savedId = await SecureStore.getItemAsync(
        `chat_id_${enterprise_id}`,
      );
      const savedToken = await SecureStore.getItemAsync(
        `chat_token_${enterprise_id}`,
      );
      const savedName = await SecureStore.getItemAsync(
        `chat_name_${enterprise_id}`,
      );
      if (savedId && savedToken && savedName) {
        try {
          const data = await api.getPublicChat(savedId, savedToken);
          if (data.status === "open") {
            setClientToken(savedToken);
            setClientName(savedName);
            setChatId(data.id);
            setStep("chat");
          }
        } catch {
          // Session invalide/expirée : on repart de l'étape "nom".
        }
      }
    };
    restore();
  }, [enterprise_id]);

  // Chargement des messages + polling (pas de canal temps réel côté client
  // pour l'instant, voir lib/api.js — cf. Pusher déjà branché côté admin/chat).
  useEffect(() => {
    if (!chatId || !clientToken) return;

    const fetchMessages = async () => {
      try {
        const data = await api.getPublicChat(chatId, clientToken);
        const db = (data.messages ?? []) as Message[];
        setMessages((prev) => {
          const temps = prev.filter(
            (m) =>
              m.id.startsWith("temp_") &&
              !db.find(
                (d) =>
                  d.message === m.message && d.sender_type === m.sender_type,
              ),
          );
          return [...db, ...temps].sort(
            (a, b) =>
              new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime(),
          );
        });
      } catch {
        // Poll suivant réessaiera.
      }
    };

    fetchMessages();
    const poll = setInterval(fetchMessages, 3000);
    return () => clearInterval(poll);
  }, [chatId, clientToken]);

  const startChat = async () => {
    if (!clientName.trim()) {
      Alert.alert("Requis", "Veuillez entrer votre nom.");
      return;
    }
    if (!enterprise_id) {
      Alert.alert("Erreur", "Entreprise introuvable.");
      return;
    }
    setLoading(true);

    // Message automatique du client avec le contexte de la moto (le message
    // de bienvenue de l'admin est lui généré côté serveur à la création).
    let introMsg: string | undefined;
    if (moto_name) {
      const parts = [
        `🏍️ ${moto_name}`,
        moto_etat || null,
        moto_couleur || null,
        moto_price
          ? `${Number(moto_price).toLocaleString("fr-FR")} FCFA`
          : null,
      ]
        .filter(Boolean)
        .join(" · ");
      const imgLine =
        moto_image && moto_image.startsWith("http") ? `\n📸 ${moto_image}` : "";
      introMsg = `Je suis intéressé(e) par votre moto :\n${parts}${imgLine}`;
    }

    let data: any;
    try {
      data = await api.startChat(enterprise_id, {
        client_name: clientName.trim(),
        client_phone: clientPhone.trim() || null,
        initial_message: introMsg,
        context_type: context_type || (moto_name ? "moto" : undefined),
        context_id: context_id || undefined,
        context_title: context_title || moto_name || undefined,
        context_image_url: context_image_url || moto_image || undefined,
      });
    } catch {
      setLoading(false);
      Alert.alert("Erreur", "Impossible de démarrer le chat.");
      return;
    }

    setLoading(false);
    await SecureStore.setItemAsync(`chat_id_${enterprise_id}`, data.id);
    await SecureStore.setItemAsync(
      `chat_token_${enterprise_id}`,
      data.client_token,
    );
    await SecureStore.setItemAsync(
      `chat_name_${enterprise_id}`,
      clientName.trim(),
    );
    setChatId(data.id);
    setClientToken(data.client_token);
    setMessages((data.messages ?? []) as Message[]);
    setStep("chat");
  };

  const sendMessage = async () => {
    const text = inputMsg.trim();
    if (!text || !chatId || !clientToken) return;
    setSending(true);
    setInputMsg("");

    // Affichage immédiat (optimistic update)
    const tempId = `temp_${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      sender_type: "client",
      sender_name: clientName,
      message: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const saved = (await api.sendClientMessage(
        chatId,
        clientToken,
        text,
      )) as Message;
      setMessages((prev) => prev.map((m) => (m.id === tempId ? saved : m)));
    } catch {
      Alert.alert("Erreur", "Message non envoyé.");
    }

    setSending(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  // Envoi natif (createUploadTask), pas fetch/FormData — même contournement
  // que uploadHelpItemMedia dans admin/help_config.tsx.
  const sendVoiceMessage = async ({
    uri,
    durationMillis,
  }: {
    uri: string;
    durationMillis: number;
  }) => {
    if (!chatId || !clientToken) return;
    setSendingVoice(true);

    try {
      const file = new File(uri);
      const task = file.createUploadTask(
        api.publicChatMessageUploadUrl(chatId),
        {
          httpMethod: "POST",
          uploadType: UploadType.MULTIPART,
          fieldName: "voice",
          mimeType: "audio/m4a",
          headers: { "X-Client-Token": clientToken },
          parameters: {
            voice_duration: String(Math.round(durationMillis / 1000)),
          },
        },
      );
      const result = await task.uploadAsync();
      if (!result || result.status < 200 || result.status >= 300) {
        throw new Error(`Échec de l'envoi (${result?.status ?? "réseau"}).`);
      }
      const saved = JSON.parse(result.body) as Message;
      setMessages((prev) => [...prev, saved]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      Alert.alert("Erreur", "Message vocal non envoyé.");
    }

    setSendingVoice(false);
  };

  const fmtTime = (s: string) =>
    new Date(s).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });

  // ─── ÉTAPE : SAISIE DU NOM ─────────────────────────────────────────────────
  if (step === "name") {
    const hasMoto = !!moto_name;
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: theme.bg }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.nameHeader, { paddingTop: insets.top || 14 }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ padding: 4 }}
          >
            <Ionicons name="arrow-back" size={24} color={theme.primary} />
          </TouchableOpacity>
          <Text style={[styles.nameTitle, { color: theme.text }]}>
            Chat avec {enterprise_name || "l'équipe"}
          </Text>
        </View>

        <View style={styles.nameContent}>
          {/* Carte moto si contexte disponible */}
          {hasMoto ? (
            <View
              style={[
                styles.motoCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              {moto_image ? (
                <Image
                  source={{ uri: moto_image }}
                  style={styles.motoCardImg}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={[
                    styles.motoCardImgPlaceholder,
                    { backgroundColor: theme.bg },
                  ]}
                >
                  <Ionicons name="bicycle" size={34} color={theme.subText} />
                </View>
              )}
              <View style={{ flex: 1, gap: 4 }}>
                <Text
                  style={[styles.motoCardName, { color: theme.text }]}
                  numberOfLines={1}
                >
                  {moto_name}
                </Text>
                <View
                  style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}
                >
                  {moto_etat ? (
                    <Text style={[styles.motoCardBadge, { color: GREEN }]}>
                      {moto_etat}
                    </Text>
                  ) : null}
                  {moto_couleur ? (
                    <Text
                      style={[styles.motoCardBadge, { color: theme.subText }]}
                    >
                      {moto_couleur}
                    </Text>
                  ) : null}
                </View>
                {moto_price ? (
                  <Text style={[styles.motoCardPrice, { color: GREEN }]}>
                    {Number(moto_price).toLocaleString("fr-FR")} FCFA
                  </Text>
                ) : null}
              </View>
            </View>
          ) : (
            <Text style={styles.nameEmoji}>💬</Text>
          )}

          <Text style={[styles.nameSubtitle, { color: theme.subText }]}>
            Entrez vos informations pour démarrer la conversation
          </Text>

          <View style={[styles.nameFormCard, { backgroundColor: theme.card }]}>
            <View style={styles.fieldRow}>
              <Ionicons name="person-outline" size={18} color={theme.subText} />
              <TextInput
                style={[
                  styles.nameInput,
                  { color: theme.text, borderColor: theme.border },
                ]}
                placeholder="Votre nom *"
                placeholderTextColor={theme.subText}
                value={clientName}
                onChangeText={setClientName}
                autoCapitalize="words"
              />
            </View>
            <View style={[styles.fieldRow, { marginTop: 12 }]}>
              <Ionicons name="call-outline" size={18} color={theme.subText} />
              <TextInput
                style={[
                  styles.nameInput,
                  { color: theme.text, borderColor: theme.border },
                ]}
                placeholder="Votre téléphone (optionnel)"
                placeholderTextColor={theme.subText}
                value={clientPhone}
                onChangeText={setClientPhone}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.startBtn,
              { backgroundColor: theme.primary, opacity: loading ? 0.7 : 1 },
            ]}
            onPress={startChat}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={20}
                  color="#fff"
                />
                <Text style={styles.startBtnText}>Démarrer le chat</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ─── ÉTAPE : CHAT ──────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg }}
      behavior={Platform.OS === "ios" ? "padding" : "padding"}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
    >
      {/* En-tête */}
      <View
        style={[
          styles.chatHeader,
          { borderBottomColor: theme.border, paddingTop: insets.top || 12 },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
        </TouchableOpacity>
        <View style={styles.chatHeaderInfo}>
          <View style={[styles.onlineDot, { backgroundColor: GREEN }]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.chatHeaderName, { color: theme.text }]}>
              {enterprise_name || "Équipe"}
            </Text>
            {moto_name ? (
              <Text
                style={[styles.chatHeaderSub, { color: theme.subText }]}
                numberOfLines={1}
              >
                🏍️ {moto_name}
              </Text>
            ) : (
              <Text style={[styles.chatHeaderSub, { color: GREEN }]}>
                En ligne
              </Text>
            )}
          </View>
        </View>
        {/* Miniature moto dans le header */}
        {moto_image ? (
          <Image
            source={{ uri: moto_image }}
            style={styles.chatHeaderThumb}
            resizeMode="cover"
          />
        ) : null}
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        style={{ flex: 1 }}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() =>
          listRef.current?.scrollToEnd({ animated: false })
        }
        renderItem={({ item }) => {
          const isMe = item.sender_type === "client";
          const isTemp = item.id.startsWith("temp_");
          return (
            <View
              style={[
                styles.msgRow,
                isMe ? styles.msgRowRight : styles.msgRowLeft,
              ]}
            >
              {!isMe && (
                <View style={styles.msgAvatar}>
                  <Ionicons
                    name="person-circle"
                    size={28}
                    color={theme.subText}
                  />
                </View>
              )}
              <View
                style={[
                  styles.msgBubble,
                  { backgroundColor: isMe ? theme.primary : theme.nav },
                  isTemp && { opacity: 0.65 },
                ]}
              >
                {!isMe && (
                  <Text style={[styles.msgSender, { color: theme.subText }]}>
                    {item.sender_name}
                  </Text>
                )}
                {item.voice_url ? (
                  <VoiceMessageBubble uri={item.voice_url} isMine={isMe} />
                ) : (
                  <Text
                    style={[
                      styles.msgText,
                      { color: isMe ? "#fff" : theme.text },
                    ]}
                  >
                    {item.message}
                  </Text>
                )}
                <Text
                  style={[
                    styles.msgTime,
                    { color: isMe ? "rgba(255,255,255,0.6)" : theme.subText },
                  ]}
                >
                  {isTemp ? "Envoi…" : fmtTime(item.created_at)}
                </Text>
              </View>
            </View>
          );
        }}
      />

      {/* Saisie */}
      <View
        style={[
          styles.inputBar,
          {
            borderTopColor: theme.border,
            backgroundColor: theme.card,
            paddingBottom: Math.max(insets.bottom, 10),
          },
        ]}
      >
        <TextInput
          style={[
            styles.msgInput,
            {
              color: theme.text,
              backgroundColor: theme.bg,
              borderColor: theme.border,
            },
          ]}
          placeholder="Votre message..."
          placeholderTextColor={theme.subText}
          value={inputMsg}
          onChangeText={setInputMsg}
          multiline
          maxLength={1000}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
          blurOnSubmit={false}
        />
        {inputMsg.trim() ? (
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: theme.primary }]}
            onPress={sendMessage}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        ) : sendingVoice ? (
          <View style={styles.sendBtn}>
            <ActivityIndicator size="small" color={theme.primary} />
          </View>
        ) : (
          <VoiceRecorderButton onRecorded={sendVoiceMessage} />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // Étape nom
  nameHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  nameTitle: { fontSize: 18, fontWeight: "700", flex: 1 },
  nameContent: { flex: 1, paddingHorizontal: 24, justifyContent: "center" },
  nameEmoji: { fontSize: 56, textAlign: "center", marginBottom: 16 },
  nameSubtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 28,
    lineHeight: 20,
  },

  // Carte moto (étape nom)
  motoCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 20,
    gap: 12,
  },
  motoCardImg: { width: 90, height: 80 },
  motoCardImgPlaceholder: {
    width: 90,
    height: 80,
    justifyContent: "center",
    alignItems: "center",
  },
  motoCardName: { fontSize: 15, fontWeight: "700" },
  motoCardBadge: { fontSize: 12, fontWeight: "600" },
  motoCardPrice: { fontSize: 14, fontWeight: "800" },

  nameFormCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  fieldRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  nameInput: {
    flex: 1,
    borderBottomWidth: 1,
    paddingVertical: 8,
    fontSize: 15,
  },
  startBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  startBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  // Chat
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  chatHeaderInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  onlineDot: { width: 10, height: 10, borderRadius: 5 },
  chatHeaderName: { fontSize: 16, fontWeight: "700" },
  chatHeaderSub: { fontSize: 12 },
  chatHeaderThumb: { width: 40, height: 40, borderRadius: 8 },

  messagesList: { padding: 16, gap: 10, paddingBottom: 8 },
  msgRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    marginBottom: 8,
  },
  msgRowLeft: { justifyContent: "flex-start" },
  msgRowRight: { justifyContent: "flex-end" },
  msgAvatar: {},
  msgBubble: {
    maxWidth: "75%",
    borderRadius: 16,
    padding: 12,
    paddingBottom: 8,
  },
  msgSender: { fontSize: 11, marginBottom: 4, fontWeight: "600" },
  msgText: { fontSize: 15, lineHeight: 21 },
  msgTime: { fontSize: 10, marginTop: 4, textAlign: "right" },

  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    padding: 10,
    borderTopWidth: 1,
  },
  msgInput: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
});
