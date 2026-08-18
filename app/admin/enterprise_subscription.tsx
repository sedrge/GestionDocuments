// app/admin/enterprise_subscription.tsx
//
// Abonnement d'une entreprise, côté super-admin : plan & facturation, mode de
// paiement (manuel / SebPay), coupure automatique des fonctionnalités premium,
// enregistrement d'un paiement reçu hors application, et historique.
//
// Le super-admin ne déclenche JAMAIS un prélèvement à la place de l'entreprise
// (l'endpoint de paiement lui répond 403 volontairement) : il ne fait
// qu'enregistrer un paiement déjà reçu via "Marquer comme payé".

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTenant } from '../../context/TenantContext';
import { useTheme } from '../../context/ThemeContext';
import {
  EnterpriseSubscription,
  PaymentMode,
  SubscriptionPayment,
  SubscriptionPlan,
  SubscriptionStatus,
  getEnterpriseSubscription,
  getEnterpriseSubscriptionPayments,
  markEnterpriseSubscriptionPaid,
  updateEnterpriseSubscription,
} from '../../lib/enterpriseSubscription';

const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  monthly: 'Mensuel',
  annual: 'Annuel',
};

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: 'Actif',
  expired: 'Expiré',
  cancelled: 'Annulé',
};

const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  manual: 'Manuel (hors application)',
  sebpay: 'Mobile Money (SebPay)',
};

const PAYMENT_STATUS_LABELS: Record<SubscriptionPayment['status'], string> = {
  pending: 'En attente',
  completed: 'Confirmé',
  failed: 'Échoué',
};

/** ISO serveur -> `YYYY-MM-DD` pour les champs texte (pas de date-picker ici). */
const toDateInput = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const match = String(iso).match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : '';
};

const isValidDateInput = (value: string): boolean =>
  value.trim() === '' || /^\d{4}-\d{2}-\d{2}$/.test(value.trim());

/** Champ date vide -> null (le serveur accepte les périodes non renseignées). */
const dateOrNull = (value: string): string | null =>
  value.trim() === '' ? null : value.trim();

const formatAmount = (amount: string | number | null | undefined): string => {
  const n = Number(amount ?? 0);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('fr-FR');
};

const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('fr-FR');
  } catch {
    return String(iso);
  }
};

