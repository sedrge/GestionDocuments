import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { useTenant } from "../../context/TenantContext";
import { useTheme } from "../../context/ThemeContext";

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
}

interface Message {
  id: string;
  sender_type: "client" | "admin";
  sender_name: string;
  message: string;
  created_at: string;
}

export default function AdminChatScreen() {
  const { theme } = useTheme();
  const { tenant } = useTenant();
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMsg, setInputMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const fetchChats = async () => {
    if (!tenant?.enterprise_id || !tenant?.user_id) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("enterprise_chats")
      .select("id, client_name, client_phone, status, last_message, last_message_at, unread_admin, assigned_to")
      .eq("enterprise_id", tenant.enterprise_id)
      .order("last_message_at", { ascending: false, nullsFirst: true });
    if (error) console.error("[AdminChat] fetchChats error:", error.message, error.details);
    if (data) setChats(data as Chat[]);
    setLoading(false);
  };

  // Charge quand tenant devient disponible (même si l'écran est déjà focalisé)
  useEffect(() => { fetchChats(); }, [tenant?.enterprise_id]);

  // Recharge à chaque fois que l'écran reprend le focus (navigation)
  useFocusEffect(useCallback(() => { fetchChats(); }, [tenant?.enterprise_id]));

  // Abonnement realtime à la liste des chats (canal unique par user+enterprise pour éviter les conflits)
  useEffect(() => {
    if (!tenant?.enterprise_id || !tenant?.user_id) return;
    const channelName = `chats_${tenant.enterprise_id}_${tenant.user_id}`;
    const sub = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "enterprise_chats", filter: `enterprise_id=eq.${tenant.enterprise_id}` },
        () => fetchChats()
      )
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [tenant?.enterprise_id, tenant?.user_id]);

  // Messages du chat sélectionné
  useEffect(() => {
    if (!selectedChat) return;
    setMessages([]); // Vide les messages de la conversation précédente immédiatement

    const fetchMsgs = async () => {
      const { data, error } = await supabase
        .from("enterprise_chat_messages")
        .select("*")
        .eq("chat_id", selectedChat.id)
        .order("created_at", { ascending: true });
      if (error) console.error("[AdminChat] fetchMsgs error:", error.message, error.details, error.hint);
      if (data) setMessages(data as Message[]);
      // Marquer comme lu
      await supabase.from("enterprise_chats").update({ unread_admin: 0 }).eq("id", selectedChat.id);
    };

    fetchMsgs();

    const sub = supabase
      .channel(`admin_msg_${selectedChat.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "enterprise_chat_messages", filter: `chat_id=eq.${selectedChat.id}` },
        (payload) => {
          setMessages((prev) => {
            if (prev.find((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new as Message];
          });
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [selectedChat?.id]);

  const sendReply = async () => {
    const text = inputMsg.trim();
    if (!text || !selectedChat || !tenant?.user_id) return;
    setSending(true);
    setInputMsg("");

    // Attribution au premier répondant : si le chat n'est pas encore attribué,
    // on s'y assigne atomiquement (le filtre .is("assigned_to", null) garantit
    // qu'un seul agent peut l'obtenir même en cas de réponse simultanée).
    if (!selectedChat.assigned_to) {
      const { data: updated } = await supabase
        .from("enterprise_chats")
        .update({ assigned_to: tenant.user_id })
        .eq("id", selectedChat.id)
        .is("assigned_to", null) // Seulement si toujours non attribué
        .select("assigned_to")
        .single();

      if (updated) {
        setSelectedChat((prev) => prev ? { ...prev, assigned_to: tenant.user_id } : prev);
      }
    }

    await supabase.from("enterprise_chat_messages").insert({
      chat_id: selectedChat.id,
      sender_type: "admin",
      sender_name: tenant?.enterprise_name || "Admin",
      message: text,
    });

    await supabase
      .from("enterprise_chats")
      .update({ last_message: text, last_message_at: new Date().toISOString() })
      .eq("id", selectedChat.id);

    setSending(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const closeChat = async (chatId: string) => {
    await supabase.from("enterprise_chats").update({ status: "closed" }).eq("id", chatId);
    setSelectedChat(null);
    fetchChats();
  };

  const fmtTime = (s: string | null) => {
    if (!s) return "";
    const d = new Date(s);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60_000) return "À l'instant";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min`;
    if (diff < 86_400_000) return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
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
        <View style={[styles.chatHeader, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => setSelectedChat(null)} style={{ padding: 4 }}>
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
          </View>
          <TouchableOpacity
            onPress={() => closeChat(selectedChat.id)}
            style={[styles.closeBtn, { backgroundColor: "#FF3B3020" }]}
          >
            <Ionicons name="close-circle-outline" size={18} color="#FF3B30" />
            <Text style={{ color: "#FF3B30", fontSize: 13, fontWeight: "600" }}>Fermer</Text>
          </TouchableOpacity>
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
            const isAdmin = item.sender_type === "admin";
            return (
              <View style={[styles.msgRow, isAdmin ? styles.msgRowRight : styles.msgRowLeft]}>
                {!isAdmin && (
                  <View style={[styles.clientInitial, { backgroundColor: theme.border }]}>
                    <Text style={[styles.clientInitialText, { color: theme.text }]}>
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
                  <Text style={[styles.msgText, { color: theme.text }]}>{item.message}</Text>
                  <Text style={[styles.msgTime, { color: isAdmin ? "rgba(255,255,255,0.6)" : theme.subText }]}>
                    {new Date(item.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        {/* Zone de saisie */}
        {selectedChat.status === "open" ? (
          <View style={[styles.inputBar, { borderTopColor: theme.border, backgroundColor: theme.card }]}>
            <TextInput
              style={[styles.msgInput, { color: theme.text, backgroundColor: theme.bg, borderColor: theme.border }]}
              placeholder="Répondre..."
              placeholderTextColor={theme.subText}
              value={inputMsg}
              onChangeText={setInputMsg}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: inputMsg.trim() ? theme.primary : theme.border }]}
              onPress={sendReply}
              disabled={!inputMsg.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.closedBanner, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
            <Ionicons name="lock-closed" size={16} color={theme.subText} />
            <Text style={[styles.closedText, { color: theme.subText }]}>Conversation fermée</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    );
  }

  // Vue liste des conversations
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={[styles.listHeader, { borderBottomColor: theme.border }]}>
        <Ionicons name="chatbubbles" size={22} color={theme.primary} />
        <Text style={[styles.listTitle, { color: theme.text }]}>Messages clients</Text>
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
              style={[styles.chatItem, { borderBottomColor: theme.border, backgroundColor: theme.card }]}
              onPress={() => setSelectedChat(item)}
              activeOpacity={0.8}
            >
              <View style={[styles.chatAvatar, { backgroundColor: item.status === "open" ? theme.primary + "30" : theme.nav }]}>
                <Text style={[styles.chatAvatarText, { color: item.status === "open" ? theme.primary : theme.subText }]}>
                  {item.client_name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.chatItemTop}>
                  <Text style={[styles.chatClientName, { color: theme.text }]}>
                    {item.client_name}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
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
                  <Text style={[styles.chatLastMsg, { color: theme.subText }]} numberOfLines={1}>
                    {item.last_message || "Nouvelle conversation"}
                  </Text>
                  {item.unread_admin > 0 && (
                    <View style={styles.msgBadge}>
                      <Text style={styles.msgBadgeText}>{item.unread_admin}</Text>
                    </View>
                  )}
                </View>
                {item.client_phone && (
                  <Text style={[styles.chatPhone, { color: theme.subText }]}>
                    {item.client_phone}
                  </Text>
                )}
              </View>
              <View style={[styles.statusDot, { backgroundColor: item.status === "open" ? GREEN : theme.subText }]} />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
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
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
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
  chatItemTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chatClientName: { fontSize: 15, fontWeight: "700" },
  chatTime: { fontSize: 12 },
  chatItemBottom: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
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
    paddingTop: Platform.OS === "ios" ? 56 : 12,
    borderBottomWidth: 1,
  },
  chatHeaderName: { fontSize: 16, fontWeight: "700" },
  chatHeaderPhone: { fontSize: 12, marginTop: 1 },
  closeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },

  messagesList: { padding: 16, gap: 10, paddingBottom: 8 },
  msgRow: { flexDirection: "row", alignItems: "flex-end", gap: 6, marginBottom: 8 },
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
  msgBubble: { maxWidth: "75%", borderRadius: 16, padding: 12, paddingBottom: 8 },
  msgSender: { fontSize: 11, marginBottom: 4, fontWeight: "600" },
  msgText: { fontSize: 15, lineHeight: 21 },
  msgTime: { fontSize: 10, marginTop: 4, textAlign: "right" },

  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    padding: 10,
    paddingBottom: Platform.OS === "ios" ? 28 : 10,
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
