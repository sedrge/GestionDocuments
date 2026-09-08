// app/abonnement.tsx
//
// Abonnement de l'entreprise (self-service). Réservé à l'administrateur de
// l'entreprise : c'est l'entreprise elle-même qui déclenche son paiement, le
// super-admin ne peut jamais prélever à sa place (le serveur lui répond 403).
//
// Deux cas selon `payment_mode` :
//  - `manual` : information seule, le paiement se fait hors application.
//  - `sebpay` : flux Mobile Money (plan -> pays -> opérateur -> téléphone
//    -> OTP si l'opérateur l'exige) puis attente de confirmation. La source de
//    vérité est le webhook SebPay + la notification push ; le polling ci-dessous
//    n'est qu'un confort d'affichage.

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
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
import { useTenant } from "../context/TenantContext";
import { useTheme } from "../context/ThemeContext";
import {
    EnterpriseSubscription,
    PaymentMode,
    SebPayOperator,
    SubscriptionPayment,
    SubscriptionPlan,
    getEnterpriseSubscription,
    getEnterpriseSubscriptionPayments,
    getSebPayOperators,
    getSubscriptionPaymentStatus,
    getSubscriptionPlanPrices,
    operatorCode,
    operatorLabel,
    paySubscription,
} from "../lib/enterpriseSubscription";

const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  monthly: "Mensuel",
  annual: "Annuel",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Abonnement actif",
  expired: "Abonnement expiré",
  cancelled: "Abonnement annulé",
};

const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  manual: "Manuel (hors application)",
  sebpay: "Mobile Money (SebPay)",
};

const PAYMENT_STATUS_LABELS: Record<SubscriptionPayment["status"], string> = {
  pending: "En attente",
  completed: "Confirmé",
  failed: "Échoué",
};

/** Polling léger : 5 s pendant ~2 min, puis on laisse la notification faire foi. */
const POLL_INTERVAL_MS = 5000;
const POLL_MAX_ATTEMPTS = 24;

const formatAmount = (amount: number | null | undefined): string =>
  amount == null ? "—" : Number(amount).toLocaleString("fr-FR");

const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR");
  } catch {
    return String(iso);
  }
};