export default function EnterpriseSubscriptionScreen() {
  const { enterpriseId, enterpriseName } = useLocalSearchParams<{
    enterpriseId: string;
    enterpriseName: string;
  }>();
  const { isSuperAdmin } = useTenant();
  const { theme: rawTheme } = useTheme();
  const theme = {
    ...rawTheme,
    success: '#34C759',
    danger: '#FF3B30',
    warning: '#FF9F0A',
  };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [marking, setMarking] = useState(false);

  // Champs éditables de l'abonnement
  const [plan, setPlan] = useState<SubscriptionPlan>('monthly');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<SubscriptionStatus>('active');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('manual');
  const [autoCutoff, setAutoCutoff] = useState(false);
  const [graceDays, setGraceDays] = useState('7');

  // "Marquer comme payé"
  const [markPlan, setMarkPlan] = useState<SubscriptionPlan>('monthly');
  const [markAmount, setMarkAmount] = useState('');
  const [markNote, setMarkNote] = useState('');

  // Historique paginé
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsHasMore, setPaymentsHasMore] = useState(false);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  const applySubscription = (sub: EnterpriseSubscription | null) => {
    if (!sub) return;
    setPlan((sub.plan as SubscriptionPlan) ?? 'monthly');
    setAmount(sub.amount == null ? '' : String(Number(sub.amount)));
    setStatus((sub.status as SubscriptionStatus) ?? 'active');
    setPeriodStart(toDateInput(sub.current_period_start));
    setPeriodEnd(toDateInput(sub.current_period_end));
    setPaymentMode((sub.payment_mode as PaymentMode) ?? 'manual');
    setAutoCutoff(!!sub.auto_cutoff_enabled);
    setGraceDays(sub.grace_period_days == null ? '7' : String(sub.grace_period_days));
    setMarkPlan((sub.plan as SubscriptionPlan) ?? 'monthly');
    setMarkAmount(sub.amount == null ? '' : String(Number(sub.amount)));
  };

  const loadAll = async () => {
    setLoading(true);
    const result = await getEnterpriseSubscription(enterpriseId);
    if (result.success) {
      applySubscription(result.subscription);
    } else {
      Alert.alert('Erreur', result.error ?? 'Chargement impossible.');
    }
    await loadPayments(1, true);
    setLoading(false);
  };

  const loadPayments = async (page: number, replace = false) => {
    setPaymentsLoading(true);
    const result = await getEnterpriseSubscriptionPayments(enterpriseId, page);
    if (result.success) {
      setPayments((prev) => (replace ? result.payments : [...prev, ...result.payments]));
      setPaymentsPage(page);
      setPaymentsHasMore(result.hasMore);
    }
    setPaymentsLoading(false);
  };

  useEffect(() => {
    if (!enterpriseId || !isSuperAdmin) return;
    // Chargement initial au montage (même pattern que enterprise_features.tsx).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enterpriseId]);

  const handleSave = async () => {
    if (!enterpriseId) return;

    if (!isValidDateInput(periodStart) || !isValidDateInput(periodEnd)) {
      return Alert.alert(
        'Date invalide',
        'Les dates doivent être au format AAAA-MM-JJ (ex. 2026-08-31), ou laissées vides.',
      );
    }

    const parsedAmount = amount.trim() === '' ? 0 : Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      return Alert.alert('Montant invalide', 'Indiquez un montant positif (en XOF).');
    }

    const parsedGrace = parseInt(graceDays, 10);
    if (!Number.isFinite(parsedGrace) || parsedGrace < 0) {
      return Alert.alert(
        'Délai invalide',
        'Le délai de grâce doit être un nombre de jours positif.',
      );
    }

    setSaving(true);
    const result = await updateEnterpriseSubscription(enterpriseId, {
      plan,
      amount: parsedAmount,
      status,
      current_period_start: dateOrNull(periodStart),
      current_period_end: dateOrNull(periodEnd),
      payment_mode: paymentMode,
      auto_cutoff_enabled: autoCutoff,
      grace_period_days: parsedGrace,
    });
    setSaving(false);

    if (!result.success) return Alert.alert('Erreur', result.error ?? 'Échec de la sauvegarde.');

    Alert.alert('Succès', 'Abonnement mis à jour.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  const handleMarkPaid = () => {
    const parsedAmount = Number(markAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return Alert.alert('Montant invalide', 'Indiquez le montant réellement reçu (en XOF).');
    }

    Alert.alert(
      'Marquer comme payé',
      `Enregistrer un paiement ${PLAN_LABELS[markPlan].toLowerCase()} de ${formatAmount(parsedAmount)} XOF pour ${enterpriseName || 'cette entreprise'} ? L'échéance sera prolongée en conséquence.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            setMarking(true);
            const result = await markEnterpriseSubscriptionPaid(enterpriseId, {
              amount: parsedAmount,
              plan: markPlan,
              note: markNote.trim() === '' ? null : markNote.trim(),
            });
            setMarking(false);

            if (!result.success) {
              return Alert.alert('Erreur', result.error ?? 'Enregistrement impossible.');
            }

            setMarkNote('');
            if (result.subscription) applySubscription(result.subscription);
            else await loadAll();
            await loadPayments(1, true);
            Alert.alert('Paiement enregistré', 'L\'abonnement a été renouvelé.');
          },
        },
      ],
    );
  };

  if (!isSuperAdmin) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.bg }]}>
        <Ionicons name="lock-closed" size={48} color={theme.subText} />
        <Text style={{ color: theme.subText, marginTop: 12 }}>Accès refusé</Text>
      </View>
    );
  }

  const statusColor =
    status === 'active' ? theme.success : status === 'expired' ? theme.danger : theme.warning;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* ── Header ── */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 14 }}>
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Abonnement</Text>
          <Text style={[styles.headerSub, { color: theme.subText }]} numberOfLines={1}>
            {enterpriseName || 'Entreprise'}
          </Text>
        </View>
      </View>

      {/* ── Bandeau statut ── */}
      <View
        style={[
          styles.statusBand,
          { backgroundColor: statusColor + '1A', borderBottomColor: statusColor + '33' },
        ]}
      >
        <Ionicons name="card-outline" size={15} color={statusColor} />
        <Text style={[styles.statusText, { color: statusColor }]}>
          {STATUS_LABELS[status]} · {PLAN_LABELS[plan]} · échéance {formatDate(periodEnd || null)}
        </Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 110 }}>
            {/* ── Plan & facturation ── */}
            <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={[styles.sectionHeader, { backgroundColor: theme.nav, borderBottomColor: theme.border }]}>
                <Ionicons name="pricetag-outline" size={18} color={theme.primary} />
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Plan & facturation</Text>
              </View>

              <View style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Formule</Text>
                <View style={styles.segment}>
                  {(['monthly', 'annual'] as SubscriptionPlan[]).map((p) => (
                    <TouchableOpacity
                      key={p}
                      onPress={() => setPlan(p)}
                      style={[
                        styles.segmentBtn,
                        {
                          borderColor: plan === p ? theme.primary : theme.border,
                          backgroundColor: plan === p ? theme.primary + '22' : 'transparent',
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
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Montant (XOF)</Text>
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
                  value={amount}
                  onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={theme.subText}
                />
              </View>

              <View style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Début de période</Text>
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
                  value={periodStart}
                  onChangeText={setPeriodStart}
                  placeholder="AAAA-MM-JJ"
                  placeholderTextColor={theme.subText}
                  autoCapitalize="none"
                />
              </View>

              <View style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Échéance</Text>
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
                  value={periodEnd}
                  onChangeText={setPeriodEnd}
                  placeholder="AAAA-MM-JJ"
                  placeholderTextColor={theme.subText}
                  autoCapitalize="none"
                />
              </View>

              <View style={[styles.fieldRow, { borderBottomWidth: 0 }]}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Statut</Text>
                <View style={styles.segment}>
                  {(['active', 'expired', 'cancelled'] as SubscriptionStatus[]).map((s) => (
                    <TouchableOpacity
                      key={s}
                      onPress={() => setStatus(s)}
                      style={[
                        styles.segmentBtn,
                        {
                          borderColor: status === s ? theme.primary : theme.border,
                          backgroundColor: status === s ? theme.primary + '22' : 'transparent',
                        },
                      ]}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          { color: status === s ? theme.primary : theme.subText },
                        ]}
                      >
                        {STATUS_LABELS[s]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* ── Mode de paiement ── */}
            <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={[styles.sectionHeader, { backgroundColor: theme.nav, borderBottomColor: theme.border }]}>
                <Ionicons name="wallet-outline" size={18} color={theme.primary} />
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Mode de paiement</Text>
              </View>

              {(['manual', 'sebpay'] as PaymentMode[]).map((mode, idx) => (
                <TouchableOpacity
                  key={mode}
                  style={[
                    styles.itemRow,
                    { borderBottomColor: theme.border },
                    idx === 1 && { borderBottomWidth: 0 },
                  ]}
                  onPress={() => setPaymentMode(mode)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={mode === 'manual' ? 'receipt-outline' : 'phone-portrait-outline'}
                    size={16}
                    color={paymentMode === mode ? theme.primary : theme.subText}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.itemLabel,
                        { color: paymentMode === mode ? theme.text : theme.subText },
                      ]}
                    >
                      {PAYMENT_MODE_LABELS[mode]}
                    </Text>
                    <Text style={[styles.itemDesc, { color: theme.subText }]}>
                      {mode === 'manual'
                        ? "L'entreprise paie hors application ; vous enregistrez le paiement reçu."
                        : "L'entreprise paie elle-même par Mobile Money depuis son écran Abonnement."}
                    </Text>
                  </View>
                  <Ionicons
                    name={paymentMode === mode ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={paymentMode === mode ? theme.primary : theme.subText}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Coupure automatique ── */}
            <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={[styles.sectionHeader, { backgroundColor: theme.nav, borderBottomColor: theme.border }]}>
                <Ionicons name="lock-closed-outline" size={18} color={theme.primary} />
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Coupure automatique</Text>
              </View>

              <View style={[styles.itemRow, { borderBottomColor: theme.border }]}>
                <Ionicons
                  name="power-outline"
                  size={16}
                  color={autoCutoff ? theme.primary : theme.subText}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemLabel, { color: autoCutoff ? theme.text : theme.subText }]}>
                    Couper les fonctionnalités premium
                  </Text>
                  <Text style={[styles.itemDesc, { color: theme.subText }]}>
                    À la fin du délai de grâce si l&apos;abonnement reste impayé. Sinon, coupure
                    100 % manuelle via l&apos;écran Fonctionnalités.
                  </Text>
                </View>
                <Switch
                  value={autoCutoff}
                  onValueChange={setAutoCutoff}
                  trackColor={{ false: '#38383A', true: theme.primary + '55' }}
                  thumbColor={autoCutoff ? theme.primary : '#555'}
                />
              </View>

              <View style={[styles.fieldRow, { borderBottomWidth: 0 }]}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Délai de grâce (jours)</Text>
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
                  value={graceDays}
                  onChangeText={(t) => setGraceDays(t.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  placeholder="7"
                  placeholderTextColor={theme.subText}
                />
              </View>
            </View>

            {/* ── Marquer comme payé ── */}
            <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={[styles.sectionHeader, { backgroundColor: theme.nav, borderBottomColor: theme.border }]}>
                <Ionicons name="checkmark-done-outline" size={18} color={theme.success} />
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Marquer comme payé</Text>
              </View>

              <View style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Formule payée</Text>
                <View style={styles.segment}>
                  {(['monthly', 'annual'] as SubscriptionPlan[]).map((p) => (
                    <TouchableOpacity
                      key={p}
                      onPress={() => setMarkPlan(p)}
                      style={[
                        styles.segmentBtn,
                        {
                          borderColor: markPlan === p ? theme.success : theme.border,
                          backgroundColor: markPlan === p ? theme.success + '22' : 'transparent',
                        },
                      ]}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          { color: markPlan === p ? theme.success : theme.subText },
                        ]}
                      >
                        {PLAN_LABELS[p]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Montant reçu (XOF)</Text>
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
                  value={markAmount}
                  onChangeText={(t) => setMarkAmount(t.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={theme.subText}
                />
              </View>

              <View style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Note (optionnel)</Text>
                <TextInput
                  style={[styles.input, styles.inputWide, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
                  value={markNote}
                  onChangeText={setMarkNote}
                  placeholder="Virement, espèces…"
                  placeholderTextColor={theme.subText}
                />
              </View>

              <View style={{ padding: 14 }}>
                <TouchableOpacity
                  style={[styles.inlineBtn, { backgroundColor: theme.success, opacity: marking ? 0.7 : 1 }]}
                  onPress={handleMarkPaid}
                  disabled={marking}
                  activeOpacity={0.85}
                >
                  {marking ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="cash-outline" size={18} color="#fff" />
                      <Text style={styles.inlineBtnText}>Marquer comme payé</Text>
                    </>
                  )}
                </TouchableOpacity>
                <Text style={[styles.itemDesc, { color: theme.subText, marginTop: 8 }]}>
                  Enregistre un paiement déjà reçu et prolonge l&apos;échéance. Toujours disponible,
                  même en mode Mobile Money.
                </Text>
              </View>
            </View>

            {/* ── Historique des paiements ── */}
            <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={[styles.sectionHeader, { backgroundColor: theme.nav, borderBottomColor: theme.border }]}>
                <Ionicons name="time-outline" size={18} color={theme.primary} />
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Historique des paiements</Text>
                <View style={[styles.badge, { backgroundColor: theme.border }]}>
                  <Text style={[styles.badgeText, { color: theme.subText }]}>{payments.length}</Text>
                </View>
              </View>

              {payments.length === 0 ? (
                <View style={{ padding: 18, alignItems: 'center' }}>
                  <Text style={[styles.itemDesc, { color: theme.subText }]}>
                    Aucun paiement enregistré pour le moment.
                  </Text>
                </View>
              ) : (
                payments.map((payment, idx) => {
                  const color =
                    payment.status === 'completed'
                      ? theme.success
                      : payment.status === 'failed'
                        ? theme.danger
                        : theme.warning;
                  return (
                    <View
                      key={payment.id}
                      style={[
                        styles.itemRow,
                        { borderBottomColor: theme.border },
                        idx === payments.length - 1 && !paymentsHasMore && { borderBottomWidth: 0 },
                      ]}
                    >
                      <Ionicons
                        name={payment.source === 'sebpay' ? 'phone-portrait-outline' : 'receipt-outline'}
                        size={16}
                        color={color}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.itemLabel, { color: theme.text }]}>
                          {formatAmount(payment.amount)} XOF · {PLAN_LABELS[payment.plan] ?? payment.plan}
                        </Text>
                        <Text style={[styles.itemDesc, { color: theme.subText }]}>
                          {formatDate(payment.paid_at || payment.created_at)} ·{' '}
                          {payment.source === 'sebpay' ? 'Mobile Money' : 'Manuel'}
                        </Text>
                      </View>
                      <View style={[styles.badge, { backgroundColor: color + '22' }]}>
                        <Text style={[styles.badgeText, { color }]}>
                          {PAYMENT_STATUS_LABELS[payment.status] ?? payment.status}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}

              {paymentsHasMore && (
                <TouchableOpacity
                  style={{ padding: 14, alignItems: 'center' }}
                  onPress={() => loadPayments(paymentsPage + 1)}
                  disabled={paymentsLoading}
                >
                  {paymentsLoading ? (
                    <ActivityIndicator color={theme.primary} />
                  ) : (
                    <Text style={{ color: theme.primary, fontWeight: '600', fontSize: 13 }}>
                      Charger plus
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>

          {/* ── Bouton Enregistrer ── */}
          <View style={[styles.saveBar, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: theme.primary, opacity: saving ? 0.7 : 1 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={20} color="#fff" />
                  <Text style={styles.saveBtnText}>Enregistrer l&apos;abonnement</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 1 },
  statusBand: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statusText: { fontSize: 13, flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  sectionCard: {
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  sectionTitle: { flex: 1, fontSize: 15, fontWeight: '700' },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '600' },

  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  fieldLabel: { flex: 1, fontSize: 14, fontWeight: '500' },
  input: {
    width: 130,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
    textAlign: 'right',
  },
  inputWide: { width: 160, textAlign: 'left' },

  segment: { flexDirection: 'row', gap: 6 },
  segmentBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  segmentText: { fontSize: 12, fontWeight: '600' },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  itemLabel: { fontSize: 14, fontWeight: '500' },
  itemDesc: { fontSize: 11, marginTop: 2 },

  inlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 13,
    gap: 8,
  },
  inlineBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  saveBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 15,
    gap: 10,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
