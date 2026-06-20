// app/registre/[id].tsx

import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { supabase } from "../../lib/supabase";

export default function RegistreDetail() {
  const { id } = useLocalSearchParams();
  const [registre, setRegistre] = useState<any>(null);

  const fetchRegistre = async () => {
    const { data, error } = await supabase
      .from("registres")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      Alert.alert("Erreur", error.message);
      return;
    }
    setRegistre(data);
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: `Registre — ${registre.nom_prenom}` }} />

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
                  <Image
                    source={{ uri: registre.signature_uri }}
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
                  <Image
                    source={{ uri: registre.signature_documents_uri }}
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

      <Text style={styles.docsGroupTitle}>
        {registre.client_id_type === "passport"
          ? "Passeport du client"
          : "CNIB du client"}
      </Text>
      <View style={styles.docsRow}>
        <PhotoCard
          label={registre.client_id_type === "passport" ? "Page principale" : "Recto"}
          uri={registre.client_id_recto}
        />
        {registre.client_id_type !== "passport" && (
          <PhotoCard label="Verso" uri={registre.client_id_verso} />
        )}
      </View>

      <Text style={styles.docsGroupTitle}>Carte grise</Text>
      <View style={styles.docsRow}>
        <PhotoCard label="Recto" uri={registre.carte_grise_recto} />
        <PhotoCard label="Verso" uri={registre.carte_grise_verso} />
      </View>

      <Text style={styles.docsGroupTitle}>Certificat de vente</Text>
      <View style={styles.docsRow}>
        <PhotoCard label="Recto" uri={registre.certificat_vente} tall />
      </View>
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

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 40 },
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
});
