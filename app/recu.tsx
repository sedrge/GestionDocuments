// app/recu.tsx

import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import SignatureCanvas from "react-native-signature-canvas";
import { nombreEnLettres } from "../lib/nombreEnLettres";
import { supabase } from "../lib/supabase";

// ─── Composant signature ────────────────────────────────────────────────────
const webStyle = `
  .m-signature-pad--footer { display: none; margin: 0px; }
  body, html { width: 100%; height: 100%; overflow: hidden; background-color: #fff; }
  .m-signature-pad { border: none; box-shadow: none; }
`;

interface SignatureBlockProps {
  title: string;
  signatureString: string | null;
  onScrollLock: (locked: boolean) => void;
  onValidate: (sig: string) => void;
  onClear: () => void;
}

function SignatureBlock({
  title,
  signatureString,
  onScrollLock,
  onValidate,
  onClear,
}: SignatureBlockProps) {
  const sigRef = useRef<any>(null);

  return (
    <View style={{ marginTop: 20 }}>
      <Text style={sigStyles.label}>{title}</Text>
      <View style={sigStyles.signatureContainer}>
        <View style={sigStyles.signatureBox}>
          <SignatureCanvas
            ref={sigRef}
            onOK={(sig: string) => {
              onScrollLock(false);
              onValidate(sig);
              Alert.alert("Succès", "Signature capturée !");
            }}
            onBegin={() => onScrollLock(true)}
            onEnd={() => onScrollLock(false)}
            descriptionText=""
            webStyle={webStyle}
          />
        </View>
        <View style={sigStyles.buttonRow}>
          <TouchableOpacity
            onPress={() => {
              sigRef.current?.clearSignature();
              onClear();
            }}
            style={[sigStyles.sigBtn, { backgroundColor: "#ff4444" }]}
          >
            <Text style={sigStyles.btnText}>Effacer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => sigRef.current?.readSignature()}
            style={[sigStyles.sigBtn, { backgroundColor: "#4CAF50" }]}
          >
            <Text style={sigStyles.btnText}>Valider</Text>
          </TouchableOpacity>
        </View>
      </View>
      {signatureString ? (
        <View style={sigStyles.previewContainer}>
          <Text style={{ fontSize: 12, color: "gray" }}>Signature mémorisée ✓</Text>
          <Image
            source={{ uri: signatureString }}
            style={sigStyles.sigPreview}
            resizeMode="contain"
          />
        </View>
      ) : null}
    </View>
  );
}

const sigStyles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: "600", marginTop: 12, color: "#444" },
  signatureContainer: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#000",
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  signatureBox: { width: "100%", height: 200 },
  buttonRow: { flexDirection: "row", height: 50, borderTopWidth: 1, borderColor: "#eee" },
  sigBtn: { flex: 1, justifyContent: "center", alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "bold" },
  previewContainer: {
    alignItems: "center",
    marginTop: 10,
    padding: 10,
    backgroundColor: "#e8f5e9",
    borderRadius: 8,
  },
  sigPreview: { width: 150, height: 80 },
});
// ─────────────────────────────────────────────────────────────────────────────

