// app/rendezvous_form.tsx
//
// Formulaire de création / édition d'un rendez-vous.

import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import {
  RendezVousLite,
  diffRdvFields,
  notifyRdvModification,
  scheduleRdvReminders,
} from "../lib/notifications";

type Statut = "en_attente" | "reporte" | "annule" | "termine";

const STATUTS: { value: Statut; label: string; color: string }[] = [
  { value: "en_attente", label: "En attente", color: "#FF9500" },
  { value: "reporte", label: "Reporté", color: "#5856D6" },
  { value: "annule", label: "Annulé", color: "#FF3B30" },
  { value: "termine", label: "Terminé", color: "#34C759" },
];

const getTodayDateFR = () => {
  const now = new Date();
  const j = String(now.getDate()).padStart(2, "0");
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const a = now.getFullYear();
  return `${j}/${m}/${a}`;
};

const toDateBDD = (dateFR: string) => {
  const parts = dateFR.trim().split("/");
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return dateFR;
};

const toDateFR = (iso: string | null) => {
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return iso;
};

export default function RendezVousForm() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
    // Paramètres prérempli depuis le registre :
    nomPrenom?: string;
    telephone?: string;
    motif?: string;
    lieu?: string;
    registreId?: string;
  }>();

  const id = params.id;

  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);

  const [dateRdv, setDateRdv] = useState(getTodayDateFR());
  const [heureRdv, setHeureRdv] = useState("");
  const [lieu, setLieu] = useState("");
  const [nomPrenom, setNomPrenom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [motif, setMotif] = useState("");
  const [description, setDescription] = useState("");
  const [statut, setStatut] = useState<Statut>("en_attente");
  const [registreId, setRegistreId] = useState<string | null>(null);

  // Snapshot pour détecter les modifications (uniquement en mode édition)
  const [originalRdv, setOriginalRdv] = useState<RendezVousLite | null>(null);

  useEffect(() => {
    if (id) {
      fetchRDV();
    } else {
      preFillFromParams();
    }
  }, [id]);

  const preFillFromParams = async () => {
    // Préremplissage depuis le registre
    if (params.nomPrenom) setNomPrenom(String(params.nomPrenom));
    if (params.telephone) setTelephone(String(params.telephone));
    if (params.motif) setMotif(String(params.motif));
    if (params.registreId) setRegistreId(String(params.registreId));

    // Lieu : si non fourni, on tente le nom de l'entreprise depuis les paramètres
    if (params.lieu) {
      setLieu(String(params.lieu));
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("entreprise_parametres")
          .select("nom_entreprise")
          .eq("user_id", user.id)
          .maybeSingle();
        if (data?.nom_entreprise) setLieu(data.nom_entreprise);
      }
    }
  };

  const fetchRDV = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("rendez_vous")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      Alert.alert("Erreur", "Impossible de charger ce rendez-vous.");
      setLoading(false);
      return;
    }

    setDateRdv(toDateFR(data.date_rdv) || getTodayDateFR());
    setHeureRdv(data.heure_rdv || "");
    setLieu(data.lieu || "");
    setNomPrenom(data.nom_prenom || "");
    setTelephone(data.telephone || "");
    setMotif(data.motif || "");
    setDescription(data.description || "");
    setStatut((data.statut as Statut) || "en_attente");
    setRegistreId(data.registre_id || null);

    // Mémorise l'état avant édition pour pouvoir diff au save
    setOriginalRdv({
      id: data.id,
      date_rdv: data.date_rdv,
      heure_rdv: data.heure_rdv,
      lieu: data.lieu,
      nom_prenom: data.nom_prenom,
      telephone: data.telephone,
      motif: data.motif,
      description: data.description,
    });
    setLoading(false);
  };

  const handleSave = async () => {
    if (!nomPrenom.trim()) {
      return Alert.alert("Erreur", "Le nom & prénom du client est requis.");
    }
    if (!dateRdv.trim()) {
      return Alert.alert("Erreur", "La date du rendez-vous est requise.");
    }
    if (!motif.trim()) {
      return Alert.alert("Erreur", "Le motif du rendez-vous est requis.");
    }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return Alert.alert("Erreur", "Utilisateur non connecté.");
    }

    const payload = {
      user_id: user.id,
      date_rdv: toDateBDD(dateRdv),
      heure_rdv: heureRdv.trim() || null,
      lieu: lieu.trim() || null,
      nom_prenom: nomPrenom.trim(),
      telephone: telephone.trim() || null,
      motif: motif.trim(),
      description: description.trim() || null,
      statut,
      registre_id: registreId,
      updated_at: new Date().toISOString(),
    };

    let result;
    let savedId: string | undefined = id;
    if (id) {
      result = await supabase
        .from("rendez_vous")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
    } else {
      result = await supabase
        .from("rendez_vous")
        .insert([payload])
        .select()
        .single();
      if (!result.error && result.data) savedId = result.data.id;
    }

    if (result.error) {
      setSaving(false);
      Alert.alert("Erreur", result.error.message);
      return;
    }

    // --- NOTIFICATIONS ---------------------------------------------------
    try {
      const afterLite: RendezVousLite = {
        id: savedId || "",
        date_rdv: payload.date_rdv,
        heure_rdv: payload.heure_rdv,
        lieu: payload.lieu,
        nom_prenom: payload.nom_prenom,
        telephone: payload.telephone,
        motif: payload.motif,
        description: payload.description,
      };

      // Si modification : on identifie les champs qui ont changé
      if (id && originalRdv) {
        const changed = diffRdvFields(originalRdv, afterLite);
        if (changed.length > 0) {
          await notifyRdvModification(user.id, afterLite, changed);
        }
      }

      // Toujours (re)programmer les rappels J-3 / J-2 / Jour-J
      if (savedId) {
        await scheduleRdvReminders(user.id, afterLite);
      }
    } catch (e: any) {
      console.warn("[rendezvous_form] notifications failed:", e?.message);
    }
    // ---------------------------------------------------------------------

    setSaving(false);
    Alert.alert("Succès", "Rendez-vous enregistré.");
    router.back();
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Stack.Screen options={{ title: "Rendez-vous" }} />
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f9f9f9" }}>
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#f9f9f9" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={100}
    >
      <Stack.Screen
        options={{ title: id ? "Modifier le rendez-vous" : "Nouveau rendez-vous" }}
      />

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Date et heure */}
        <Text style={styles.sectionTitle}>DATE & HEURE</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Date (JJ/MM/AAAA) *</Text>
            <TextInput
              value={dateRdv}
              onChangeText={(t) => {
                let v = t.replace(/[^0-9]/g, "");
                if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2);
                if (v.length > 5) v = v.slice(0, 5) + "/" + v.slice(5);
                setDateRdv(v.slice(0, 10));
              }}
              style={styles.input}
              placeholder="31/12/2026"
              keyboardType="numeric"
              maxLength={10}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Heure (HH:MM)</Text>
            <TextInput
              value={heureRdv}
              onChangeText={setHeureRdv}
              style={styles.input}
              placeholder="14:30"
            />
          </View>
        </View>

        {/* Client */}
        <Text style={styles.sectionTitle}>CLIENT</Text>
        <Text style={styles.label}>Nom & Prénom du client *</Text>
        <TextInput
          value={nomPrenom}
          onChangeText={setNomPrenom}
          style={styles.input}
          placeholder="Ex: Jean Dupont"
        />

        <Text style={styles.label}>Téléphone du client</Text>
        <TextInput
          value={telephone}
          onChangeText={setTelephone}
          style={styles.input}
          keyboardType="phone-pad"
          placeholder="Ex: +226 70 00 00 00"
        />

        {/* Lieu et motif */}
        <Text style={styles.sectionTitle}>RENDEZ-VOUS</Text>
        <Text style={styles.label}>Lieu du rendez-vous</Text>
        <TextInput
          value={lieu}
          onChangeText={setLieu}
          style={styles.input}
          placeholder="Ex: Siège de l'entreprise"
        />

        <Text style={styles.label}>Motif *</Text>
        <TextInput
          value={motif}
          onChangeText={setMotif}
          style={styles.input}
          placeholder="Ex: Récupération de moto"
        />

        <Text style={styles.label}>Description / Notes</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          style={[styles.input, { minHeight: 80 }]}
          placeholder="Détails additionnels..."
          multiline
        />

        {/* Statut */}
        <Text style={styles.sectionTitle}>STATUT</Text>
        <View style={styles.statutRow}>
          {STATUTS.map((s) => {
            const active = statut === s.value;
            return (
              <TouchableOpacity
                key={s.value}
                onPress={() => setStatut(s.value)}
                style={[
                  styles.statutChip,
                  active && { backgroundColor: s.color, borderColor: s.color },
                ]}
              >
                <Text
                  style={[
                    styles.statutChipText,
                    active && { color: "#fff", fontWeight: "700" },
                  ]}
                >
                  {s.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {registreId ? (
          <View style={styles.linkBox}>
            <Ionicons name="link-outline" size={14} color="#5856D6" />
            <Text style={styles.linkText}>Lié à un registre</Text>
          </View>
        ) : null}

        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
        >
          <Text style={styles.saveBtnText}>
            {saving
              ? "Enregistrement..."
              : id
              ? "METTRE À JOUR"
              : "ENREGISTRER LE RENDEZ-VOUS"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 60 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    marginTop: 20,
    marginBottom: 4,
    color: "#5856D6",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  label: { fontSize: 13, fontWeight: "600", marginTop: 12, color: "#444" },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#fff",
    marginTop: 5,
    fontSize: 15,
  },
  statutRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  statutChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },
  statutChipText: { fontSize: 13, color: "#444", fontWeight: "600" },
  linkBox: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 8,
    backgroundColor: "#eeeefb",
    borderRadius: 8,
  },
  linkText: { fontSize: 12, color: "#5856D6", marginLeft: 4 },
  saveBtn: {
    backgroundColor: "#5856D6",
    padding: 18,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 30,
  },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
