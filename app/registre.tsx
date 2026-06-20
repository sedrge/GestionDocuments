// app/registre.tsx
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
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

// ─── Composant signature isolé ───────────────────────────────────────────────
interface SignatureBlockProps {
  title: string;
  signatureString: string | null;
  onScrollLock: (locked: boolean) => void;
  onValidate: (sig: string) => void;
  onClear: () => void;
}

const webStyle = `
  .m-signature-pad--footer { display: none; margin: 0px; }
  body, html { width: 100%; height: 100%; overflow: hidden; background-color: #fff; }
  .m-signature-pad { border: none; box-shadow: none; }
`;

function SignatureBlock({
  title,
  signatureString,
  onScrollLock,
  onValidate,
  onClear,
}: SignatureBlockProps) {
  const sigRef = useRef<any>(null);

  return (
    <View style={{ marginTop: 10 }}>
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

// ─── Composant photo recto/verso ─────────────────────────────────────────────
interface PhotoPickerProps {
  label: string;
  uri: string | null;
  aspect: [number, number];
  onPick: () => void;
  onClear: () => void;
}

function PhotoPicker({ label, uri, aspect, onPick, onClear }: PhotoPickerProps) {
  const ratio = aspect[0] / aspect[1];
  return (
    <View style={photoStyles.container}>
      <Text style={photoStyles.label}>{label}</Text>
      <TouchableOpacity
        onPress={onPick}
        style={[photoStyles.zone, { aspectRatio: ratio }]}
        activeOpacity={0.7}
      >
        {uri ? (
          <Image source={{ uri }} style={photoStyles.preview} resizeMode="cover" />
        ) : (
          <View style={photoStyles.empty}>
            <View style={photoStyles.frameGuide} />
            <Ionicons name="camera-outline" size={32} color="#999" />
            <Text style={photoStyles.emptyText}>Toucher pour ajouter</Text>
            <Text style={photoStyles.hintText}>
              Cadrez la pièce dans le repère, puis recadrez après la prise.
            </Text>
          </View>
        )}
      </TouchableOpacity>
      {uri ? (
        <View style={photoStyles.actionsRow}>
          <TouchableOpacity onPress={onPick} style={photoStyles.actionBtn}>
            <Ionicons name="refresh" size={14} color="#fff" />
            <Text style={photoStyles.actionText}>Remplacer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onClear}
            style={[photoStyles.actionBtn, { backgroundColor: "#ff4444" }]}
          >
            <Ionicons name="trash-outline" size={14} color="#fff" />
            <Text style={photoStyles.actionText}>Supprimer</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

// ─── Composant Checkbox simple ───────────────────────────────────────────────
function Checkbox({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <TouchableOpacity
      style={styles.checkboxRow}
      onPress={() => onChange(!value)}
      activeOpacity={0.7}
    >
      <View style={[styles.checkbox, value && styles.checkboxChecked]}>
        {value ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
      </View>
      <Text style={styles.checkboxLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Formats ─────────────────────────────────────────────────────────────────
const ID_ASPECT: [number, number] = [85, 54];
const PASSPORT_ASPECT: [number, number] = [88, 125];
const CERT_ASPECT: [number, number] = [21, 29.7]; // A4 portrait

// ─── Composant principal ─────────────────────────────────────────────────────
export default function RegistreForm() {
  const { dossierId, id } = useLocalSearchParams();
  const router = useRouter();

  const getTodayDateFR = () => {
    const now = new Date();
    const j = String(now.getDate()).padStart(2, "0");
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const a = now.getFullYear();
    return `${j}/${m}/${a}`;
  };

  const [date, setDate] = useState(getTodayDateFR());
  const [nomPrenom, setNomPrenom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [nomDemarcheur, setNomDemarcheur] = useState("");
  const [telephoneDemarcheur, setTelephoneDemarcheur] = useState("");
  const [numeroSerie, setNumeroSerie] = useState("");
  const [immatriculation, setImmatriculation] = useState("");
  const [provenance, setProvenance] = useState("");
  const [nature, setNature] = useState("");
  const [nomSignateur, setNomSignateur] = useState("");

  // Statut récupération
  const [motoRecuperee, setMotoRecuperee] = useState(false);
  const [documentsRecuperes, setDocumentsRecuperes] = useState(false);
  const [typesDocuments, setTypesDocuments] = useState("");

  // Signatures
  const [signatureMoto, setSignatureMoto] = useState<string | null>(null);
  const [signatureDocuments, setSignatureDocuments] = useState<string | null>(null);

  // Photos pièces
  const [clientIdType, setClientIdType] = useState<"cnib" | "passport">("cnib");
  const [clientIdRecto, setClientIdRecto] = useState<string | null>(null);
  const [clientIdVerso, setClientIdVerso] = useState<string | null>(null);
  const [carteGriseRecto, setCarteGriseRecto] = useState<string | null>(null);
  const [carteGriseVerso, setCarteGriseVerso] = useState<string | null>(null);
  const [certificatVente, setCertificatVente] = useState<string | null>(null);

  const [scrollEnabled, setScrollEnabled] = useState(true);

  // Auto-création du reçu correspondant
  const [autoCreerRecu, setAutoCreerRecu] = useState(true);
  const [matchedMoto, setMatchedMoto] = useState<any>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  // Auto-création du rendez-vous quand moto ou documents non récupérés
  const [autoCreerRDV, setAutoCreerRDV] = useState(true);
  const [rdvDate, setRdvDate] = useState("");
  const [rdvHeure, setRdvHeure] = useState("");
  const [nomEntreprise, setNomEntreprise] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("entreprise_parametres")
        .select("nom_entreprise")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.nom_entreprise) setNomEntreprise(data.nom_entreprise);
    })();
  }, []);

  // Motif du RDV calculé en fonction de ce qui n'a pas été récupéré
  const computeMotifRDV = (): string => {
    if (!motoRecuperee && !documentsRecuperes) {
      return "Récupération de moto et des documents restants";
    }
    if (!motoRecuperee) return "Récupération de moto";
    if (!documentsRecuperes) return "Récupération des documents restants";
    return "";
  };

  const besoinRDV = !motoRecuperee || !documentsRecuperes;

  const lookupMotoFromDB = async (chassis: string, immat: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const c = chassis.trim();
    const i = immat.trim();
    if (!c && !i) return null;

    const orClauses: string[] = [];
    if (c) orClauses.push(`numero_chassis.eq.${c}`);
    if (i) orClauses.push(`immatriculation.eq.${i}`);

    const { data } = await supabase
      .from("motos")
      .select("*")
      .eq("user_id", user.id)
      .or(orClauses.join(","))
      .limit(1);

    return data && data.length > 0 ? data[0] : null;
  };

  const handleMotoLookup = async () => {
    if (id) return; // En édition, on ne réécrase pas les valeurs existantes
    if (!numeroSerie.trim() && !immatriculation.trim()) return;
    if (lookupLoading) return;

    setLookupLoading(true);
    const moto = await lookupMotoFromDB(numeroSerie, immatriculation);
    setLookupLoading(false);

    if (!moto) return;

    setMatchedMoto(moto);

    // Pré-remplit uniquement les champs vides — on ne réécrase rien
    if (!immatriculation.trim() && moto.immatriculation) {
      setImmatriculation(moto.immatriculation);
    }
    if (!numeroSerie.trim() && moto.numero_chassis) {
      setNumeroSerie(moto.numero_chassis);
    }

    const desc = [moto.marque, moto.modele || moto.type, moto.couleur]
      .filter(Boolean)
      .join(" ");
    Alert.alert(
      "Moto reconnue",
      `${desc || "Moto trouvée dans la base"}.\nLes infos seront utilisées pour le réçu auto-créé.`,
    );
  };

  const pickPhoto = (
    setter: (uri: string | null) => void,
    aspect: [number, number] = ID_ASPECT,
  ) => {
    Alert.alert("Ajouter une photo", "Choisissez une source", [
      {
        text: "Caméra",
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== "granted") {
            return Alert.alert("Permission refusée", "Accès caméra refusé.");
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect,
            quality: 0.5,
            base64: true,
          });
          if (!result.canceled && result.assets?.[0]?.base64) {
            setter(`data:image/jpeg;base64,${result.assets[0].base64}`);
          }
        },
      },
      {
        text: "Galerie",
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect,
            quality: 0.5,
            base64: true,
          });
          if (!result.canceled && result.assets?.[0]?.base64) {
            setter(`data:image/jpeg;base64,${result.assets[0].base64}`);
          }
        },
      },
      { text: "Annuler", style: "cancel" },
    ]);
  };

  useEffect(() => {
    if (id) fetchRegistre();
  }, [id]);

  const fetchRegistre = async () => {
    const { data, error } = await supabase
      .from("registres")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      Alert.alert("Erreur", "Impossible de charger ce registre.");
      return;
    }

    if (data.date) {
      const [a, m, j] = data.date.split("-");
      setDate(`${j}/${m}/${a}`);
    }

    setNomPrenom(data.nom_prenom || "");
    setTelephone(data.telephone || "");
    setNomDemarcheur(data.nom_demarcheur || "");
    setTelephoneDemarcheur(data.telephone_demarcheur || "");
    setNumeroSerie(data.numero_serie || "");
    setImmatriculation(data.immatriculation || "");
    setProvenance(data.provenance || "");
    setNature(data.nature || "");
    setNomSignateur(data.nom_signateur || "");

    setMotoRecuperee(!!data.moto_recuperee);
    setDocumentsRecuperes(!!data.documents_recuperes);
    setTypesDocuments(data.types_documents || "");

    setSignatureMoto(data.signature_uri || null);
    setSignatureDocuments(data.signature_documents_uri || null);

    setClientIdType(data.client_id_type === "passport" ? "passport" : "cnib");
    setClientIdRecto(data.client_id_recto || null);
    setClientIdVerso(data.client_id_verso || null);
    setCarteGriseRecto(data.carte_grise_recto || null);
    setCarteGriseVerso(data.carte_grise_verso || null);
    setCertificatVente(data.certificat_vente || null);
  };

  const handleSave = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return Alert.alert("Erreur", "Utilisateur non connecté");
    if (!nomPrenom.trim()) return Alert.alert("Erreur", "Nom & prénom requis.");

    if (motoRecuperee && !signatureMoto) {
      return Alert.alert(
        "Erreur",
        "Vous avez coché « Moto récupérée » : veuillez valider la signature correspondante.",
      );
    }
    if (documentsRecuperes && !typesDocuments.trim()) {
      return Alert.alert(
        "Erreur",
        "Vous avez coché « Documents récupérés » : veuillez préciser le(s) type(s) de document(s).",
      );
    }
    if (documentsRecuperes && !signatureDocuments) {
      return Alert.alert(
        "Erreur",
        "Vous avez coché « Documents récupérés » : veuillez valider la signature correspondante.",
      );
    }

    let dateBDD = date;
    const parts = date.split("/");
    if (parts.length === 3) {
      dateBDD = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }

    const registreData = {
      date: dateBDD,
      nom_prenom: nomPrenom,
      telephone,
      nom_demarcheur: nomDemarcheur,
      telephone_demarcheur: telephoneDemarcheur,
      numero_serie: numeroSerie,
      immatriculation,
      provenance,
      nature,
      nom_signateur: nomSignateur,
      moto_recuperee: motoRecuperee,
      documents_recuperes: documentsRecuperes,
      types_documents: documentsRecuperes ? typesDocuments : null,
      signature_uri: motoRecuperee ? signatureMoto : null,
      signature_documents_uri: documentsRecuperes ? signatureDocuments : null,
      client_id_type: clientIdType,
      client_id_recto: clientIdRecto,
      client_id_verso: clientIdType === "passport" ? null : clientIdVerso,
      carte_grise_recto: carteGriseRecto,
      carte_grise_verso: carteGriseVerso,
      certificat_vente: certificatVente,
      annee_mois_id: dossierId,
      user_id: user.id,
    };

    // Validation rendez-vous : si la moto ou les documents ne sont pas récupérés
    // et que l'auto-création est cochée, on exige au moins la date
    if (!id && besoinRDV && autoCreerRDV && !rdvDate.trim()) {
      return Alert.alert(
        "Rendez-vous requis",
        "Veuillez préciser la date du rendez-vous pour la récupération (ou décochez la création automatique du rendez-vous).",
      );
    }

    let result;
    let insertedRegistreId: string | null = id ? String(id) : null;
    if (id) {
      result = await supabase
        .from("registres")
        .update(registreData)
        .eq("id", id);
    } else {
      result = await supabase
        .from("registres")
        .insert([registreData])
        .select("id")
        .single();
      if ((result as any).data?.id) {
        insertedRegistreId = (result as any).data.id;
      }
    }

    if (result.error) {
      Alert.alert("Erreur", result.error.message);
      return;
    }

    // Auto-création du reçu correspondant (uniquement en création de registre)
    let recuMessage = "";
    if (!id && autoCreerRecu) {
      const recuRes = await autoCreateRecu(user.id, dateBDD);
      if (recuRes.ok) {
        recuMessage = `\nRéçu auto-créé : ${recuRes.numero}. À compléter dans la partie Réçus (signatures, prix, etc.).`;
      } else if (recuRes.warning) {
        recuMessage = `\n${recuRes.warning}`;
      }
    }

    // Auto-création du rendez-vous (uniquement en création de registre et si besoin)
    let rdvMessage = "";
    if (!id && besoinRDV && autoCreerRDV) {
      const rdvRes = await autoCreateRDV(user.id, insertedRegistreId);
      if (rdvRes.ok) {
        rdvMessage = `\nRendez-vous programmé : ${rdvRes.date}${rdvRes.heure ? " à " + rdvRes.heure : ""}.`;
      } else if (rdvRes.warning) {
        rdvMessage = `\n${rdvRes.warning}`;
      }
    }

    Alert.alert("Succès", `Enregistrement réussi !${recuMessage}${rdvMessage}`);
    router.back();
  };

  // Crée un rendez-vous lié au registre pour la récupération restante
  const autoCreateRDV = async (
    userId: string,
    registreLinkId: string | null,
  ): Promise<{ ok: boolean; date?: string; heure?: string; warning?: string }> => {
    if (!rdvDate.trim()) {
      return { ok: false, warning: "Rendez-vous non créé : date manquante." };
    }

    // JJ/MM/AAAA -> AAAA-MM-JJ
    let dateBDD = rdvDate;
    const parts = rdvDate.split("/");
    if (parts.length === 3) {
      dateBDD = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }

    const motif = computeMotifRDV() || "Récupération";
    const lieuFinal = nomEntreprise || "Siège de l'entreprise";

    const payload = {
      user_id: userId,
      date_rdv: dateBDD,
      heure_rdv: rdvHeure.trim() || null,
      lieu: lieuFinal,
      nom_prenom: nomPrenom.trim(),
      telephone: telephone.trim() || null,
      motif,
      description: typesDocuments.trim()
        ? `Documents concernés : ${typesDocuments.trim()}`
        : null,
      statut: "en_attente",
      registre_id: registreLinkId,
    };

    const { error } = await supabase.from("rendez_vous").insert([payload]);
    if (error) {
      return { ok: false, warning: `Rendez-vous non créé : ${error.message}` };
    }
    return { ok: true, date: rdvDate, heure: rdvHeure };
  };

  // Cherche (ou crée) le dossier annees_mois_recu portant le même nom que le dossier registre courant
  const findOrCreateRecuDossier = async (userId: string): Promise<string | null> => {
    // Récupère le nom du dossier registre actuel
    const { data: dossierRegistre } = await supabase
      .from("annees_mois")
      .select("nom")
      .eq("id", dossierId)
      .maybeSingle();

    const nomDossier = dossierRegistre?.nom?.trim();
    if (!nomDossier) return null;

    // Existe déjà côté reçus ?
    const { data: existing } = await supabase
      .from("annees_mois_recu")
      .select("id")
      .eq("user_id", userId)
      .eq("nom", nomDossier)
      .maybeSingle();

    if (existing?.id) return existing.id;

    // Sinon on crée
    const { data: created, error } = await supabase
      .from("annees_mois_recu")
      .insert([{ nom: nomDossier, user_id: userId }])
      .select("id")
      .single();

    if (error || !created) return null;
    return created.id;
  };

  const autoCreateRecu = async (
    userId: string,
    dateBDD: string,
  ): Promise<{ ok: boolean; numero?: string; warning?: string }> => {
    // Vérifie les paramètres entreprise (préfixe facture obligatoire)
    const { data: parametres } = await supabase
      .from("entreprise_parametres")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!parametres || !parametres.nom_entreprise) {
      return {
        ok: false,
        warning:
          "Réçu non créé : configurez d'abord l'entête de votre entreprise (Paramètres > Entête).",
      };
    }

    // Si la recherche moto n'avait pas été déclenchée (ex. l'utilisateur a tout tapé manuellement),
    // on tente une dernière fois ici
    let moto = matchedMoto;
    if (!moto) {
      moto = await lookupMotoFromDB(numeroSerie, immatriculation);
    }

    // Dossier reçus correspondant
    const recuDossierId = await findOrCreateRecuDossier(userId);
    if (!recuDossierId) {
      return {
        ok: false,
        warning: "Réçu non créé : dossier reçus introuvable.",
      };
    }

    // Numéro de facture
    const yr = Number(dateBDD.split("-")[0]);
    const prefix = (parametres.prefix_facture || "XX").toUpperCase();
    const { data: maxData } = await supabase
      .from("recus")
      .select("sequence_num")
      .eq("user_id", userId)
      .eq("year", yr)
      .order("sequence_num", { ascending: false })
      .limit(1);
    const seq =
      maxData && maxData.length > 0 ? Number(maxData[0].sequence_num) + 1 : 1;
    const numero = `${prefix}_${String(seq).padStart(5, "0")}_${yr}`;

    // Adresse client : le formulaire reçu n'a pas de champ téléphone, on l'injecte ici comme amorce
    const adresseClient = telephone.trim() ? `Tél: ${telephone.trim()}` : "";

    const prixUnitaire = moto?.prix_vente ? Number(moto.prix_vente) : 0;
    const prixTotal = prixUnitaire; // quantité 1 par défaut
    const prixLettres = prixTotal > 0 ? nombreEnLettres(prixTotal) : "";

    const payload = {
      annee_mois_id: recuDossierId,
      user_id: userId,
      numero_facture: numero,
      sequence_num: seq,
      year: yr,
      date: dateBDD,
      nom_client: nomPrenom,
      adresse_client: adresseClient,
      article: moto?.categorie || "MOTOS",
      couleur: moto?.couleur || "",
      marque: moto?.marque || "",
      type: moto?.type || moto?.modele || "",
      chassis_no: moto?.numero_chassis || numeroSerie || "",
      moteur_no: moto?.numero_moteur || "",
      quantite: 1,
      prix_unitaire: prixUnitaire,
      prix_total: prixTotal,
      prix_total_lettres: prixLettres,
      signature_vendeur: null,
      signature_client: null,
    };

    const { error } = await supabase.from("recus").insert([payload]);
    if (error) {
      return { ok: false, warning: `Réçu non créé : ${error.message}` };
    }
    return { ok: true, numero };
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#f9f9f9" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={100}
    >
      <Stack.Screen
        options={{ title: id ? "Modifier Registre" : "Ajouter Registre" }}
      />

      <ScrollView
        scrollEnabled={scrollEnabled}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Date (JJ/MM/AAAA)</Text>
            <TextInput
              value={date}
              onChangeText={setDate}
              style={styles.input}
              placeholder="31/12/2026"
              keyboardType="numeric"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Téléphone du client</Text>
            <TextInput
              value={telephone}
              onChangeText={setTelephone}
              style={styles.input}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        <Text style={styles.label}>Nom & Prénom du client</Text>
        <TextInput
          value={nomPrenom}
          onChangeText={setNomPrenom}
          style={styles.input}
          placeholder="Ex: Jean Dupont"
        />

        {/* Démarcheur */}
        <Text style={styles.sectionTitle}>DÉMARCHEUR</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Nom du démarcheur</Text>
            <TextInput
              value={nomDemarcheur}
              onChangeText={setNomDemarcheur}
              style={styles.input}
              placeholder="Ex: M. Ouédraogo"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Téléphone démarcheur</Text>
            <TextInput
              value={telephoneDemarcheur}
              onChangeText={setTelephoneDemarcheur}
              style={styles.input}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        {/* Moto */}
        <Text style={styles.sectionTitle}>MOTO</Text>
        {!id && (
          <Text style={styles.hintInfo}>
            Renseignez le n° de série ou l'immatriculation : si la moto existe déjà dans votre base,
            les autres infos seront récupérées automatiquement.
          </Text>
        )}
        <Text style={styles.label}>
          N° Série Moto{lookupLoading ? " (recherche...)" : ""}
        </Text>
        <TextInput
          value={numeroSerie}
          onChangeText={setNumeroSerie}
          onBlur={handleMotoLookup}
          style={styles.input}
        />

        <Text style={styles.label}>Immatriculation</Text>
        <TextInput
          value={immatriculation}
          onChangeText={setImmatriculation}
          onBlur={handleMotoLookup}
          style={styles.input}
        />
        {matchedMoto && (
          <Text style={styles.hintOk}>
            ✓ Moto reconnue : {[matchedMoto.marque, matchedMoto.modele || matchedMoto.type, matchedMoto.couleur]
              .filter(Boolean)
              .join(" ")}
          </Text>
        )}

        <Text style={styles.label}>Provenance</Text>
        <TextInput
          value={provenance}
          onChangeText={setProvenance}
          style={styles.input}
        />

        <Text style={styles.label}>Nature</Text>
        <TextInput
          value={nature}
          onChangeText={setNature}
          style={styles.input}
        />

        <Text style={styles.label}>Nom du Signateur / Provenance</Text>
        <TextInput
          value={nomSignateur}
          onChangeText={setNomSignateur}
          style={styles.input}
        />

        {/* Pièce d'identité du client */}
        <Text style={styles.sectionTitle}>PIÈCE D'IDENTITÉ DU CLIENT</Text>
        <View style={photoStyles.radioRow}>
          <TouchableOpacity
            onPress={() => setClientIdType("cnib")}
            style={[photoStyles.radio, clientIdType === "cnib" && photoStyles.radioActive]}
          >
            <Text
              style={[
                photoStyles.radioText,
                clientIdType === "cnib" && photoStyles.radioTextActive,
              ]}
            >
              CNIB (recto / verso)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setClientIdType("passport")}
            style={[
              photoStyles.radio,
              clientIdType === "passport" && photoStyles.radioActive,
            ]}
          >
            <Text
              style={[
                photoStyles.radioText,
                clientIdType === "passport" && photoStyles.radioTextActive,
              ]}
            >
              Passeport (recto)
            </Text>
          </TouchableOpacity>
        </View>

        <PhotoPicker
          label={clientIdType === "passport" ? "Passeport (recto)" : "CNIB — Recto"}
          uri={clientIdRecto}
          aspect={clientIdType === "passport" ? PASSPORT_ASPECT : ID_ASPECT}
          onPick={() =>
            pickPhoto(
              setClientIdRecto,
              clientIdType === "passport" ? PASSPORT_ASPECT : ID_ASPECT,
            )
          }
          onClear={() => setClientIdRecto(null)}
        />
        {clientIdType === "cnib" && (
          <PhotoPicker
            label="CNIB — Verso"
            uri={clientIdVerso}
            aspect={ID_ASPECT}
            onPick={() => pickPhoto(setClientIdVerso, ID_ASPECT)}
            onClear={() => setClientIdVerso(null)}
          />
        )}

        {/* Carte grise */}
        <Text style={styles.sectionTitle}>CARTE GRISE</Text>
        <PhotoPicker
          label="Carte grise — Recto"
          uri={carteGriseRecto}
          aspect={ID_ASPECT}
          onPick={() => pickPhoto(setCarteGriseRecto, ID_ASPECT)}
          onClear={() => setCarteGriseRecto(null)}
        />
        <PhotoPicker
          label="Carte grise — Verso"
          uri={carteGriseVerso}
          aspect={ID_ASPECT}
          onPick={() => pickPhoto(setCarteGriseVerso, ID_ASPECT)}
          onClear={() => setCarteGriseVerso(null)}
        />

        {/* Certificat de vente */}
        <Text style={styles.sectionTitle}>CERTIFICAT DE VENTE</Text>
        <PhotoPicker
          label="Certificat de vente"
          uri={certificatVente}
          aspect={CERT_ASPECT}
          onPick={() => pickPhoto(setCertificatVente, CERT_ASPECT)}
          onClear={() => setCertificatVente(null)}
        />

        {/* Statut récupération */}
        <Text style={styles.sectionTitle}>STATUT DE RÉCUPÉRATION</Text>
        <Checkbox
          label="Moto récupérée"
          value={motoRecuperee}
          onChange={setMotoRecuperee}
        />
        {!motoRecuperee && (
          <Text style={styles.statusHint}>Statut : moto non récupérée</Text>
        )}

        <View style={{ height: 8 }} />
        <Checkbox
          label="Documents récupérés"
          value={documentsRecuperes}
          onChange={setDocumentsRecuperes}
        />
        {!documentsRecuperes && (
          <Text style={styles.statusHint}>Statut : documents non récupérés</Text>
        )}

        {documentsRecuperes && (
          <>
            <Text style={styles.label}>Type(s) de document(s) récupéré(s)</Text>
            <TextInput
              value={typesDocuments}
              onChangeText={setTypesDocuments}
              style={[styles.input, { minHeight: 60 }]}
              placeholder="Ex: Carte grise, certificat de vente, attestation d'assurance..."
              multiline
            />
          </>
        )}

        {/* Signatures conditionnelles (empilées : 2 WebViews côte à côte
            cassent la zone tactile sur Android) */}
        {(motoRecuperee || documentsRecuperes) && (
          <>
            <Text style={styles.sectionTitle}>SIGNATURES</Text>
            {motoRecuperee && (
              <SignatureBlock
                title="Récupération moto :"
                signatureString={signatureMoto}
                onScrollLock={(locked) => setScrollEnabled(!locked)}
                onValidate={setSignatureMoto}
                onClear={() => setSignatureMoto(null)}
              />
            )}
            {documentsRecuperes && (
              <SignatureBlock
                title="Récupération documents :"
                signatureString={signatureDocuments}
                onScrollLock={(locked) => setScrollEnabled(!locked)}
                onValidate={setSignatureDocuments}
                onClear={() => setSignatureDocuments(null)}
              />
            )}
          </>
        )}

        {/* Rendez-vous de récupération (uniquement en création et si quelque chose
            n'a pas été récupéré) */}
        {!id && besoinRDV && (
          <View style={styles.rdvAutoBox}>
            <Text style={styles.rdvAutoTitle}>
              <Ionicons name="calendar-outline" size={14} color="#5856D6" /> Rendez-vous
              de récupération
            </Text>
            <Text style={styles.rdvAutoHint}>
              Comme {!motoRecuperee && !documentsRecuperes
                ? "la moto et les documents n'ont"
                : !motoRecuperee
                  ? "la moto n'a"
                  : "les documents n'ont"}{" "}
              pas été récupéré{!motoRecuperee && !documentsRecuperes ? "s" : !motoRecuperee ? "e" : "s"},
              programmez un rendez-vous pour la récupération.
            </Text>

            <Checkbox
              label="Créer automatiquement le rendez-vous"
              value={autoCreerRDV}
              onChange={setAutoCreerRDV}
            />

            {autoCreerRDV && (
              <>
                <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Date (JJ/MM/AAAA) *</Text>
                    <TextInput
                      value={rdvDate}
                      onChangeText={setRdvDate}
                      style={styles.input}
                      placeholder="Ex: 15/06/2026"
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Heure (HH:MM)</Text>
                    <TextInput
                      value={rdvHeure}
                      onChangeText={setRdvHeure}
                      style={styles.input}
                      placeholder="Ex: 14:30"
                    />
                  </View>
                </View>

                <View style={styles.rdvPreview}>
                  <Text style={styles.rdvPreviewLabel}>Motif :</Text>
                  <Text style={styles.rdvPreviewValue}>{computeMotifRDV()}</Text>
                  <Text style={styles.rdvPreviewLabel}>Lieu :</Text>
                  <Text style={styles.rdvPreviewValue}>
                    {nomEntreprise || "(Configurez le nom dans Paramètres > Entête)"}
                  </Text>
                  <Text style={styles.rdvPreviewLabel}>Client :</Text>
                  <Text style={styles.rdvPreviewValue}>
                    {nomPrenom || "(Saisissez le nom du client)"}
                  </Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* Auto-création du reçu (uniquement en création) */}
        {!id && (
          <View style={styles.recuAutoBox}>
            <Checkbox
              label="Créer automatiquement le réçu correspondant"
              value={autoCreerRecu}
              onChange={setAutoCreerRecu}
            />
            <Text style={styles.recuAutoHint}>
              Un réçu pré-rempli (date, client, infos moto) sera ajouté au dossier reçus du même nom.
              Vous pourrez le compléter (signatures, prix, etc.) dans la partie Réçus.
            </Text>
          </View>
        )}

        <View style={{ marginTop: 30 }}>
          <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
            <Text style={styles.saveBtnText}>
              {id ? "METTRE À JOUR" : "SAUVEGARDER LE REGISTRE"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 60 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    marginTop: 20,
    marginBottom: 4,
    color: "#007AFF",
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
    backgroundColor: "#007AFF",
    padding: 18,
    borderRadius: 10,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: "#007AFF",
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  checkboxChecked: { backgroundColor: "#007AFF" },
  checkboxLabel: { fontSize: 15, fontWeight: "600", color: "#222" },
  statusHint: {
    fontSize: 12,
    color: "#888",
    fontStyle: "italic",
    marginLeft: 32,
  },
  hintInfo: {
    fontSize: 11,
    color: "#666",
    fontStyle: "italic",
    marginTop: 4,
    marginBottom: 2,
  },
  hintOk: {
    fontSize: 12,
    color: "#1B7F2E",
    marginTop: 6,
    fontWeight: "600",
  },
  recuAutoBox: {
    marginTop: 24,
    backgroundColor: "#eaf4ff",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bcdcff",
  },
  recuAutoHint: {
    fontSize: 11,
    color: "#345",
    marginTop: 4,
    marginLeft: 32,
    fontStyle: "italic",
  },
  rdvAutoBox: {
    marginTop: 20,
    backgroundColor: "#f3f2ff",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d1cffc",
  },
  rdvAutoTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#5856D6",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  rdvAutoHint: {
    fontSize: 11,
    color: "#345",
    marginBottom: 8,
    fontStyle: "italic",
  },
  rdvPreview: {
    marginTop: 10,
    padding: 10,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0f5",
  },
  rdvPreviewLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#5856D6",
    marginTop: 4,
    textTransform: "uppercase",
  },
  rdvPreviewValue: {
    fontSize: 13,
    color: "#222",
    marginTop: 2,
  },
});