export default function RecuForm() {
  const {
    dossierId,
    id,
    moto_id,
    prefill_article,
    prefill_couleur,
    prefill_marque,
    prefill_type,
    prefill_chassis,
    prefill_moteur,
    prefill_prix,
  } = useLocalSearchParams();
  const router = useRouter();

  const today = new Date();
  const [jour, setJour] = useState(String(today.getDate()).padStart(2, "0"));
  const [mois, setMois] = useState(String(today.getMonth() + 1).padStart(2, "0"));
  const [annee, setAnnee] = useState(String(today.getFullYear()));

  const [parametres, setParametres] = useState<any>(null);
  const [loadingParams, setLoadingParams] = useState(true);

  const [numeroFacture, setNumeroFacture] = useState("");
  const [sequenceNum, setSequenceNum] = useState(0);
  const [year, setYear] = useState(today.getFullYear());

  const [nomClient, setNomClient] = useState("");
  const [adresseClient, setAdresseClient] = useState("");

  const [article, setArticle] = useState("");
  const [couleur, setCouleur] = useState("");
  const [marque, setMarque] = useState("");
  const [typeMoto, setTypeMoto] = useState("");
  const [chassisNo, setChassisNo] = useState("");
  const [moteurNo, setMoteurNo] = useState("");

  const [quantite, setQuantite] = useState("1");
  const [prixUnitaire, setPrixUnitaire] = useState("");
  const [prixTotal, setPrixTotal] = useState("");
  const [prixTotalLettres, setPrixTotalLettres] = useState("");

  const [signatureVendeur, setSignatureVendeur] = useState<string | null>(null);
  const [signatureClient, setSignatureClient] = useState<string | null>(null);

  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchParametres();
  }, []);

  useEffect(() => {
    if (id) {
      fetchRecu();
    } else if (parametres) {
      generateNumeroFacture(parametres, Number(annee));
      // Préremplissage depuis la vente rapide (params passés par /vente)
      if (prefill_article) setArticle(prefill_article as string);
      if (prefill_couleur) setCouleur(prefill_couleur as string);
      if (prefill_marque)  setMarque(prefill_marque as string);
      if (prefill_type)    setTypeMoto(prefill_type as string);
      if (prefill_chassis) setChassisNo(prefill_chassis as string);
      if (prefill_moteur)  setMoteurNo(prefill_moteur as string);
      if (prefill_prix) {
        setPrixUnitaire(prefill_prix as string);
        recomputeTotal("1", prefill_prix as string);
      }
    }
  }, [parametres]);

  // Quand l'année change (et qu'on est en création), régénérer le numéro
  useEffect(() => {
    if (!id && parametres) {
      const yr = Number(annee);
      if (!isNaN(yr) && yr > 1900) {
        generateNumeroFacture(parametres, yr);
      }
    }
  }, [annee]);

  const fetchParametres = async () => {
    setLoadingParams(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoadingParams(false);
      return;
    }
    const { data } = await supabase
      .from("entreprise_parametres")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    setParametres(data);
    setLoadingParams(false);
  };

  const generateNumeroFacture = async (params: any, yr: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const prefix = (params?.prefix_facture || "XX").toUpperCase();

    // Récupérer la séquence max de l'utilisateur pour cette année
    const { data } = await supabase
      .from("recus")
      .select("sequence_num")
      .eq("user_id", user.id)
      .eq("year", yr)
      .order("sequence_num", { ascending: false })
      .limit(1);

    const nextSeq = data && data.length > 0 ? Number(data[0].sequence_num) + 1 : 1;
    const seqStr = String(nextSeq).padStart(5, "0");
    setNumeroFacture(`${prefix}_${seqStr}_${yr}`);
    setSequenceNum(nextSeq);
    setYear(yr);
  };

  const fetchRecu = async () => {
    const { data, error } = await supabase
      .from("recus")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) {
      Alert.alert("Erreur", "Impossible de charger ce réçu.");
      return;
    }
    setNumeroFacture(data.numero_facture || "");
    setSequenceNum(data.sequence_num || 0);
    setYear(data.year || today.getFullYear());

    if (data.date) {
      const parts = data.date.split("-"); // YYYY-MM-DD
      if (parts.length === 3) {
        setAnnee(parts[0]);
        setMois(parts[1]);
        setJour(parts[2]);
      }
    }

    setNomClient(data.nom_client || "");
    setAdresseClient(data.adresse_client || "");
    setArticle(data.article || "");
    setCouleur(data.couleur || "");
    setMarque(data.marque || "");
    setTypeMoto(data.type || "");
    setChassisNo(data.chassis_no || "");
    setMoteurNo(data.moteur_no || "");
    setQuantite(data.quantite != null ? String(data.quantite) : "1");
    setPrixUnitaire(data.prix_unitaire != null ? String(data.prix_unitaire) : "");
    setPrixTotal(data.prix_total != null ? String(data.prix_total) : "");
    setPrixTotalLettres(data.prix_total_lettres || "");
    setSignatureVendeur(data.signature_vendeur || null);
    setSignatureClient(data.signature_client || null);
  };

  // Recalcul du prix total et de sa version en lettres
  const recomputeTotal = (qtyStr: string, prixStr: string) => {
    const qty = parseFloat(qtyStr.replace(",", "."));
    const pu = parseFloat(prixStr.replace(/\s/g, "").replace(",", "."));
    if (!isNaN(qty) && !isNaN(pu) && qty > 0 && pu > 0) {
      const total = Math.round(qty * pu);
      setPrixTotal(String(total));
      setPrixTotalLettres(nombreEnLettres(total));
    } else {
      setPrixTotal("");
      setPrixTotalLettres("");
    }
  };

  const handleQuantiteChange = (val: string) => {
    setQuantite(val);
    recomputeTotal(val, prixUnitaire);
  };

  const handlePrixUnitaireChange = (val: string) => {
    setPrixUnitaire(val);
    recomputeTotal(quantite, val);
  };

  const handlePrixTotalChange = (val: string) => {
    setPrixTotal(val);
    const num = parseFloat(val.replace(/\s/g, "").replace(",", "."));
    if (!isNaN(num) && num > 0) {
      setPrixTotalLettres(nombreEnLettres(num));
    } else {
      setPrixTotalLettres("");
    }
  };

  const handleSave = async () => {
    if (!parametres || !parametres.nom_entreprise) {
      return Alert.alert(
        "Paramètres manquants",
        "Veuillez d'abord configurer l'entête de votre entreprise dans Paramètres > Entête facture."
      );
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Alert.alert("Erreur", "Utilisateur non connecté");

    if (!nomClient.trim()) return Alert.alert("Erreur", "Nom du client requis.");
    if (!signatureVendeur) return Alert.alert("Erreur", "Signature du vendeur requise.");
    if (!signatureClient) return Alert.alert("Erreur", "Signature du client requise.");

    setSaving(true);

    const jj = jour.padStart(2, "0");
    const mm = mois.padStart(2, "0");
    const aaaa = annee.padStart(4, "0");
    const dateBDD = `${aaaa}-${mm}-${jj}`;
    const yr = Number(aaaa);

    let finalNumero = numeroFacture;
    let finalSeq = sequenceNum;

    if (!id) {
      // Re-générer juste avant l'insert pour éviter les collisions
      const prefix = (parametres.prefix_facture || "XX").toUpperCase();
      const { data: maxData } = await supabase
        .from("recus")
        .select("sequence_num")
        .eq("user_id", user.id)
        .eq("year", yr)
        .order("sequence_num", { ascending: false })
        .limit(1);
      finalSeq = maxData && maxData.length > 0 ? Number(maxData[0].sequence_num) + 1 : 1;
      finalNumero = `${prefix}_${String(finalSeq).padStart(5, "0")}_${yr}`;
    }

    const payload = {
      annee_mois_id: dossierId,
      user_id: user.id,
      numero_facture: finalNumero,
      sequence_num: finalSeq,
      year: yr,
      date: dateBDD,
      nom_client: nomClient,
      adresse_client: adresseClient,
      article,
      couleur,
      marque,
      type: typeMoto,
      chassis_no: chassisNo,
      moteur_no: moteurNo,
      quantite: Number(quantite.replace(",", ".")) || 1,
      prix_unitaire: Number(prixUnitaire.replace(/\s/g, "").replace(",", ".")) || 0,
      prix_total: Number(prixTotal.replace(/\s/g, "").replace(",", ".")) || 0,
      prix_total_lettres: prixTotalLettres,
      signature_vendeur: signatureVendeur,
      signature_client: signatureClient,
    };

    let result;
    if (id) {
      result = await supabase.from("recus").update(payload).eq("id", id);
    } else {
      result = await supabase.from("recus").insert([payload]);
    }
    setSaving(false);

    if (result.error) {
      Alert.alert("Erreur", result.error.message);
    } else {
      // Marquer la moto comme vendue et déduire du stock
      if (moto_id && !id) {
        await supabase
          .from("motos")
          .update({ etat: "vendu" })
          .eq("id", moto_id as string);
      }
      Alert.alert("Succès", `Réçu enregistré ! N° ${finalNumero}`);
      router.back();
    }
  };

  if (loadingParams) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Stack.Screen options={{ title: id ? "Modifier Réçu" : "Nouveau Réçu" }} />
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!parametres || !parametres.nom_entreprise) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
        <Stack.Screen options={{ title: "Réçu" }} />
        <Ionicons name="alert-circle-outline" size={56} color="#FF9500" />
        <Text style={{ fontSize: 16, fontWeight: "700", marginTop: 12, textAlign: "center" }}>
          Paramètres entreprise manquants
        </Text>
        <Text style={{ fontSize: 13, color: "#666", marginTop: 8, textAlign: "center" }}>
          Avant de créer un réçu, configurez l'entête de votre entreprise (nom, préfixe, contacts...).
        </Text>
        <TouchableOpacity
          style={{
            marginTop: 20,
            backgroundColor: "#007AFF",
            paddingHorizontal: 18,
            paddingVertical: 12,
            borderRadius: 8,
          }}
          onPress={() => router.replace("/parametres_entreprise")}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>
            Aller aux paramètres
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#f9f9f9" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={100}
    >
      <Stack.Screen options={{ title: id ? "Modifier Réçu" : "Nouveau Réçu" }} />

      <ScrollView
        scrollEnabled={scrollEnabled}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* ENTÊTE PRÉVISUALISATION */}
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            {parametres.logo_uri ? (
              <Image
                source={{ uri: parametres.logo_uri }}
                style={styles.headerLogo}
                resizeMode="contain"
              />
            ) : (
              <View style={[styles.headerLogo, { backgroundColor: "#f0f0f0" }]} />
            )}
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.headerNom} numberOfLines={1}>
                {parametres.nom_entreprise}
              </Text>
              {!!parametres.sous_titre && (
                <Text style={styles.headerSousTitre}>{parametres.sous_titre}</Text>
              )}
              {!!parametres.telephone && (
                <Text style={styles.headerLigne}>Tél: {parametres.telephone}</Text>
              )}
              {!!parametres.adresse && (
                <Text style={styles.headerLigne}>{parametres.adresse}</Text>
              )}
            </View>
          </View>
          <View style={styles.factureBox}>
            <View style={styles.dateBox}>
              <View style={styles.dateCellGroup}>
                <Text style={styles.dateLabel}>Jour</Text>
                <TextInput
                  value={jour}
                  onChangeText={setJour}
                  style={styles.dateCellInput}
                  keyboardType="numeric"
                  maxLength={2}
                />
              </View>
              <View style={styles.dateCellGroup}>
                <Text style={styles.dateLabel}>Mois</Text>
                <TextInput
                  value={mois}
                  onChangeText={setMois}
                  style={styles.dateCellInput}
                  keyboardType="numeric"
                  maxLength={2}
                />
              </View>
              <View style={styles.dateCellGroup}>
                <Text style={styles.dateLabel}>Année</Text>
                <TextInput
                  value={annee}
                  onChangeText={setAnnee}
                  style={styles.dateCellInput}
                  keyboardType="numeric"
                  maxLength={4}
                />
              </View>
            </View>
          </View>
          <View style={styles.factureNumRow}>
            <Text style={styles.factureNumLabel}>FACTURE N°</Text>
            <Text style={styles.factureNumValue}>{numeroFacture || "—"}</Text>
          </View>
          {!id && (
            <Text style={styles.hint}>
              Le numéro est généré automatiquement. Il sera figé à l'enregistrement.
            </Text>
          )}
        </View>

        {/* CLIENT */}
        <Text style={styles.sectionTitle}>CLIENT</Text>
        <Text style={styles.label}>Nom</Text>
        <TextInput
          value={nomClient}
          onChangeText={setNomClient}
          style={styles.input}
          placeholder="Nom et prénom du client"
        />
        <Text style={styles.label}>Adresse</Text>
        <TextInput
          value={adresseClient}
          onChangeText={setAdresseClient}
          style={styles.input}
          placeholder="Adresse du client"
        />

        {/* ARTICLE */}
        <Text style={styles.sectionTitle}>DÉSIGNATION</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Article (Motos, ...)</Text>
            <TextInput
              value={article}
              onChangeText={setArticle}
              style={styles.input}
              placeholder="Ex: MOTOS"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Couleur</Text>
            <TextInput
              value={couleur}
              onChangeText={setCouleur}
              style={styles.input}
              placeholder="Ex: Noir café"
            />
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Marque</Text>
            <TextInput
              value={marque}
              onChangeText={setMarque}
              style={styles.input}
              placeholder="Ex: Yamaha"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Type</Text>
            <TextInput
              value={typeMoto}
              onChangeText={setTypeMoto}
              style={styles.input}
              placeholder="Ex: Exciter 155"
            />
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>N° Châssis</Text>
            <TextInput
              value={chassisNo}
              onChangeText={setChassisNo}
              style={styles.input}
              placeholder="N° de châssis"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>N° Moteur</Text>
            <TextInput
              value={moteurNo}
              onChangeText={setMoteurNo}
              style={styles.input}
              placeholder="N° de moteur"
            />
          </View>
        </View>

        {/* PRIX */}
        <Text style={styles.sectionTitle}>PRIX</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Quantité</Text>
            <TextInput
              value={quantite}
              onChangeText={handleQuantiteChange}
              style={styles.input}
              keyboardType="numeric"
              placeholder="1"
            />
          </View>
          <View style={{ flex: 1.2 }}>
            <Text style={styles.label}>Prix unitaire (FCFA)</Text>
            <TextInput
              value={prixUnitaire}
              onChangeText={handlePrixUnitaireChange}
              style={styles.input}
              keyboardType="numeric"
              placeholder="Ex: 1470000"
            />
          </View>
          <View style={{ flex: 1.2 }}>
            <Text style={styles.label}>Prix total (FCFA)</Text>
            <TextInput
              value={prixTotal}
              onChangeText={handlePrixTotalChange}
              style={styles.input}
              keyboardType="numeric"
              placeholder="Auto"
            />
          </View>
        </View>
        <Text style={styles.label}>Arrêté à la somme de (en lettres)</Text>
        <TextInput
          value={prixTotalLettres}
          onChangeText={setPrixTotalLettres}
          style={[styles.input, { minHeight: 60, color: "#007AFF" }]}
          placeholder="Sera rempli automatiquement..."
          multiline
        />

        {/* SIGNATURES */}
        <Text style={styles.sectionTitle}>SIGNATURES</Text>
        <SignatureBlock
          title="Signature du Vendeur :"
          signatureString={signatureVendeur}
          onScrollLock={(locked) => setScrollEnabled(!locked)}
          onValidate={setSignatureVendeur}
          onClear={() => setSignatureVendeur(null)}
        />
        <SignatureBlock
          title="Signature du Client :"
          signatureString={signatureClient}
          onScrollLock={(locked) => setScrollEnabled(!locked)}
          onValidate={setSignatureClient}
          onClear={() => setSignatureClient(null)}
        />

        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
        >
          <Text style={styles.saveBtnText}>
            {saving ? "Enregistrement..." : id ? "METTRE À JOUR" : "ENREGISTRER LE RÉÇU"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 60 },

  headerCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  headerRow: { flexDirection: "row", alignItems: "center" },
  headerLogo: { width: 80, height: 60, borderRadius: 4 },
  headerNom: { fontSize: 16, fontWeight: "800", color: "#3d2c66" },
  headerSousTitre: { fontSize: 11, color: "#333", marginTop: 1 },
  headerLigne: { fontSize: 10, color: "#555", marginTop: 1 },

  factureBox: { marginTop: 10, alignItems: "flex-end" },
  dateBox: { flexDirection: "row", gap: 4 },
  dateCellGroup: { alignItems: "center" },
  dateLabel: { fontSize: 10, color: "#666", marginBottom: 2 },
  dateCellInput: {
    width: 50,
    borderWidth: 1,
    borderColor: "#999",
    paddingVertical: 4,
    paddingHorizontal: 6,
    textAlign: "center",
    fontSize: 13,
    backgroundColor: "#fff",
    borderRadius: 4,
  },
  factureNumRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  factureNumLabel: { fontSize: 12, fontWeight: "700", color: "#333" },
  factureNumValue: { fontSize: 14, fontWeight: "800", color: "#007AFF" },
  hint: { fontSize: 10, color: "#888", marginTop: 4, fontStyle: "italic" },

  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    marginTop: 22,
    marginBottom: 4,
    color: "#34C759",
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
  saveBtn: {
    backgroundColor: "#34C759",
    padding: 18,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 30,
  },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
