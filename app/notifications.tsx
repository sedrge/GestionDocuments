// app/notifications.tsx
//
// Centre de notifications : liste les notifications de l'utilisateur (rappels
// de rendez-vous + modifications). Permet de marquer comme lu et de supprimer.

import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { Stack, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../lib/api";

type Notif = {
  id: string;
  type:
    | "rdv_modification"
    | "rdv_rappel_j3"
    | "rdv_rappel_j2"
    | "rdv_rappel_j0";
  titre: string;
  message: string;
  rendezvous_id: string | null;
  data: any;
  lu: boolean;
  statut: "pending" | "sent" | "cancelled";
  scheduled_at: string | null;
  created_at: string;
};

const typeMeta: Record<
  Notif["type"],
  { icon: any; color: string; label: string }
> = {
  rdv_modification: {
    icon: "create-outline",
    color: "#5856D6",
    label: "Modification",
  },
  rdv_rappel_j3: {
    icon: "alarm-outline",
    color: "#FF9500",
    label: "Rappel J-3",
  },
  rdv_rappel_j2: {
    icon: "alarm-outline",
    color: "#FF9500",
    label: "Rappel J-2",
  },
  rdv_rappel_j0: {
    icon: "notifications-outline",
    color: "#FF3B30",
    label: "Aujourd'hui",
  },
};

const formatWhen = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

export default function NotificationsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifs = async () => {
    setLoading(true);
    try {
      const result = await api.listNotifications();
      setItems((result.data ?? result) as Notif[]);
    } catch (error: any) {
      Alert.alert("Erreur", error.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchNotifs();
    }, []),
  );

  const markAsRead = async (n: Notif) => {
    if (!n.lu) {
      try {
        await api.markNotificationRead(n.id);
        setItems((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, lu: true } : x)),
        );
      } catch {
        // Non bloquant pour la navigation ci-dessous
      }
    }
    if (n.rendezvous_id) {
      router.push({
        pathname: "/rendezvous_form",
        params: { id: n.rendezvous_id },
      });
    }
  };

  const markAllRead = async () => {
    const unread = items.filter((n) => !n.lu);
    await Promise.all(unread.map((n) => api.markNotificationRead(n.id).catch(() => {})));
    fetchNotifs();
  };

  const deleteNotif = (n: Notif) => {
    Alert.alert("Supprimer", "Supprimer cette notification ?", [
      { text: "Annuler" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          await api.deleteNotification(n.id).catch(() => {});
          fetchNotifs();
        },
      },
    ]);
  };

  const clearAll = () => {
    Alert.alert(
      "Tout effacer",
      "Supprimer toutes les notifications ? Les rappels déjà programmés (push) seront conservés.",
      [
        { text: "Annuler" },
        {
          text: "Tout effacer",
          style: "destructive",
          onPress: async () => {
            await Promise.all(
              items.map((n) => api.deleteNotification(n.id).catch(() => {})),
            );
            fetchNotifs();
          },
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: Notif }) => {
    const meta = typeMeta[item.type];
    return (
      <TouchableOpacity
        style={[styles.card, !item.lu && styles.cardUnread]}
        onPress={() => markAsRead(item)}
        onLongPress={() => deleteNotif(item)}
        activeOpacity={0.85}
      >
        <View style={[styles.iconWrap, { backgroundColor: meta.color }]}>
          <Ionicons name={meta.icon} size={20} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.headerRow}>
            <Text style={styles.label} numberOfLines={1}>
              {item.titre}
            </Text>
            {!item.lu && <View style={styles.dot} />}
          </View>
          <Text style={styles.message} numberOfLines={3}>
            {item.message}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              {meta.label}
              {item.statut === "pending" && " • programmée"}
              {item.statut === "cancelled" && " • annulée"}
            </Text>
            <Text style={styles.metaText}>
              {formatWhen(item.scheduled_at || item.created_at)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: "Notifications",
          headerRight: () => (
            <View style={{ flexDirection: "row", marginRight: 6 }}>
              <TouchableOpacity onPress={markAllRead} style={styles.headerBtn}>
                <Ionicons name="checkmark-done-outline" size={22} color="#5856D6" />
              </TouchableOpacity>
              <TouchableOpacity onPress={clearAll} style={styles.headerBtn}>
                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 50 }} size="large" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, paddingBottom: 60 }}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="notifications-off-outline" size={48} color="#bbb" />
              <Text style={styles.empty}>Aucune notification</Text>
              <Text style={styles.emptyHint}>
                Les rappels de rendez-vous et les modifications apparaîtront ici.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f7" },
  headerBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: "#5856D6" },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
  label: { fontSize: 14, fontWeight: "700", color: "#222", flex: 1 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF3B30",
    marginLeft: 6,
  },
  message: { fontSize: 13, color: "#444", marginBottom: 6 },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaText: { fontSize: 11, color: "#888" },
  emptyBox: { alignItems: "center", marginTop: 60, padding: 20 },
  empty: { fontSize: 15, color: "#888", marginTop: 12, fontWeight: "600" },
  emptyHint: {
    fontSize: 12,
    color: "#aaa",
    marginTop: 6,
    textAlign: "center",
  },
});
