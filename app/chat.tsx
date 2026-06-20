import { Ionicons } from "@expo/vector-icons";
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
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/context/ThemeContext";

const GREEN = "#34C759";

interface Message {
  id: string;
  sender_type: "client" | "admin";
  sender_name: string;
  message: string;
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
  } = useLocalSearchParams<{
    enterprise_id: string;
    enterprise_name: string;
    moto_name?: string;
    moto_price?: string;
    moto_etat?: string;
    moto_image?: string;
    moto_couleur?: string;
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
  const listRef = useRef<FlatList>(null);

  // Tente de restaurer une session de chat existante
  useEffect(() => {
    const restore = async () => {
      if (!enterprise_id) return;
      const saved = await SecureStore.getItemAsync(`chat_token_${enterprise_id}`);
      const savedName = await SecureStore.getItemAsync(`chat_name_${enterprise_id}`);
      if (saved && savedName) {
        const { data } = await supabase
          .from("enterprise_chats")
          .select("id, status, client_token")
          .eq("client_token", saved)
          .eq("enterprise_id", enterprise_id)
          .single();
        if (data && data.status === "open") {
          setClientToken(saved);
          setClientName(savedName);
          setChatId(data.id);
          setStep("chat");
        }
      }
    };
    restore();
  }, [enterprise_id]);

  // Chargement des messages + souscription realtime + polling de secours
  useEffect(() => {
    if (!chatId) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("enterprise_chat_messages")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });
      if (data) setMessages(data as Message[]);
    };

    fetchMessages();

    // Realtime (fonctionne si la table est dans la publication Supabase Realtime)
    const sub = supabase
      .channel(`chat_${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "enterprise_chat_messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          setMessages((prev) => {
            const incoming = payload.new as Message;
            // Retirer les messages optimistes avec le même contenu
            const withoutTemp = prev.filter(
              (m) =>
                m.id.startsWith("temp_")
                  ? !(m.message === incoming.message && m.sender_type === incoming.sender_type)
                  : true
            );
            if (withoutTemp.find((m) => m.id === incoming.id)) return withoutTemp;
            return [...withoutTemp, incoming];
          });
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
        }
      )
      .subscribe();

    // Polling toutes les 3s : fallback si realtime non configuré côté Supabase
    const poll = setInterval(async () => {
      const { data } = await supabase
        .from("enterprise_chat_messages")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });
      if (!data) return;
      setMessages((prev) => {
        const db = data as Message[];
        // Conserver les messages optimistes non encore confirmés
        const temps = prev.filter(
          (m) =>
            m.id.startsWith("temp_") &&
            !db.find((d) => d.message === m.message && d.sender_type === m.sender_type)
        );
        return [...db, ...temps].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      });
    }, 3000);

    return () => {
      supabase.removeChannel(sub);
      clearInterval(poll);
    };
  }, [chatId]);

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
    const { data, error } = await supabase
      .from("enterprise_chats")
      .insert({
        enterprise_id,
        client_name: clientName.trim(),
        client_phone: clientPhone.trim() || null,
        status: "open",
      })
      .select("id, client_token")
      .single();

    setLoading(false);
    if (error || !data) {
      Alert.alert("Erreur", "Impossible de démarrer le chat.");
      return;
    }

    await SecureStore.setItemAsync(`chat_token_${enterprise_id}`, data.client_token);
    await SecureStore.setItemAsync(`chat_name_${enterprise_id}`, clientName.trim());
    setChatId(data.id);
    setClientToken(data.client_token);
    setStep("chat");

    // Message de bienvenue de l'admin
    await supabase.from("enterprise_chat_messages").insert({
      chat_id: data.id,
      sender_type: "admin",
      sender_name: enterprise_name || "Équipe",
      message: `Bonjour ${clientName.trim()} ! 👋 Comment pouvons-nous vous aider ?`,
    });

    // Message automatique du client avec le contexte de la moto
    if (moto_name) {
      const parts = [
        `🏍️ ${moto_name}`,
        moto_etat || null,
        moto_couleur || null,
        moto_price ? `${Number(moto_price).toLocaleString("fr-FR")} FCFA` : null,
      ]
        .filter(Boolean)
        .join(" · ");

      const introMsg = `Je suis intéressé(e) par votre moto :\n${parts}`;

      await supabase.from("enterprise_chat_messages").insert({
        chat_id: data.id,
        sender_type: "client",
        sender_name: clientName.trim(),
        message: introMsg,
      });

      // Notifier les agents avec le contexte moto
      notifyEnterpriseAgentsById(data.id, introMsg, clientName.trim()).catch(() => {});
    }
  };

  const sendMessage = async () => {
    const text = inputMsg.trim();
    if (!text || !chatId) return;
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

    await supabase.from("enterprise_chat_messages").insert({
      chat_id: chatId,
      sender_type: "client",
      sender_name: clientName,
      message: text,
    });

    await supabase
      .from("enterprise_chats")
      .update({
        last_message: text,
        last_message_at: new Date().toISOString(),
        unread_admin: 1,
      })
      .eq("id", chatId);

    // Remplacer le message optimiste par les données réelles
    const { data: refreshed } = await supabase
      .from("enterprise_chat_messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });
    if (refreshed) setMessages(refreshed as Message[]);

    notifyEnterpriseAgents(text).catch(() => {});
    setSending(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const notifyEnterpriseAgents = async (text: string) => {
    if (!chatId) return;
    notifyEnterpriseAgentsById(chatId, text, clientName);
  };

  const notifyEnterpriseAgentsById = async (id: string, text: string, name: string) => {
    const { data: tokens } = await supabase.rpc("get_chat_push_tokens", {
      p_chat_id: id,
    });
    if (!tokens || tokens.length === 0) return;

    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        (tokens as { expo_token: string }[]).map((row) => ({
          to: row.expo_token,
          title: `💬 ${name}`,
          body: text,
          sound: "default",
          data: { screen: "chat", chat_id: id, enterprise_id },
        }))
      ),
    });
  };

  const fmtTime = (s: string) =>
    new Date(s).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  // ─── ÉTAPE : SAISIE DU NOM ─────────────────────────────────────────────────
  if (step === "name") {
    const hasMoto = !!moto_name;
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: theme.bg }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.nameHeader, { paddingTop: insets.top || 14 }]}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={24} color={theme.primary} />
          </TouchableOpacity>
          <Text style={[styles.nameTitle, { color: theme.text }]}>
            Chat avec {enterprise_name || "l'équipe"}
          </Text>
        </View>

        <View style={styles.nameContent}>
          {/* Carte moto si contexte disponible */}
          {hasMoto ? (
            <View style={[styles.motoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {moto_image ? (
                <Image
                  source={{ uri: moto_image }}
                  style={styles.motoCardImg}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.motoCardImgPlaceholder, { backgroundColor: theme.bg }]}>
                  <Ionicons name="bicycle" size={34} color={theme.subText} />
                </View>
              )}
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.motoCardName, { color: theme.text }]} numberOfLines={1}>
                  {moto_name}
                </Text>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  {moto_etat ? (
                    <Text style={[styles.motoCardBadge, { color: GREEN }]}>{moto_etat}</Text>
                  ) : null}
                  {moto_couleur ? (
                    <Text style={[styles.motoCardBadge, { color: theme.subText }]}>
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
                style={[styles.nameInput, { color: theme.text, borderColor: theme.border }]}
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
                style={[styles.nameInput, { color: theme.text, borderColor: theme.border }]}
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
                <Ionicons name="chatbubble-ellipses-outline" size={20} color="#fff" />
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
              <Text style={[styles.chatHeaderSub, { color: GREEN }]}>En ligne</Text>
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
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const isMe = item.sender_type === "client";
          const isTemp = item.id.startsWith("temp_");
          return (
            <View style={[styles.msgRow, isMe ? styles.msgRowRight : styles.msgRowLeft]}>
              {!isMe && (
                <View style={styles.msgAvatar}>
                  <Ionicons name="person-circle" size={28} color={theme.subText} />
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
                <Text style={[styles.msgText, { color: isMe ? "#fff" : theme.text }]}>
                  {item.message}
                </Text>
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
            { color: theme.text, backgroundColor: theme.bg, borderColor: theme.border },
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
        <TouchableOpacity
          style={[
            styles.sendBtn,
            { backgroundColor: inputMsg.trim() ? theme.primary : theme.border },
          ]}
          onPress={sendMessage}
          disabled={!inputMsg.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={18} color="#fff" />
          )}
        </TouchableOpacity>
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
  nameSubtitle: { fontSize: 14, textAlign: "center", marginBottom: 28, lineHeight: 20 },

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
  chatHeaderInfo: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  onlineDot: { width: 10, height: 10, borderRadius: 5 },
  chatHeaderName: { fontSize: 16, fontWeight: "700" },
  chatHeaderSub: { fontSize: 12 },
  chatHeaderThumb: { width: 40, height: 40, borderRadius: 8 },

  messagesList: { padding: 16, gap: 10, paddingBottom: 8 },
  msgRow: { flexDirection: "row", alignItems: "flex-end", gap: 6, marginBottom: 8 },
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