const photoStyles = StyleSheet.create({
  container: { marginTop: 12 },
  label: { fontSize: 13, fontWeight: "600", color: "#444", marginBottom: 6 },
  zone: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderStyle: "dashed",
    borderRadius: 10,
    backgroundColor: "#fff",
    overflow: "hidden",
    width: "100%",
  },
  preview: { width: "100%", height: "100%" },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", gap: 4, padding: 10 },
  emptyText: { color: "#666", fontSize: 13, fontWeight: "600" },
  hintText: { color: "#999", fontSize: 10, textAlign: "center", marginTop: 2 },
  frameGuide: {
    position: "absolute",
    top: "10%",
    left: "8%",
    right: "8%",
    bottom: "10%",
    borderWidth: 2,
    borderColor: "#007AFF",
    borderStyle: "dashed",
    borderRadius: 6,
  },
  actionsRow: { flexDirection: "row", gap: 8, marginTop: 6 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#007AFF",
    paddingVertical: 8,
    borderRadius: 6,
  },
  actionText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  radioRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  radio: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  radioActive: { backgroundColor: "#007AFF", borderColor: "#007AFF" },
  radioText: { fontSize: 13, color: "#444", fontWeight: "600" },
  radioTextActive: { color: "#fff" },
});

const sigStyles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: "600", marginTop: 8, color: "#444" },
  signatureContainer: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#000",
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  signatureBox: { width: "100%", height: 200 },
  buttonRow: {
    flexDirection: "row",
    height: 44,
    borderTopWidth: 1,
    borderColor: "#eee",
  },
  sigBtn: { flex: 1, justifyContent: "center", alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "bold", fontSize: 12 },
  previewContainer: {
    alignItems: "center",
    marginTop: 8,
    padding: 8,
    backgroundColor: "#e8f5e9",
    borderRadius: 8,
  },
  sigPreview: { width: 130, height: 60 },
});
