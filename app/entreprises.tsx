import { Stack } from "expo-router";
import { useEffect, useState } from "react";
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
import { supabase } from "../lib/supabase";
import {
    createEntreprise,
    createInvitation,
    getCurrentEntrepriseMembership,
    isSuperAdmin,
    setActiveEntrepriseId,
} from "../lib/tenant";

export default function EntreprisesScreen() {
  const [loading, setLoading] = useState(true);
  const [isSuper, setIsSuper] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);
  const [membership, setMembership] = useState<any>(null);
  const [companyName, setCompanyName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "user">("user");
  const [lastToken, setLastToken] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const superAdmin = await isSuperAdmin();
    setIsSuper(superAdmin);

    if (superAdmin) {
      const { data, error } = await supabase
        .from("entreprises")
        .select("id, nom, is_active, created_at");
      if (error) {
        Alert.alert("Erreur", error.message);
      } else {
        setCompanies(data || []);
      }
    }

    const membershipRow = await getCurrentEntrepriseMembership();
    setMembership(membershipRow);
    setLoading(false);
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from("entreprises")
      .update({ is_active: !isActive })
      .eq("id", id);
    if (error) return Alert.alert("Erreur", error.message);
    fetchData();
  };

  const handleSelectCompany = async (id: string) => {
    await setActiveEntrepriseId(id);
    Alert.alert(
      "Entreprise sélectionnée",
      "Vous pouvez maintenant agir comme cette entreprise.",
    );
  };

  const handleCreateCompany = async () => {
    if (!companyName.trim()) {
      return Alert.alert("Erreur", "Le nom de l’entreprise est requis.");
    }
    if (!adminEmail.includes("@")) {
      return Alert.alert("Erreur", "Email admin invalide.");
    }
    const { data: user, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return Alert.alert("Erreur", "Impossible de récupérer le compte actif.");
    }

    const { data, error } = await createEntreprise(companyName.trim(), user.id);
    if (error || !data) {
      return Alert.alert(
        "Erreur création entreprise",
        error?.message || "Impossible de créer l’entreprise.",
      );
    }

    const invite = await createInvitation(
      data.id,
      adminEmail,
      "admin",
      user.id,
    );
    if (invite.error) {
      return Alert.alert("Erreur invitation", invite.error.message);
    }
    setCompanyName("");
    setAdminEmail("");
    setLastToken(invite.token);
    fetchData();
    Alert.alert(
      "Entreprise créée",
      `Invitation admin créée. Code : ${invite.token}`,
    );
  };

  const handleInviteUser = async () => {
    if (!inviteEmail.includes("@")) {
      return Alert.alert("Erreur", "Email invalide pour l’invitation.");
    }
    if (!membership?.entreprise_id) {
      return Alert.alert("Erreur", "Aucune entreprise sélectionnée.");
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return Alert.alert("Erreur", "Utilisateur non connecté.");
    }
    const invite = await createInvitation(
      membership.entreprise_id,
      inviteEmail,
      inviteRole,
      user.id,
    );
    if (invite.error) {
      return Alert.alert("Erreur création invitation", invite.error.message);
    }
    setInviteEmail("");
    setLastToken(invite.token);
    Alert.alert(
      "Invitation créée",
      `Copiez le code et envoyez-le à l’utilisateur : ${invite.token}`,
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: "Entreprises" }} />

      {isSuper ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Super-admin : Gestion des entreprises
          </Text>
          {companies.map((company) => (
            <View key={company.id} style={styles.card}>
              <Text style={styles.companyName}>{company.nom}</Text>
              <Text>
                Status : {company.is_active ? "Active" : "Désactivée"}
              </Text>
              <Text>
                Créée le {new Date(company.created_at).toLocaleDateString()}
              </Text>
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={styles.smallButton}
                  onPress={() =>
                    handleToggleActive(company.id, company.is_active)
                  }
                >
                  <Text style={styles.buttonText}>
                    {company.is_active ? "Désactiver" : "Activer"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.smallButton}
                  onPress={() => handleSelectCompany(company.id)}
                >
                  <Text style={styles.buttonText}>Agir comme entreprise</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Créer une nouvelle entreprise
            </Text>
            <TextInput
              value={companyName}
              onChangeText={setCompanyName}
              placeholder="Nom de l'entreprise"
              style={styles.input}
            />
            <TextInput
              value={adminEmail}
              onChangeText={setAdminEmail}
              placeholder="Email admin de l'entreprise"
              keyboardType="email-address"
              style={styles.input}
            />
            <TouchableOpacity
              style={styles.mainButton}
              onPress={handleCreateCompany}
            >
              <Text style={styles.buttonText}>
                Créer entreprise + invitation admin
              </Text>
            </TouchableOpacity>
            {lastToken ? (
              <Text style={styles.tokenText}>Dernier code : {lastToken}</Text>
            ) : null}
          </View>
        </View>
      ) : (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mon entreprise</Text>
          {!membership ? (
            <Text>
              Vous n'êtes affilié à aucune entreprise. Contactez le super-admin.
            </Text>
          ) : (
            <>
              <Text style={styles.companyName}>
                {membership.entreprises?.nom}
              </Text>
              <Text>
                Status :{" "}
                {membership.entreprises?.is_active ? "Active" : "Désactivée"}
              </Text>
              <Text>Rôle : {membership.role}</Text>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Inviter un utilisateur</Text>
                <TextInput
                  value={inviteEmail}
                  onChangeText={setInviteEmail}
                  placeholder="Email de l'utilisateur"
                  keyboardType="email-address"
                  style={styles.input}
                />
                <Text style={styles.label}>Rôle</Text>
                <View style={styles.roleRow}>
                  {(["user", "admin"] as const).map((roleOption) => (
                    <TouchableOpacity
                      key={roleOption}
                      style={[
                        styles.roleButton,
                        inviteRole === roleOption && styles.roleButtonActive,
                      ]}
                      onPress={() => setInviteRole(roleOption)}
                    >
                      <Text
                        style={[
                          styles.roleButtonText,
                          inviteRole === roleOption &&
                            styles.roleButtonTextActive,
                        ]}
                      >
                        {roleOption.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  style={styles.mainButton}
                  onPress={handleInviteUser}
                >
                  <Text style={styles.buttonText}>Créer une invitation</Text>
                </TouchableOpacity>
                {lastToken ? (
                  <Text style={styles.tokenText}>
                    Dernier code : {lastToken}
                  </Text>
                ) : null}
              </View>
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#fff",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  companyName: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 12,
  },
  smallButton: {
    backgroundColor: "#007AFF",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  mainButton: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    padding: 15,
    alignItems: "center",
  },
  tokenText: {
    marginTop: 12,
    color: "#333",
  },
  label: {
    marginBottom: 8,
    fontWeight: "600",
  },
  roleRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  roleButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ccc",
    alignItems: "center",
  },
  roleButtonActive: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  roleButtonText: {
    color: "#333",
    fontWeight: "600",
  },
  roleButtonTextActive: {
    color: "#fff",
  },
});
