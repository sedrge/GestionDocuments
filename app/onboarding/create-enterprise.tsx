import { createEnterprise } from "@/lib/multitenant";
import MapPickerModal, { LocationResult } from "@/components/MapPickerModal";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

const themes = {
  light: {
    bg: "#F5F5F7",
    card: "#FFFFFF",
    text: "#1C1C1E",
    subText: "#8E8E93",
    primary: "#007AFF",
    border: "#D1D1D6",
  },
  dark: {
    bg: "#121212",
    card: "#1E1E1E",
    text: "#FFFFFF",
    subText: "#A1A1A1",
    primary: "#0A84FF",
    border: "#38383A",
  },
};

export default function CreateEnterpriseScreen() {
  const isDark = true;
  const theme = isDark ? themes.dark : themes.light;
  const [loading, setLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationResult | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);

  const [formData, setFormData] = useState({
    enterpriseName: "",
    enterprisePhone: "",
    enterpriseEmail: "",
    adminFullName: "",
    adminEmail: "",
    adminPhone: "",
    adminPassword: "",
    adminPasswordConfirm: "",
  });

  const handlePickLogo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setLogoUrl(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert("Erreur", "Impossible de charger l'image");
    }
  };

  const handleSubmit = async () => {
    // Seuls l'email et le mot de passe de l'admin sont obligatoires
    if (!formData.enterpriseName.trim()) {
      Alert.alert("Erreur", "Le nom de l'entreprise est requis");
      return;
    }
    if (!formData.adminEmail.includes("@")) {
      Alert.alert("Erreur", "Un email valide pour l'administrateur est requis");
      return;
    }
    if (formData.adminPassword.length < 6) {
      Alert.alert("Erreur", "Le mot de passe doit avoir au moins 6 caractères");
      return;
    }
    if (formData.adminPassword !== formData.adminPasswordConfirm) {
      Alert.alert("Erreur", "Les mots de passe ne correspondent pas");
      return;
    }

    setLoading(true);
    try {
      const result = await createEnterprise({
        name: formData.enterpriseName.trim(),
        phone: formData.enterprisePhone.trim() || undefined,
        email: formData.enterpriseEmail.trim() || undefined,
        logoUrl: logoUrl || undefined,
        adminFullName: formData.adminFullName.trim() || undefined,
        adminEmail: formData.adminEmail.trim(),
        adminPhone: formData.adminPhone.trim() || undefined,
        adminPassword: formData.adminPassword,
        latitude: location?.latitude,
        longitude: location?.longitude,
      });

      if (result.success && result.code) {
        Alert.alert(
          "✅ Entreprise créée !",
          `Votre code unique est : ${result.code}\n\nPartagez ce code avec vos employés.\n\nVotre entreprise sera active une fois approuvée par le super-admin.`,
          [
            {
              text: "Copier le code",
              onPress: () => {
                // TODO: Copy to clipboard
                Alert.alert("Code copié", result.code);
              },
            },
            {
              text: "Se connecter",
              onPress: () => router.replace("/onboarding"),
            },
          ],
        );
      } else {
        Alert.alert(
          "Erreur",
          result.error || "Impossible de créer l'entreprise",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg }]}
      contentContainerStyle={styles.content}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backBtn, { color: theme.primary }]}>
            ← Retour
          </Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>
          Créer une Entreprise
        </Text>
      </View>

      {/* Formulaire */}
      <View
        style={[
          styles.form,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        {/* Entreprise Section */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          📋 Informations de l'Entreprise
        </Text>

        <Text style={[styles.label, { color: theme.text }]}>
          Nom de l'entreprise
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.bg,
              color: theme.text,
              borderColor: theme.border,
            },
          ]}
          placeholder="Ex: TechCorp France"
          placeholderTextColor={theme.subText}
          value={formData.enterpriseName}
          onChangeText={(text) =>
            setFormData({ ...formData, enterpriseName: text })
          }
        />

        <Text style={[styles.label, { color: theme.text }]}>Téléphone</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.bg,
              color: theme.text,
              borderColor: theme.border,
            },
          ]}
          placeholder="+33 1 23 45 67 89"
          placeholderTextColor={theme.subText}
          value={formData.enterprisePhone}
          onChangeText={(text) =>
            setFormData({ ...formData, enterprisePhone: text })
          }
        />

        <Text style={[styles.label, { color: theme.text }]}>Email de l'entreprise (optionnel)</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.bg,
              color: theme.text,
              borderColor: theme.border,
            },
          ]}
          placeholder="contact@monentreprise.com"
          placeholderTextColor={theme.subText}
          keyboardType="email-address"
          autoCapitalize="none"
          value={formData.enterpriseEmail}
          onChangeText={(text) =>
            setFormData({ ...formData, enterpriseEmail: text })
          }
        />

        <Text style={[styles.label, { color: theme.text }]}>Logo (optionnel)</Text>
        <TouchableOpacity
          style={[styles.logoButton, { backgroundColor: theme.primary }]}
          onPress={handlePickLogo}
        >
          <Text style={styles.buttonText}>
            {logoUrl ? "✓ Logo sélectionné" : "Choisir un logo"}
          </Text>
        </TouchableOpacity>

        <Text style={[styles.label, { color: theme.text }]}>
          Localisation de la boutique (optionnel)
        </Text>
        <TouchableOpacity
          style={[
            styles.locationButton,
            {
              backgroundColor: theme.bg,
              borderColor: location ? theme.primary : theme.border,
            },
          ]}
          onPress={() => setShowMapPicker(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.locationIcon}>📍</Text>
          <View style={styles.locationTextContainer}>
            {location ? (
              <>
                <Text style={[styles.locationLabel, { color: theme.primary }]}>
                  Position sélectionnée
                </Text>
                <Text style={[styles.locationCoords, { color: theme.subText }]}>
                  {location.label}
                </Text>
              </>
            ) : (
              <Text style={[styles.locationPlaceholder, { color: theme.subText }]}>
                Appuyez pour choisir sur la carte
              </Text>
            )}
          </View>
          {location && (
            <TouchableOpacity
              onPress={() => setLocation(null)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.locationClear, { color: theme.subText }]}>✕</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        <MapPickerModal
          visible={showMapPicker}
          onClose={() => setShowMapPicker(false)}
          onLocationSelected={(loc) => setLocation(loc)}
          initialLatitude={location?.latitude}
          initialLongitude={location?.longitude}
        />

        {/* Admin Section */}
        <Text
          style={[styles.sectionTitle, { color: theme.text, marginTop: 24 }]}
        >
          👤 Informations de l'Administrateur
        </Text>

        <Text style={[styles.label, { color: theme.text }]}>Nom complet</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.bg,
              color: theme.text,
              borderColor: theme.border,
            },
          ]}
          placeholder="Jean Dupont"
          placeholderTextColor={theme.subText}
          value={formData.adminFullName}
          onChangeText={(text) =>
            setFormData({ ...formData, adminFullName: text })
          }
        />

        <Text style={[styles.label, { color: theme.text }]}>Email</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.bg,
              color: theme.text,
              borderColor: theme.border,
            },
          ]}
          placeholder="jean@techcorp.com"
          placeholderTextColor={theme.subText}
          keyboardType="email-address"
          value={formData.adminEmail}
          onChangeText={(text) =>
            setFormData({ ...formData, adminEmail: text })
          }
        />

        <Text style={[styles.label, { color: theme.text }]}>Téléphone</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.bg,
              color: theme.text,
              borderColor: theme.border,
            },
          ]}
          placeholder="+33 6 12 34 56 78"
          placeholderTextColor={theme.subText}
          value={formData.adminPhone}
          onChangeText={(text) =>
            setFormData({ ...formData, adminPhone: text })
          }
        />

        <Text style={[styles.label, { color: theme.text }]}>Mot de passe</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.bg,
              color: theme.text,
              borderColor: theme.border,
            },
          ]}
          placeholder="••••••••"
          placeholderTextColor={theme.subText}
          secureTextEntry
          value={formData.adminPassword}
          onChangeText={(text) =>
            setFormData({ ...formData, adminPassword: text })
          }
        />

        <Text style={[styles.label, { color: theme.text }]}>
          Confirmer le mot de passe
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.bg,
              color: theme.text,
              borderColor: theme.border,
            },
          ]}
          placeholder="••••••••"
          placeholderTextColor={theme.subText}
          secureTextEntry
          value={formData.adminPasswordConfirm}
          onChangeText={(text) =>
            setFormData({ ...formData, adminPasswordConfirm: text })
          }
        />
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[
          styles.submitButton,
          { backgroundColor: theme.primary, opacity: loading ? 0.6 : 1 },
        ]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Créer l'entreprise</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => router.back()}
        disabled={loading}
      >
        <Text style={[styles.cancelText, { color: theme.primary }]}>
          Annuler
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  backBtn: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
  },
  form: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 16,
    marginTop: 0,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
  },
  input: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    fontSize: 14,
  },
  logoButton: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 16,
    borderWidth: 1,
    gap: 10,
  },
  locationIcon: {
    fontSize: 20,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  locationCoords: {
    fontSize: 12,
    marginTop: 2,
  },
  locationPlaceholder: {
    fontSize: 14,
  },
  locationClear: {
    fontSize: 16,
    paddingHorizontal: 4,
  },
  submitButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  cancelText: {
    fontWeight: "600",
    fontSize: 16,
  },
});