export default function AbonnementScreen() {
  const { tenant, isEnterpriseAdmin } = useTenant();
  const { theme: rawTheme } = useTheme();
  const theme = {
    ...rawTheme,
    success: "#34C759",
    danger: "#FF3B30",
    warning: "#FF9F0A",
  };

  const enterpriseId = tenant?.enterprise_id ?? "";

  // Pas de chargement à faire (donc pas d'écran d'attente) si l'utilisateur
  // n'est pas administrateur de l'entreprise : il verra l'écran "accès réservé".
  const [loading, setLoading] = useState(!!enterpriseId && isEnterpriseAdmin);
  const [subscription, setSubscription] =
    useState<EnterpriseSubscription | null>(null);
  const [prices, setPrices] = useState<Record<SubscriptionPlan, number | null>>(
    {
      monthly: null,
      annual: null,
    },
  );

  // Historique paginé des paiements de l'entreprise
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsHasMore, setPaymentsHasMore] = useState(false);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  // Formulaire de paiement
  const [showForm, setShowForm] = useState(false);
  const [plan, setPlan] = useState<SubscriptionPlan>("monthly");
  const [country, setCountry] = useState("");
  const [operators, setOperators] = useState<SebPayOperator[]>([]);
  const [operatorsLoading, setOperatorsLoading] = useState(false);
  const [selectedOperator, setSelectedOperator] =
    useState<SebPayOperator | null>(null);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Attente de confirmation
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<
    "polling" | "timeout" | "completed" | "failed" | null
  >(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollAttempts = useRef(0);

  const loadData = async () => {
    setLoading(true);
    const [subResult, priceResult] = await Promise.all([
      getEnterpriseSubscription(enterpriseId),
      getSubscriptionPlanPrices(),
    ]);

    if (subResult.success) {
      setSubscription(subResult.subscription);
      const currentPlan = subResult.subscription?.plan;
      if (currentPlan === "monthly" || currentPlan === "annual")
        setPlan(currentPlan);
      if (subResult.subscription?.sebpay_country)
        setCountry(subResult.subscription.sebpay_country);
      if (subResult.subscription?.sebpay_phone)
        setPhone(subResult.subscription.sebpay_phone);
    } else {
      Alert.alert("Erreur", subResult.error ?? "Abonnement indisponible.");
    }

    if (priceResult.success) setPrices(priceResult.prices);
    await loadPayments(1, true);
    setLoading(false);
  };

  const loadPayments = async (page: number, replace = false) => {
    setPaymentsLoading(true);
    const result = await getEnterpriseSubscriptionPayments(enterpriseId, page);
    if (result.success) {
      setPayments((prev) =>
        replace ? result.payments : [...prev, ...result.payments],
      );
      setPaymentsPage(page);
      setPaymentsHasMore(result.hasMore);
    }
    setPaymentsLoading(false);
  };

  const loadOperators = async (countryCode: string) => {
    const code = countryCode.trim().toUpperCase();
    if (code.length < 2) {
      return Alert.alert(
        "Pays requis",
        "Indiquez le code pays du Burkina Faso : BF.",
      );
    }
    setOperatorsLoading(true);
    setSelectedOperator(null);
    const result = await getSebPayOperators(enterpriseId, code);
    setOperatorsLoading(false);
    if (!result.success) {
      setOperators([]);
      return Alert.alert(
        "Erreur",
        result.error ?? "Opérateurs indisponibles pour ce pays.",
      );
    }
    setOperators(result.operators);
    if (result.operators.length === 0) {
      Alert.alert(
        "Aucun opérateur",
        "Aucun opérateur Mobile Money n'est disponible pour ce pays.",
      );
    }
  };

  useEffect(() => {
    // Chargement initial au montage (même pattern que enterprise_features.tsx).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (enterpriseId && isEnterpriseAdmin) loadData();
    // Coupe le polling en cours si l'écran est quitté avant la confirmation.
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enterpriseId]);

  const otpRequired = !!selectedOperator?.otp_required;

  const canSubmit =
    !!selectedOperator &&
    country.trim().length >= 2 &&
    phone.trim().length >= 6 &&
    (!otpRequired || otp.trim().length > 0);

  const startPolling = (paymentId: string) => {
    pollAttempts.current = 0;
    setPendingStatus("polling");

    const tick = async () => {
      pollAttempts.current += 1;
      const result = await getSubscriptionPaymentStatus(
        enterpriseId,
        paymentId,
      );

      if (result.success && result.status === "completed") {
        setPendingStatus("completed");
        loadData();
        return;
      }
      if (result.success && result.status === "failed") {
        setPendingStatus("failed");
        return;
      }
      if (pollAttempts.current >= POLL_MAX_ATTEMPTS) {
        // Le webhook reste la source de vérité : on arrête de solliciter le
        // serveur et on informe l'utilisateur qu'il sera notifié.
        setPendingStatus("timeout");
        return;
      }
      pollTimer.current = setTimeout(tick, POLL_INTERVAL_MS);
    };

    pollTimer.current = setTimeout(tick, POLL_INTERVAL_MS);
  };

  const handlePay = async () => {
    if (!canSubmit || !selectedOperator) return;

    setSubmitting(true);
    const result = await paySubscription(enterpriseId, {
      plan,
      country: country.trim().toUpperCase(),
      operator: operatorCode(selectedOperator),
      phone: phone.trim(),
      ...(otpRequired ? { otp_code: otp.trim() } : {}),
    });
    setSubmitting(false);

    if (!result.success) {
      return Alert.alert(
        "Paiement refusé",
        result.error ?? "Le paiement n'a pas pu être initié.",
      );
    }

    setShowForm(false);
    setOtp("");
    if (result.paymentId) {
      setPendingPaymentId(result.paymentId);
      startPolling(result.paymentId);
    } else {
      // Pas d'identifiant renvoyé : on ne peut pas suivre, la notification fera foi.
      setPendingStatus("timeout");
    }
  };

  const resetPending = () => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    setPendingPaymentId(null);
    setPendingStatus(null);
  };

  // ── Accès réservé ───────────────────────────────────────────────────────────
  if (!isEnterpriseAdmin) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
        <View
          style={[
            styles.header,
            { backgroundColor: theme.card, borderBottomColor: theme.border },
          ]}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginRight: 14 }}
          >
            <Ionicons name="arrow-back" size={24} color={theme.primary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Abonnement
          </Text>
        </View>
        <View style={styles.centered}>
          <Ionicons name="lock-closed" size={48} color={theme.subText} />
          <Text style={{ color: theme.text, marginTop: 12, fontWeight: "700" }}>
            Accès réservé
          </Text>
          <Text
            style={{
              color: theme.subText,
              marginTop: 6,
              textAlign: "center",
              paddingHorizontal: 30,
            }}
          >
            Seul l&apos;administrateur de l&apos;entreprise peut consulter et
            régler l&apos;abonnement.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const status = subscription?.status ?? "active";
  const statusColor =
    status === "active"
      ? theme.success
      : status === "expired"
        ? theme.danger
        : theme.warning;
  const isSebPay = subscription?.payment_mode === "sebpay";
  const currentPrice = prices[plan];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* ── Header ── */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.card, borderBottomColor: theme.border },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginRight: 14 }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Abonnement
          </Text>
          <Text
            style={[styles.headerSub, { color: theme.subText }]}
            numberOfLines={1}
          >
            {tenant?.enterprise_name || "Mon entreprise"}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
          >
            {/* ── Statut ── */}
            <View
              style={[
                styles.statusBand,
                {
                  backgroundColor: statusColor + "1A",
                  borderColor: statusColor + "33",
                },
              ]}
            >
              <Ionicons name="card-outline" size={18} color={statusColor} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusTitle, { color: statusColor }]}>
                  {STATUS_LABELS[status] ?? status}
                </Text>
                <Text style={[styles.statusSub, { color: theme.subText }]}>
                  {subscription
                    ? `Formule ${PLAN_LABELS[subscription.plan] ?? subscription.plan} · échéance ${formatDate(subscription.current_period_end)}`
                    : "Aucun abonnement enregistré pour le moment."}
                </Text>
              </View>
            </View>

            {/* ── Détails de l'abonnement (lecture seule) ── */}
            {subscription && (
              <View
                style={[
                  styles.card,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.cardTitle, { color: theme.text }]}>
                  Détails de l&apos;abonnement
                </Text>

                <View
                  style={[
                    styles.detailRow,
                    { borderBottomColor: theme.border },
                  ]}
                >
                  <Text style={[styles.detailLabel, { color: theme.subText }]}>
                    Formule
                  </Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>
                    {PLAN_LABELS[subscription.plan] ?? subscription.plan}
                  </Text>
                </View>
                <View
                  style={[
                    styles.detailRow,
                    { borderBottomColor: theme.border },
                  ]}
                >
                  <Text style={[styles.detailLabel, { color: theme.subText }]}>
                    Montant
                  </Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>
                    {formatAmount(Number(subscription.amount))} XOF
                  </Text>
                </View>
                <View
                  style={[
                    styles.detailRow,
                    { borderBottomColor: theme.border },
                  ]}
                >
                  <Text style={[styles.detailLabel, { color: theme.subText }]}>
                    Début de période
                  </Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>
                    {formatDate(subscription.current_period_start)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.detailRow,
                    { borderBottomColor: theme.border },
                  ]}
                >
                  <Text style={[styles.detailLabel, { color: theme.subText }]}>
                    Échéance
                  </Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>
                    {formatDate(subscription.current_period_end)}
                  </Text>
                </View>
                <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                  <Text style={[styles.detailLabel, { color: theme.subText }]}>
                    Mode de paiement
                  </Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>
                    {PAYMENT_MODE_LABELS[subscription.payment_mode] ??
                      subscription.payment_mode}
                  </Text>
                </View>
              </View>
            )}

            {/* ── Attente de confirmation ── */}
            {pendingStatus && (
              <View
                style={[
                  styles.card,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                {pendingStatus === "polling" && (
                  <>
                    <View style={styles.pendingRow}>
                      <ActivityIndicator color={theme.primary} />
                      <Text style={[styles.cardTitle, { color: theme.text }]}>
                        En attente de confirmation
                      </Text>
                    </View>
                    <Text style={[styles.cardText, { color: theme.subText }]}>
                      Validez la demande de paiement sur votre téléphone. La
                      confirmation peut prendre quelques instants.
                    </Text>
                  </>
                )}
                {pendingStatus === "timeout" && (
                  <>
                    <Text style={[styles.cardTitle, { color: theme.text }]}>
                      Paiement en cours
                    </Text>
                    <Text style={[styles.cardText, { color: theme.subText }]}>
                      Vous serez notifié dès la confirmation du paiement. Vous
                      pouvez fermer cet écran sans risque.
                    </Text>
                  </>
                )}
                {pendingStatus === "completed" && (
                  <>
                    <Text style={[styles.cardTitle, { color: theme.success }]}>
                      Paiement confirmé
                    </Text>
                    <Text style={[styles.cardText, { color: theme.subText }]}>
                      Votre abonnement a été renouvelé. Merci !
                    </Text>
                  </>
                )}
                {pendingStatus === "failed" && (
                  <>
                    <Text style={[styles.cardTitle, { color: theme.danger }]}>
                      Paiement échoué
                    </Text>
                    <Text style={[styles.cardText, { color: theme.subText }]}>
                      Le paiement n&apos;a pas abouti. Vous pouvez réessayer.
                    </Text>
                  </>
                )}
                {pendingStatus !== "polling" && (
                  <TouchableOpacity
                    style={[styles.secondaryBtn, { borderColor: theme.border }]}
                    onPress={resetPending}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={{
                        color: theme.primary,
                        fontWeight: "700",
                        fontSize: 14,
                      }}
                    >
                      Fermer
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* ── Mode manuel : information seule ── */}
            {!isSebPay && (
              <View
                style={[
                  styles.card,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <View style={styles.pendingRow}>
                  <Ionicons
                    name="information-circle-outline"
                    size={20}
                    color={theme.warning}
                  />
                  <Text style={[styles.cardTitle, { color: theme.text }]}>
                    Paiement mobile non disponible
                  </Text>
                </View>
                <Text style={[styles.cardText, { color: theme.subText }]}>
                  Le paiement depuis l&apos;application n&apos;est pas activé
                  pour votre entreprise. Contactez-nous pour régler votre
                  abonnement ; il sera enregistré manuellement dès réception.
                </Text>
              </View>
            )}

            {/* ── Mode SebPay : flux de paiement ── */}
            {isSebPay && !pendingPaymentId && !showForm && (
              <>
                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    { backgroundColor: theme.primary },
                  ]}
                  onPress={() => setShowForm(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name="phone-portrait-outline"
                    size={18}
                    color="#fff"
                  />
                  <Text style={styles.primaryBtnText}>
                    {status === "active"
                      ? "Payer par anticipation"
                      : "Renouveler / Payer"}
                  </Text>
                </TouchableOpacity>
                {status === "active" && (
                  <Text
                    style={[
                      styles.cardText,
                      {
                        color: theme.subText,
                        textAlign: "center",
                        marginTop: 8,
                      },
                    ]}
                  >
                    Votre abonnement est actif. Vous pouvez payer dès maintenant
                    pour la prochaine période — l&apos;échéance sera prolongée à
                    partir de la date actuelle.
                  </Text>
                )}
              </>
            )}

            {isSebPay && showForm && (
              <View
                style={[
                  styles.card,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.cardTitle, { color: theme.text }]}>
                  Paiement Mobile Money
                </Text>

                {/* 1. Plan */}
                <Text style={[styles.fieldLabel, { color: theme.subText }]}>
                  Formule
                </Text>
                <View style={styles.segment}>
                  {(["monthly", "annual"] as SubscriptionPlan[]).map((p) => (
                    <TouchableOpacity
                      key={p}
                      onPress={() => setPlan(p)}
                      style={[
                        styles.segmentBtn,
                        {
                          borderColor:
                            plan === p ? theme.primary : theme.border,
                          backgroundColor:
                            plan === p ? theme.primary + "22" : "transparent",
                        },
                      ]}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          { color: plan === p ? theme.primary : theme.subText },
                        ]}
                      >
                        {PLAN_LABELS[p]}
                      </Text>
                      <Text
                        style={[styles.segmentPrice, { color: theme.subText }]}
                      >
                        {formatAmount(prices[p])} XOF
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* 2. Pays */}
                <Text style={[styles.fieldLabel, { color: theme.subText }]}>
                  Pays (code ISO)
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        flex: 1,
                        color: theme.text,
                        borderColor: theme.border,
                        backgroundColor: theme.bg,
                      },
                    ]}
                    value={country}
                    onChangeText={(t) => setCountry(t.toUpperCase())}
                    placeholder="BF"
                    placeholderTextColor={theme.subText}
                    autoCapitalize="characters"
                    maxLength={2}
                  />
                  <TouchableOpacity
                    style={[
                      styles.secondaryBtn,
                      { borderColor: theme.primary, marginTop: 0 },
                    ]}
                    onPress={() => loadOperators(country)}
                    disabled={operatorsLoading}
                    activeOpacity={0.8}
                  >
                    {operatorsLoading ? (
                      <ActivityIndicator color={theme.primary} />
                    ) : (
                      <Text
                        style={{
                          color: theme.primary,
                          fontWeight: "700",
                          fontSize: 14,
                        }}
                      >
                        Opérateurs
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>

                {/* 3. Opérateur */}
                {operators.length > 0 && (
                  <>
                    <Text style={[styles.fieldLabel, { color: theme.subText }]}>
                      Opérateur
                    </Text>
                    {operators.map((op) => {
                      const code = operatorCode(op);
                      const selected =
                        selectedOperator &&
                        operatorCode(selectedOperator) === code;
                      return (
                        <TouchableOpacity
                          key={code || operatorLabel(op)}
                          style={[
                            styles.operatorRow,
                            {
                              borderColor: selected
                                ? theme.primary
                                : theme.border,
                              backgroundColor: selected
                                ? theme.primary + "11"
                                : "transparent",
                            },
                          ]}
                          onPress={() => {
                            setSelectedOperator(op);
                            setOtp("");
                          }}
                          activeOpacity={0.8}
                        >
                          <Ionicons
                            name={
                              selected ? "radio-button-on" : "radio-button-off"
                            }
                            size={18}
                            color={selected ? theme.primary : theme.subText}
                          />
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.operatorLabel,
                                { color: theme.text },
                              ]}
                            >
                              {operatorLabel(op)}
                            </Text>
                            {op.otp_required && (
                              <Text
                                style={[
                                  styles.cardText,
                                  { color: theme.warning, marginTop: 2 },
                                ]}
                              >
                                Code de validation requis
                              </Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </>
                )}

                {/* 4. Téléphone */}
                <Text style={[styles.fieldLabel, { color: theme.subText }]}>
                  Numéro Mobile Money
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: theme.text,
                      borderColor: theme.border,
                      backgroundColor: theme.bg,
                    },
                  ]}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Ex. 97000000"
                  placeholderTextColor={theme.subText}
                  keyboardType="phone-pad"
                />

                {/* 5. OTP si l'opérateur l'exige */}
                {otpRequired && (
                  <View
                    style={[
                      styles.otpBox,
                      {
                        backgroundColor: theme.warning + "14",
                        borderColor: theme.warning + "44",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.cardTitle,
                        { color: theme.warning, fontSize: 14 },
                      ]}
                    >
                      Code de validation requis
                    </Text>
                    <Text style={[styles.cardText, { color: theme.subText }]}>
                      Composez{" "}
                      <Text style={{ fontWeight: "700", color: theme.text }}>
                        {selectedOperator?.ussd_code ||
                          "le code USSD de votre opérateur"}
                      </Text>{" "}
                      sur votre téléphone pour générer un code, puis
                      saisissez-le ci-dessous.
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          color: theme.text,
                          borderColor: theme.border,
                          backgroundColor: theme.card,
                        },
                      ]}
                      value={otp}
                      onChangeText={setOtp}
                      placeholder="Code reçu"
                      placeholderTextColor={theme.subText}
                      keyboardType="number-pad"
                    />
                  </View>
                )}

                <Text
                  style={[
                    styles.cardText,
                    { color: theme.subText, marginTop: 12 },
                  ]}
                >
                  Montant à payer : {formatAmount(currentPrice)} XOF (
                  {PLAN_LABELS[plan].toLowerCase()})
                </Text>

                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    {
                      backgroundColor: theme.primary,
                      opacity: canSubmit && !submitting ? 1 : 0.5,
                      marginTop: 12,
                    },
                  ]}
                  onPress={handlePay}
                  disabled={!canSubmit || submitting}
                  activeOpacity={0.85}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={18}
                        color="#fff"
                      />
                      <Text style={styles.primaryBtnText}>
                        Payer maintenant
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.secondaryBtn, { borderColor: theme.border }]}
                  onPress={() => setShowForm(false)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={{
                      color: theme.subText,
                      fontWeight: "600",
                      fontSize: 14,
                    }}
                  >
                    Annuler
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Historique des paiements ── */}
            <View
              style={[
                styles.card,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <View style={styles.pendingRow}>
                <Ionicons name="time-outline" size={18} color={theme.primary} />
                <Text style={[styles.cardTitle, { color: theme.text }]}>
                  Historique des paiements
                </Text>
              </View>

              {payments.length === 0 ? (
                <Text
                  style={[
                    styles.cardText,
                    { color: theme.subText, marginTop: 10 },
                  ]}
                >
                  Aucun paiement enregistré pour le moment.
                </Text>
              ) : (
                payments.map((payment) => {
                  const color =
                    payment.status === "completed"
                      ? theme.success
                      : payment.status === "failed"
                        ? theme.danger
                        : theme.warning;
                  return (
                    <View
                      key={payment.id}
                      style={[
                        styles.historyRow,
                        { borderTopColor: theme.border },
                      ]}
                    >
                      <Ionicons
                        name={
                          payment.source === "sebpay"
                            ? "phone-portrait-outline"
                            : "receipt-outline"
                        }
                        size={16}
                        color={color}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[styles.operatorLabel, { color: theme.text }]}
                        >
                          {formatAmount(Number(payment.amount))} XOF ·{" "}
                          {PLAN_LABELS[payment.plan] ?? payment.plan}
                        </Text>
                        <Text
                          style={[
                            styles.cardText,
                            { color: theme.subText, marginTop: 2 },
                          ]}
                        >
                          {formatDate(payment.paid_at || payment.created_at)} ·{" "}
                          {payment.source === "sebpay"
                            ? "Mobile Money"
                            : "Manuel"}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.historyBadge,
                          { backgroundColor: color + "22" },
                        ]}
                      >
                        <Text
                          style={{ color, fontSize: 11, fontWeight: "700" }}
                        >
                          {PAYMENT_STATUS_LABELS[payment.status] ??
                            payment.status}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}

              {paymentsHasMore && (
                <TouchableOpacity
                  style={{ paddingVertical: 12, alignItems: "center" }}
                  onPress={() => loadPayments(paymentsPage + 1)}
                  disabled={paymentsLoading}
                >
                  {paymentsLoading ? (
                    <ActivityIndicator color={theme.primary} />
                  ) : (
                    <Text
                      style={{
                        color: theme.primary,
                        fontWeight: "600",
                        fontSize: 13,
                      }}
                    >
                      Charger plus
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  headerSub: { fontSize: 12, marginTop: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },

  statusBand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 12,
  },
  statusTitle: { fontSize: 15, fontWeight: "700" },
  statusSub: { fontSize: 12, marginTop: 2 },

  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  cardText: { fontSize: 12, marginTop: 6, lineHeight: 17 },
  pendingRow: { flexDirection: "row", alignItems: "center", gap: 10 },

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailLabel: { fontSize: 13 },
  detailValue: { fontSize: 13, fontWeight: "600" },

  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  historyBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },

  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },

  segment: { flexDirection: "row", gap: 8 },
  segmentBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  segmentText: { fontSize: 13, fontWeight: "700" },
  segmentPrice: { fontSize: 11, marginTop: 2 },

  operatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 8,
  },
  operatorLabel: { fontSize: 14, fontWeight: "600" },

  otpBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
    gap: 4,
  },

  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
  },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  secondaryBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
});
