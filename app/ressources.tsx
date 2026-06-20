// app/ressources.tsx

import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import {
    calculateTotalStorage,
    formatBytes,
    StorageStats,
} from "../lib/storageUtils";
import { supabase } from "../lib/supabase";

const StorageCategories = [
  {
    key: "motos",
    label: "Images Motos",
    icon: "bicycle" as const,
    color: "#FF6B6B",
  },
  {
    key: "decharges",
    label: "Photos Décharges",
    icon: "document" as const,
    color: "#4ECDC4",
  },
  {
    key: "recus",
    label: "Signatures Réçus",
    icon: "receipt" as const,
    color: "#45B7D1",
  },
  {
    key: "registres",
    label: "Photos Registres",
    icon: "images" as const,
    color: "#FFA07A",
  },
  {
    key: "logo",
    label: "Logo Entreprise",
    icon: "business" as const,
    color: "#FFD93D",
  },
];

export default function RessourcesScreen() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StorageStats | null>(null);

  useEffect(() => {
    fetchStorageStats();
  }, []);

  const fetchStorageStats = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      Alert.alert("Erreur", "Session expirée");
      return;
    }

    const stats = await calculateTotalStorage(user.id, supabase);
    setStats(stats);
    setLoading(false);
  };

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#f9f9f9",
        }}
      >
        <Stack.Screen options={{ title: "Ressources Consommées" }} />
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!stats) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#f9f9f9",
        }}
      >
        <Stack.Screen options={{ title: "Ressources Consommées" }} />
        <Text style={{ color: "#666", fontSize: 16 }}>
          Erreur lors du calcul
        </Text>
      </View>
    );
  }

  const percentage = (value: number) => {
    if (stats.total === 0) return "0%";
    return Math.round((value / stats.total) * 100) + "%";
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#f9f9f9" }}>
      <Stack.Screen options={{ title: "Ressources Consommées" }} />

      <ScrollView contentContainerStyle={styles.container}>
        {/* Carte principale - Total */}
        <View style={styles.totalCard}>
          <View style={styles.totalContent}>
            <Ionicons name="cloud-download-outline" size={40} color="#007AFF" />
            <View style={{ marginLeft: 15 }}>
              <Text style={styles.totalLabel}>Stockage Total</Text>
              <Text style={styles.totalSize}>{formatBytes(stats.total)}</Text>
            </View>
          </View>
        </View>

        {/* Détail par catégorie */}
        <Text style={styles.sectionTitle}>DÉTAIL PAR TYPE</Text>

        {StorageCategories.map((cat) => {
          const value = stats[cat.key as keyof StorageStats] as number;
          const perc = percentage(value);
          const progressPercent =
            stats.total === 0 ? 0 : (value / stats.total) * 100;

          return (
            <View key={cat.key} style={styles.categoryCard}>
              {/* Icône + Titre + Taille */}
              <View style={styles.categoryHeader}>
                <View
                  style={[
                    styles.iconBox,
                    { backgroundColor: cat.color + "20" },
                  ]}
                >
                  <Ionicons name={cat.icon} size={24} color={cat.color} />
                </View>
                <View style={styles.categoryInfo}>
                  <Text style={styles.categoryTitle}>{cat.label}</Text>
                  <Text style={styles.categorySize}>{formatBytes(value)}</Text>
                </View>
                <Text style={styles.categoryPercent}>{perc}</Text>
              </View>

              {/* Barre de progression */}
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: cat.color,
                      width: progressPercent + "%",
                    },
                  ]}
                />
              </View>
            </View>
          );
        })}

        {/* Résumé texte */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Résumé</Text>
          <Text style={styles.summaryText}>
            Vous avez utilisé{" "}
            <Text style={{ fontWeight: "800", color: "#007AFF" }}>
              {formatBytes(stats.total)}
            </Text>{" "}
            de stockage pour tous vos enregistrements (motos, décharges, réçus,
            registres, etc.).
          </Text>
          <Text style={styles.summarySubtext}>
            Astuce : Supprimez les anciens enregistrements pour libérer de
            l'espace.
          </Text>
        </View>

        {/* Informations complémentaires */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="information-circle" size={20} color="#007AFF" />
            <Text style={styles.infoText}>
              Ces données sont stockées dans votre base de données Supabase.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  totalCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  totalContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 14,
    color: "#888",
    fontWeight: "600",
    marginBottom: 4,
  },
  totalSize: {
    fontSize: 28,
    fontWeight: "800",
    color: "#007AFF",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 12,
    color: "#007AFF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  categoryCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
    marginBottom: 2,
  },
  categorySize: {
    fontSize: 12,
    color: "#888",
    fontWeight: "500",
  },
  categoryPercent: {
    fontSize: 14,
    fontWeight: "800",
    color: "#007AFF",
    minWidth: 45,
    textAlign: "right",
  },
  progressBar: {
    height: 6,
    backgroundColor: "#f0f0f0",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  summaryCard: {
    backgroundColor: "#E8F4FF",
    borderRadius: 10,
    padding: 16,
    marginTop: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#007AFF",
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0051A8",
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 13,
    color: "#0051A8",
    lineHeight: 20,
    marginBottom: 8,
  },
  summarySubtext: {
    fontSize: 12,
    color: "#0051A8",
    fontStyle: "italic",
    opacity: 0.8,
  },
  infoCard: {
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    padding: 16,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  infoText: {
    fontSize: 12,
    color: "#666",
    flex: 1,
    lineHeight: 18,
  },
});
