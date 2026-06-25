import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
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
import { supabase } from "@/lib/supabase";
import { useTenant } from "@/context/TenantContext";
import { useTheme } from "@/context/ThemeContext";
import MapPickerModal, { LocationResult } from "@/components/MapPickerModal";


interface ContactForm {
  description: string;
  whatsapp: string;
  phone1: string;
  phone2: string;
  email: string;
  address: string;
  localisation: string;
  website: string;
}

const EMPTY: ContactForm = {
  description: "",
  whatsapp: "",
  phone1: "",
  phone2: "",
  email: "",
  address: "",
  localisation: "",
  website: "",
};

type Field = {
  key: keyof ContactForm;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  multiline?: boolean;
  keyboard?: "default" | "email-address" | "phone-pad" | "url" | "numeric";
};

const FIELDS: Field[] = [
  {
    key: "description",
    label: "Description / Horaires",
    icon: "document-text-outline",
    placeholder: "Disponible lun.–sam. 8h–18h…",
    multiline: true,
  },
  {
    key: "whatsapp",
    label: "Numéro WhatsApp",
    icon: "logo-whatsapp",
    placeholder: "+229 00 00 00 00",
    keyboard: "phone-pad",
  },
  {
    key: "phone1",
    label: "Téléphone principal (appel / SMS)",
    icon: "call-outline",
    placeholder: "+229 00 00 00 00",
    keyboard: "phone-pad",
  },
  {
    key: "phone2",
    label: "Téléphone secondaire (optionnel)",
    icon: "call-outline",
    placeholder: "+229 00 00 00 00",
    keyboard: "phone-pad",
  },
  {
    key: "email",
    label: "Email",
    icon: "mail-outline",
    placeholder: "contact@monentreprise.com",
    keyboard: "email-address",
  },
  {
    key: "address",
    label: "Adresse physique",
    icon: "location-outline",
    placeholder: "Cotonou, Bénin…",
    multiline: true,
  },
  {
    key: "website",
    label: "Site web",
    icon: "globe-outline",
    placeholder: "https://monsite.com",
    keyboard: "url",
  },
];

