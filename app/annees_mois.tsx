// app/annees_mois.tsx

import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FeatureGate } from "../components/FeatureGate";
import { api } from "../lib/api";

function AnneesMoisContent() {
  const router = useRouter();
  const [dossiers, setDossiers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDossier, setEditingDossier] = useState<any>(null);

  const fetchDossiers = async () => {
    setLoading(true);
    try {
      const data = await api.listAnneesMois();
      setDossiers(data);
    } catch (error: any) {
      Alert.alert("Erreur", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDossiers();
  }, []);

  const handleDeleteDossier = async (dossier: any) => {
    Alert.alert(
      "Supprimer le dossier",
      `Supprimer "${dossier.nom}" et tous ses registres ?`,
      [
        { text: "Annuler" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              await api.deleteAnneeMois(dossier.id);
              fetchDossiers();
            } catch (error: any) {
              Alert.alert("Erreur", error.message);
            }
          },
        },
      ],
    );
  };

  const renderFolder = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.folderCard}
      onPress={() =>
        router.push({
          pathname: "/registres",
          params: { dossierId: item.id, nom: item.nom },
        })
      }
      onLongPress={() =>
        Alert.alert("Actions sur le dossier", item.nom, [
          { text: "Renommer", onPress: () => setEditingDossier({ ...item }) },
          {
            text: "Supprimer",
            style: "destructive",
            onPress: () => handleDeleteDossier(item),
          },
          { text: "Fermer", style: "cancel" },
        ])
      }
    >
      <Ionicons name="folder" size={50} color="#FFCA28" />
      <Text style={styles.folderName} numberOfLines={1}>
        {item.nom}
      </Text>
      <Text style={styles.folderCount}>
        {item.registres_count || 0} registre
        {(item.registres_count || 0) !== 1 ? "s" : ""}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: "Dossiers Registres" }} />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 50 }} size="large" />
      ) : (
        <FlatList
          data={dossiers}
          renderItem={renderFolder}
          keyExtractor={(item) => item.id.toString()}
          numColumns={2} // Affiche en grille 2 colonnes
          contentContainerStyle={{ padding: 15 }}
        />
      )}

      {/* Bouton flottant pour ajouter un dossier */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/annees_mois_new")}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>

      {/* Modale renommer dossier */}
      <Modal visible={!!editingDossier} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={{ fontWeight: "bold", fontSize: 16 }}>
              Renommer le dossier
            </Text>
            <TextInput
              style={styles.modalInput}
              value={editingDossier?.nom}
              onChangeText={(t) =>
                editingDossier &&
                setEditingDossier({ ...editingDossier, nom: t })
              }
              autoFocus
            />
            <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
              <TouchableOpacity onPress={() => setEditingDossier(null)}>
                <Text style={{ color: "red", marginRight: 20 }}>Annuler</Text>
              </TouchableOpacity>
              <Button
                title="Ok"
                onPress={async () => {
                  if (editingDossier && editingDossier.nom.trim()) {
                    try {
                      // Update non implémenté dans api.js pour annees-mois,
                      // je pourrais l'ajouter mais je vais voir si j'en ai vraiment besoin ou si create fait l'affaire (non).
                      // Je vais l'ajouter à api.js par soucis de cohérence.
                      await api.updateAnneeMois(editingDossier.id, {
                        nom: editingDossier.nom.trim(),
                      });
                      setEditingDossier(null);
                      fetchDossiers();
                    } catch (error: any) {
                      Alert.alert("Erreur", error.message);
                    }
                  }
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

export default function AnneesMoisScreen() {
  return (
    <FeatureGate featureKey="registres.actif" featureName="Registres">
      <AnneesMoisContent />
    </FeatureGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  folderCard: {
    width: "45%",
    margin: "2.5%",
    alignItems: "center",
    padding: 15,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    elevation: 2,
  },
  folderName: {
    marginTop: 10,
    fontWeight: "600",
    fontSize: 16,
    textAlign: "center",
  },
  folderCount: {
    marginTop: 4,
    fontSize: 11,
    color: "#888",
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 30,
    backgroundColor: "#007AFF",
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modal: {
    width: "85%",
    padding: 25,
    borderRadius: 20,
    backgroundColor: "#fff",
  },
  modalInput: {
    borderBottomWidth: 1,
    borderColor: "#ccc",
    paddingVertical: 10,
    marginVertical: 20,
    fontSize: 15,
  },
});
