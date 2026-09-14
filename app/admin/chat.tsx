import { Ionicons } from "@expo/vector-icons";
import { File, UploadType } from "expo-file-system";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
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
import {
    SafeAreaView,
    useSafeAreaInsets,
} from "react-native-safe-area-context";
import { FeatureGate } from "../../components/FeatureGate";
import { VoiceMessageBubble } from "../../components/chat/VoiceMessageBubble";
import { VoiceRecorderButton } from "../../components/chat/VoiceRecorderButton";
import { useTenant } from "../../context/TenantContext";
import { useTheme } from "../../context/ThemeContext";
import { api, getToken } from "../../lib/api";

const GREEN = "#34C759";

interface Chat {
  id: string;
  client_name: string;
  client_phone: string | null;
  status: string;
  last_message: string | null;
  last_message_at: string | null;
  unread_admin: number;
  assigned_to: string | null;
  context_type?: "moto" | "publication" | null;
  context_id?: string | null;
  context_title?: string | null;
  context_image_url?: string | null;
}

interface Message {
  id: string;
  sender_type: "client" | "admin";
  sender_name: string;
  message: string | null;
  voice_url?: string | null;
  voice_duration?: number | null;
  created_at: string;
}

function AdminChatContent() {
  const { theme } = useTheme();
  const { tenant } = useTenant();
  const insets = useSafeAreaInsets();
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMsg, setInputMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendingVoice, setSendingVoice] = useState(false);
  const listRef = useRef<FlatList>(null);

  const fetchChats = async () => {
    if (!tenant?.enterprise_id || !tenant?.user_id) {
      setLoading(false);
      return;
    }
    try {
      const result = await api.listEnterpriseChats(tenant.enterprise_id);
      const rows = (result.data ?? result) as Chat[];
      rows.sort((a, b) => {
        if (!a.last_message_at) return 1;
        if (!b.last_message_at) return -1;
        return (
          new Date(b.last_message_at).getTime() -
          new Date(a.last_message_at).getTime()
        );
      });
      setChats(rows);
    } catch (e: any) {
      console.error("[AdminChat] fetchChats error:", e.message);
    }
    setLoading(false);
  };

  // Charge quand tenant devient disponible (même si l'écran est déjà focalisé)
  useEffect(() => {
    fetchChats();
  }, [tenant?.enterprise_id]);

  // Recharge à chaque fois que l'écran reprend le focus (navigation)
  useFocusEffect(
    useCallback(() => {
      fetchChats();
    }, [tenant?.enterprise_id]),
  );

  // Pas de canal temps réel côté client pour l'instant : on scrute la liste
  // périodiquement (seulement quand aucune conversation n'est ouverte, pour
  // ne pas interférer avec le polling des messages ci-dessous).
  useEffect(() => {
    if (!tenant?.enterprise_id || !tenant?.user_id) return;
    const interval = setInterval(() => {
      if (!selectedChat) fetchChats();
    }, 10000);
    return () => clearInterval(interval);
  }, [tenant?.enterprise_id, tenant?.user_id, selectedChat]);

  // Messages du chat sélectionné
  useEffect(() => {
    if (!selectedChat) return;
    setMessages([]); // Vide les messages de la conversation précédente immédiatement

    const fetchMsgs = async () => {
      try {
        const data = await api.getChat(selectedChat.id);
        setMessages((data.messages ?? []) as Message[]);
      } catch (e: any) {
        console.error("[AdminChat] fetchMsgs error:", e.message);
      }
    };

    fetchMsgs();
    const poll = setInterval(fetchMsgs, 4000);
    return () => clearInterval(poll);
  }, [selectedChat?.id]);

  const sendReply = async () => {
    const text = inputMsg.trim();
    if (!text || !selectedChat || !tenant?.user_id) return;
    setSending(true);
    setInputMsg("");

    // Attribution au premier répondant : si le chat n'est pas encore attribué,
    // on s'y assigne. Pas de garde d'atomicité côté serveur ici (contrairement
    // à l'ancien .is("assigned_to", null)) — cas limite de deux agents
    // répondant à la même seconde jugé négligeable.
    if (!selectedChat.assigned_to) {
      try {
        await api.updateChat(selectedChat.id, { assigned_to: tenant.user_id });
        setSelectedChat((prev) =>
          prev ? { ...prev, assigned_to: tenant.user_id } : prev,
        );
      } catch {
        // Non bloquant pour l'envoi du message
      }
    }

    try {
      const saved = (await api.sendAdminMessage(
        selectedChat.id,
        text,
      )) as Message;
      setMessages((prev) => [...prev, saved]);
    } catch (e: any) {
      Alert.alert("Erreur", e.message || "Message non envoyé.");
    }

    setSending(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  // Envoi natif (createUploadTask), pas fetch/FormData — même contournement
  // que uploadHelpItemMedia dans admin/help_config.tsx.
  const sendVoiceReply = async ({
    uri,
    durationMillis,
  }: {
    uri: string;
    durationMillis: number;
  }) => {
    if (!selectedChat || !tenant?.user_id) return;
    setSendingVoice(true);

    if (!selectedChat.assigned_to) {
      try {
        await api.updateChat(selectedChat.id, { assigned_to: tenant.user_id });
        setSelectedChat((prev) =>
          prev ? { ...prev, assigned_to: tenant.user_id } : prev,
        );
      } catch {
        // Non bloquant pour l'envoi du message
      }
    }

    try {
      const token = await getToken();
      const file = new File(uri);
      const task = file.createUploadTask(
        api.chatMessageUploadUrl(selectedChat.id),
        {
          httpMethod: "POST",
          uploadType: UploadType.MULTIPART,
          fieldName: "voice",
          mimeType: "audio/m4a",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
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
    } catch (e: any) {
      Alert.alert("Erreur", e.message || "Message vocal non envoyé.");
    }

    setSendingVoice(false);
  };

  const closeChat = async (chatId: string) => {
    try {
      await api.updateChat(chatId, { status: "closed" });
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
      return;
    }
    setSelectedChat(null);
    fetchChats();
  };

  const openContext = (chat: Chat) => {
    if (chat.context_type === "moto" && chat.context_id) {
      router.push({ pathname: "/moto/[id]", params: { id: chat.context_id } });
    } else if (chat.context_type === "publication") {
      router.push({
        pathname: "/admin/publications",
        params: { publication_id: chat.context_id ?? "" },
      });
    }
  };

  const fmtTime = (s: string | null) => {
    if (!s) return "";
    const d = new Date(s);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60_000) return "À l'instant";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min`;
    if (diff < 86_400_000)
      return d.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  };

  // Vue conversation sélectionnée
  if (selectedChat) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: theme.bg }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header conversation */}
        <View
          style={[
            styles.chatHeader,
            { borderBottomColor: theme.border, paddingTop: insets.top + 12 },
          ]}
        >
          <TouchableOpacity
            onPress={() => setSelectedChat(null)}
            style={{ padding: 4 }}
          >
            <Ionicons name="arrow-back" size={24} color={theme.primary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.chatHeaderName, { color: theme.text }]}>
              {selectedChat.client_name}
            </Text>
            {selectedChat.client_phone && (
              <Text style={[styles.chatHeaderPhone, { color: theme.subText }]}>
                {selectedChat.client_phone}
              </Text>
            )}
            {selectedChat.context_title && (
              <TouchableOpacity
                style={styles.contextHeader}
                onPress={() => openContext(selectedChat)}
                disabled={!selectedChat.context_type}
              >
                {selectedChat.context_image_url ? (
                  <Image
                    source={{ uri: selectedChat.context_image_url }}
                    style={styles.contextHeaderImage}
                  />
                ) : (
                  <Ionicons
                    name={
                      selectedChat.context_type === "moto"
                        ? "bicycle-outline"
                        : "newspaper-outline"
                    }
                    size={16}
                    color={theme.primary}
                  />
                )}
                <Text
                  style={[styles.contextHeaderText, { color: theme.primary }]}
                  numberOfLines={1}
                >
                  {selectedChat.context_type === "moto"
                    ? "Moto"
                    : "Publication"}
                  : {selectedChat.context_title}
                </Text>
                <Ionicons name="open-outline" size={14} color={theme.primary} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            onPress={() => closeChat(selectedChat.id)}
            style={[styles.closeBtn, { backgroundColor: "#FF3B3020" }]}
          >
            <Ionicons name="close-circle-outline" size={18} color="#FF3B30" />
            <Text style={{ color: "#FF3B30", fontSize: 13, fontWeight: "600" }}>
              Fermer
            </Text>
          </TouchableOpacity>
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
            const isAdmin = item.sender_type === "admin";
            // Séparer les lignes image (📸 URL) du texte normal
            const lines = (item.message ?? "").split("\n");
            const imageUrls: string[] = [];
            const textLines: string[] = [];
            for (const line of lines) {
              if (line.startsWith("📸 ")) {
                imageUrls.push(line.slice(3).trim());
              } else {
                textLines.push(line);
              }
            }
            const displayText = textLines.join("\n").trim();
            return (
              <View
                style={[
                  styles.msgRow,
                  isAdmin ? styles.msgRowRight : styles.msgRowLeft,
                ]}
              >
                {!isAdmin && (
                  <View
                    style={[
                      styles.clientInitial,
                      { backgroundColor: theme.border },
                    ]}
                  >
                    <Text
                      style={[styles.clientInitialText, { color: theme.text }]}
                    >
                      {item.sender_name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View
                  style={[
                    styles.msgBubble,
                    { backgroundColor: isAdmin ? theme.primary : theme.nav },
                  ]}
                >
                  {!isAdmin && (
                    <Text style={[styles.msgSender, { color: theme.subText }]}>
                      {item.sender_name}
                    </Text>
                  )}
                  {item.voice_url ? (
                    <VoiceMessageBubble uri={item.voice_url} isMine={isAdmin} />
                  ) : (
                    <>
                      {imageUrls.map((url, i) => (
                        <Image
                          key={i}
                          source={{ uri: url }}
                          style={styles.msgImage}
                          resizeMode="cover"
                        />
                      ))}
                      {displayText ? (
                        <Text
                          style={[
                            styles.msgText,
                            { color: isAdmin ? "#fff" : theme.text },
                          ]}
                        >
                          {displayText}
                        </Text>
                      ) : null}
                    </>
                  )}
                  <Text
                    style={[
                      styles.msgTime,
                      {
                        color: isAdmin
                          ? "rgba(255,255,255,0.6)"
                          : theme.subText,
                      },
                    ]}
                  >
                    {new Date(item.created_at).toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        {/* Zone de saisie */}
        {selectedChat.status === "open" ? (
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
              placeholder="Répondre..."
              placeholderTextColor={theme.subText}
              value={inputMsg}
              onChangeText={setInputMsg}
              multiline
              maxLength={1000}
            />
            {inputMsg.trim() ? (
              <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: theme.primary }]}
                onPress={sendReply}
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
              <VoiceRecorderButton onRecorded={sendVoiceReply} />
            )}
          </View>
        ) : (
          <View
            style={[
              styles.closedBanner,
              { backgroundColor: theme.card, borderTopColor: theme.border },
            ]}
          >
            <Ionicons name="lock-closed" size={16} color={theme.subText} />
            <Text style={[styles.closedText, { color: theme.subText }]}>
              Conversation fermée
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    );
  }

  // Vue liste des conversations
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={[styles.listHeader, { borderBottomColor: theme.border }]}>
        <Ionicons name="chatbubbles" size={22} color={theme.primary} />
        <Text style={[styles.listTitle, { color: theme.text }]}>
          Messages clients
        </Text>
        {chats.filter((c) => c.unread_admin > 0).length > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>
              {chats.filter((c) => c.unread_admin > 0).length}
            </Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : chats.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="chatbubble-outline" size={56} color={theme.subText} />
          <Text style={[styles.emptyText, { color: theme.subText }]}>
            Aucun message client pour l'instant
          </Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.chatItem,
                {
                  borderBottomColor: theme.border,
                  backgroundColor: theme.card,
                },
              ]}
              onPress={() => setSelectedChat(item)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.chatAvatar,
                  {
                    backgroundColor:
                      item.status === "open" ? theme.primary + "30" : theme.nav,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chatAvatarText,
                    {
                      color:
                        item.status === "open" ? theme.primary : theme.subText,
                    },
                  ]}
                >
                  {item.client_name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.chatItemTop}>
                  <Text style={[styles.chatClientName, { color: theme.text }]}>
                    {item.client_name}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {!item.assigned_to && item.status === "open" && (
                      <View style={styles.newBadge}>
                        <Text style={styles.newBadgeText}>Disponible</Text>
                      </View>
                    )}
                    <Text style={[styles.chatTime, { color: theme.subText }]}>
                      {fmtTime(item.last_message_at)}
                    </Text>
                  </View>
                </View>
                <View style={styles.chatItemBottom}>
                  <Text
                    style={[styles.chatLastMsg, { color: theme.subText }]}
                    numberOfLines={1}
                  >
                    {item.last_message || "Nouvelle conversation"}
                  </Text>
                  {item.unread_admin > 0 && (
                    <View style={styles.msgBadge}>
                      <Text style={styles.msgBadgeText}>
                        {item.unread_admin}
                      </Text>
                    </View>
                  )}
                </View>
                {item.client_phone && (
                  <Text style={[styles.chatPhone, { color: theme.subText }]}>
                    {item.client_phone}
                  </Text>
                )}
                {item.context_title && (
                  <TouchableOpacity
                    style={styles.contextListRow}
                    onPress={() => openContext(item)}
                    disabled={!item.context_type}
                  >
                    {item.context_image_url ? (
                      <Image
                        source={{ uri: item.context_image_url }}
                        style={styles.contextListImage}
                      />
                    ) : (
                      <Ionicons
                        name={
                          item.context_type === "moto"
                            ? "bicycle-outline"
                            : "newspaper-outline"
                        }
                        size={14}
                        color={theme.primary}
                      />
                    )}
                    <Text
                      style={[styles.contextListText, { color: theme.primary }]}
                      numberOfLines={1}
                    >
                      {item.context_type === "moto" ? "Moto" : "Publication"}:{" "}
                      {item.context_title}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor:
                      item.status === "open" ? GREEN : theme.subText,
                  },
                ]}
              />
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

export default function AdminChatScreen() {
  return (
    <FeatureGate featureKey="chat.actif" featureName="Messages Clients">
      <AdminChatContent />
    </FeatureGate>
  );
}

const styles = StyleSheet.create({
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  listTitle: { fontSize: 18, fontWeight: "700", flex: 1 },
  unreadBadge: {
    backgroundColor: "#FF3B30",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
  },
  unreadBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  emptyText: { fontSize: 15, textAlign: "center" },

  chatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chatAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  chatAvatarText: { fontSize: 20, fontWeight: "700" },
  chatItemTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chatClientName: { fontSize: 15, fontWeight: "700" },
  chatTime: { fontSize: 12 },
  chatItemBottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  chatLastMsg: { fontSize: 13, flex: 1 },
  chatPhone: { fontSize: 11, marginTop: 2 },
  msgBadge: {
    backgroundColor: "#0A84FF",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  msgBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  newBadge: {
    backgroundColor: "#34C75930",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  newBadgeText: { color: "#34C759", fontSize: 10, fontWeight: "700" },
  statusDot: { width: 8, height: 8, borderRadius: 4 },

  // Conversation
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  chatHeaderName: { fontSize: 16, fontWeight: "700" },
  chatHeaderPhone: { fontSize: 12, marginTop: 1 },
  contextHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
    maxWidth: "95%",
  },
  contextHeaderImage: { width: 22, height: 22, borderRadius: 4 },
  contextHeaderText: { fontSize: 11, fontWeight: "600", flex: 1 },
  contextListRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
    maxWidth: "90%",
  },
  contextListImage: { width: 24, height: 24, borderRadius: 4 },
  contextListText: { fontSize: 11, fontWeight: "600", flex: 1 },
  closeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },

  messagesList: { padding: 16, gap: 10, paddingBottom: 8 },
  msgRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    marginBottom: 8,
  },
  msgRowLeft: { justifyContent: "flex-start" },
  msgRowRight: { justifyContent: "flex-end" },
  clientInitial: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  clientInitialText: { fontSize: 13, fontWeight: "700" },
  msgBubble: {
    maxWidth: "75%",
    borderRadius: 16,
    padding: 12,
    paddingBottom: 8,
  },
  msgSender: { fontSize: 11, marginBottom: 4, fontWeight: "600" },
  msgImage: { width: 200, height: 150, borderRadius: 10, marginBottom: 6 },
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
  closedBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderTopWidth: 1,
  },
  closedText: { fontSize: 14 },
});