export default function AdminContactScreen() {
  const { theme } = useTheme();
  const { tenant } = useTenant();
  const enterpriseId = tenant?.enterprise_id ?? null;

  const [form, setForm] = useState<ContactForm>(EMPTY);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);

  useEffect(() => {
    if (!enterpriseId) {
      setLoading(false);
      return;
    }
    supabase
      .from("enterprise_contacts")
      .select("*")
      .eq("enterprise_id", enterpriseId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setExistingId(data.id);
          setForm({
            description: data.description ?? "",
            whatsapp: data.whatsapp ?? "",
            phone1: data.phone1 ?? "",
            phone2: data.phone2 ?? "",
            email: data.email ?? "",
            address: data.address ?? "",
            localisation: data.localisation ?? "",
            website: data.website ?? "",
          });
        }
        setLoading(false);
      });
  }, [enterpriseId]);

  const set = (key: keyof ContactForm) => (val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSave = async () => {
    if (!enterpriseId) {
      Alert.alert("Erreur", "Aucune entreprise associée à ce compte.");
      return;
    }
    setSaving(true);

    const payload = {
      enterprise_id: enterpriseId,
      description: form.description.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      phone1: form.phone1.trim() || null,
      phone2: form.phone2.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      localisation: form.localisation.trim() || null,
      website: form.website.trim() || null,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (existingId) {
      ({ error } = await supabase
        .from("enterprise_contacts")
        .update(payload)
        .eq("id", existingId));
    } else {
      const res = await supabase
        .from("enterprise_contacts")
        .insert(payload)
        .select("id")
        .single();
      error = res.error;
      if (res.data) setExistingId(res.data.id);
    }

    setSaving(false);
    if (error) {
      Alert.alert("Erreur", error.message);
    } else {
      Alert.alert("✅ Succès", "Contacts enregistrés. Les clients les verront immédiatement.");
    }
  };

  const handleDelete = () => {
    if (!existingId) return;
    Alert.alert(
      "Supprimer les contacts",
      "Voulez-vous vraiment supprimer toutes les informations de contact de cette entreprise ?",
      [
        { text: "Annuler" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase
              .from("enterprise_contacts")
              .delete()
              .eq("id", existingId);
            if (error) {
              Alert.alert("Erreur", error.message);
            } else {
              setExistingId(null);
              setForm(EMPTY);
              Alert.alert("Supprimé", "Les contacts ont été supprimés.");
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!enterpriseId) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <Ionicons name="business-outline" size={48} color={theme.subText} />
        <Text style={[styles.noEntText, { color: theme.subText }]}>
          Aucune entreprise associée à ce compte.
        </Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: theme.primary, marginTop: 16 }}>← Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.bg }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
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
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              Contacts de l'entreprise
            </Text>
            <Text style={[styles.headerSub, { color: theme.subText }]}>
              Visibles par les clients dans le catalogue
            </Text>
          </View>
          {existingId && (
            <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            </TouchableOpacity>
          )}
        </View>

        {/* Info box */}
        <View
          style={[
            styles.infoBox,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={theme.primary}
          />
          <Text style={[styles.infoText, { color: theme.subText }]}>
            Quand un client clique sur{" "}
            <Text style={{ color: theme.text, fontWeight: "600" }}>
              "Contacter"
            </Text>{" "}
            sur une de vos publications, ce sont ces informations qui
            s'afficheront.
          </Text>
        </View>

        {/* Champs */}
        <View style={styles.fieldsContainer}>
          {FIELDS.map((f) => (
            <View key={f.key} style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Ionicons name={f.icon} size={15} color={theme.subText} />
                <Text style={[styles.label, { color: theme.subText }]}>
                  {f.label}
                </Text>
              </View>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.card,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                  f.multiline && styles.inputMultiline,
                ]}
                placeholder={f.placeholder}
                placeholderTextColor={theme.border}
                value={form[f.key]}
                onChangeText={set(f.key)}
                multiline={f.multiline}
                keyboardType={f.keyboard ?? "default"}
                autoCapitalize="none"
                textAlignVertical={f.multiline ? "top" : "center"}
              />
            </View>
          ))}

          {/* Champ GPS via carte */}
          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Ionicons name="navigate-outline" size={15} color={theme.subText} />
              <Text style={[styles.label, { color: theme.subText }]}>
                Position GPS
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.input,
                styles.gpsBtn,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
              onPress={() => setMapVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={form.localisation ? "location" : "map-outline"}
                size={18}
                color={form.localisation ? "#FF6B00" : theme.subText}
              />
              <Text
                style={[
                  styles.gpsBtnText,
                  { color: form.localisation ? theme.text : theme.subText },
                ]}
                numberOfLines={1}
              >
                {form.localisation || "Touchez pour sélectionner sur la carte"}
              </Text>
              {form.localisation ? (
                <TouchableOpacity
                  onPress={() => set("localisation")("")}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={18} color={theme.subText} />
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>
          </View>
        </View>

        <MapPickerModal
          visible={mapVisible}
          onClose={() => setMapVisible(false)}
          onLocationSelected={(loc: LocationResult) => {
            set("localisation")(`${loc.latitude.toFixed(6)},${loc.longitude.toFixed(6)}`);
          }}
          initialLatitude={
            form.localisation
              ? parseFloat(form.localisation.split(",")[0]) || 12.3647
              : 12.3647
          }
          initialLongitude={
            form.localisation
              ? parseFloat(form.localisation.split(",")[1]) || -1.533
              : -1.533
          }
        />

        {/* Bouton Enregistrer */}
        <TouchableOpacity
          style={[
            styles.saveBtn,
            { backgroundColor: theme.primary, opacity: saving ? 0.7 : 1 },
          ]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={styles.saveBtnText}>Enregistrer les contacts</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  noEntText: { fontSize: 15, textAlign: "center", marginTop: 16 },
  content: { paddingBottom: 48 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  deleteBtn: { padding: 8 },
  headerTitle: { fontSize: 17, fontWeight: "bold" },
  headerSub: { fontSize: 12, marginTop: 2 },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    margin: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoText: { flex: 1, fontSize: 13, lineHeight: 20 },
  fieldsContainer: { paddingHorizontal: 16 },
  fieldGroup: { marginBottom: 18 },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  label: { fontSize: 13, fontWeight: "500" },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  inputMultiline: { height: 80 },
  gpsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 13,
  },
  gpsBtnText: { flex: 1, fontSize: 14 },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 14,
    paddingVertical: 15,
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
