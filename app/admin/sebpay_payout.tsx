// app/admin/sebpay_payout.tsx
//
// Décaissements (retraits) du wallet SebPay du concepteur vers son propre
// numéro Mobile Money — réservé au super-admin, sans lien avec les
// entreprises clientes (voir SebPayPayoutController côté backend).

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTenant } from '../../context/TenantContext';
import { useTheme } from '../../context/ThemeContext';
import {
  createSebPayPayout,
  getSebPayPayoutOperators,
  listSebPayPayouts,
  operatorCode,
  operatorLabel,
  SebPayOperator,
  SebPayPayout,
} from '../../lib/enterpriseSubscription';

const formatAmount = (amount: string | number | null | undefined): string => {
  const n = Number(amount ?? 0);
  return Number.isFinite(n) ? n.toLocaleString('fr-FR') : '0';
};

const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'En cours',
  approved: 'Approuvé',
  rejected: 'Rejeté',
};

export default function SebPayPayoutScreen() {
  const { isSuperAdmin } = useTenant();
  const { theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [payouts, setPayouts] = useState<SebPayPayout[]>([]);

  const [recipientName, setRecipientName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [operators, setOperators] = useState<SebPayOperator[]>([]);
  const [operatorsLoading, setOperatorsLoading] = useState(false);
  const [selectedOperator, setSelectedOperator] = useState<SebPayOperator | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const result = await listSebPayPayouts();
    if (result.success) setPayouts(result.payouts);
    else Alert.alert('Erreur', result.error ?? 'Retraits indisponibles.');
    setLoading(false);
  };

  useEffect(() => {
    if (!isSuperAdmin) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadOperators = async (countryCode: string) => {
    const code = countryCode.trim().toUpperCase();
    if (code.length < 2) return;
    setOperatorsLoading(true);
    setSelectedOperator(null);
    const result = await getSebPayPayoutOperators(code);
    setOperatorsLoading(false);
    setOperators(result.operators);
    if (result.operators.length === 0) {
      Alert.alert('Aucun opérateur', `Aucun opérateur trouvé pour "${code}".`);
    }
  };

  const canSubmit =
    recipientName.trim().length > 0 &&
    phone.trim().length > 0 &&
    country.trim().length >= 2 &&
    !!selectedOperator &&
    Number(amount) > 0;

  const handleSubmit = () => {
    if (!canSubmit || !selectedOperator) return;

    Alert.alert(
      'Confirmer le retrait',
      `Envoyer ${formatAmount(amount)} XOF à ${recipientName.trim()} (${phone.trim()}) ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            setSubmitting(true);
            const result = await createSebPayPayout({
              recipient_name: recipientName.trim(),
              phone: phone.trim(),
              operator: operatorCode(selectedOperator),
              country: country.trim().toUpperCase(),
              amount: Number(amount),
              description: description.trim() || undefined,
            });
            setSubmitting(false);
            if (!result.success) {
              return Alert.alert('Erreur', result.error ?? 'Échec de la demande de retrait.');
            }
            setRecipientName('');
            setPhone('');
            setAmount('');
            setDescription('');
            setOperators([]);
            setSelectedOperator(null);
            setPayouts((prev) => (result.payout ? [result.payout, ...prev] : prev));
            Alert.alert('Retrait initié', 'Le statut final arrivera par webhook (approuvé ou rejeté).');
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 14 }}>
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Retraits SebPay</Text>
          <Text style={[styles.headerSub, { color: theme.subText }]} numberOfLines={1}>
            Décaissements depuis votre wallet
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <View style={[styles.noticeCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="information-circle-outline" size={16} color={theme.subText} />
          <Text style={[styles.noticeText, { color: theme.subText }]}>
            Le montant saisi est ce que le bénéficiaire reçoit — les frais SebPay sont en plus,
            débités de votre solde. Le statut final (approuvé/rejeté) arrive de façon asynchrone.
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>Nouveau retrait</Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, padding: 14 }]}>
          <Text style={[styles.fieldLabel, { color: theme.subText }]}>Nom du bénéficiaire</Text>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
            value={recipientName}
            onChangeText={setRecipientName}
            placeholder="Jean Dupont"
            placeholderTextColor={theme.subText}
          />

          <Text style={[styles.fieldLabel, { color: theme.subText }]}>Pays (code ISO)</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              style={[styles.input, { flex: 1, color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
              value={country}
              onChangeText={(t) => setCountry(t.toUpperCase())}
              placeholder="BJ, CI, SN, BF…"
              placeholderTextColor={theme.subText}
              autoCapitalize="characters"
              maxLength={2}
            />
            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: theme.primary }]}
              onPress={() => loadOperators(country)}
              disabled={operatorsLoading}
              activeOpacity={0.8}
            >
              {operatorsLoading ? (
                <ActivityIndicator color={theme.primary} />
              ) : (
                <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 14 }}>Opérateurs</Text>
              )}
            </TouchableOpacity>
          </View>

          {operators.length > 0 && (
            <>
              <Text style={[styles.fieldLabel, { color: theme.subText }]}>Opérateur</Text>
              {operators.map((op) => {
                const code = operatorCode(op);
                const selected = selectedOperator && operatorCode(selectedOperator) === code;
                return (
                  <TouchableOpacity
                    key={code || operatorLabel(op)}
                    style={[
                      styles.operatorRow,
                      {
                        borderColor: selected ? theme.primary : theme.border,
                        backgroundColor: selected ? theme.primary + '11' : 'transparent',
                      },
                    ]}
                    onPress={() => setSelectedOperator(op)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={selected ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={selected ? theme.primary : theme.subText}
                    />
                    <Text style={[styles.operatorLabel, { color: theme.text }]}>{operatorLabel(op)}</Text>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          <Text style={[styles.fieldLabel, { color: theme.subText }]}>Numéro Mobile Money</Text>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
            value={phone}
            onChangeText={setPhone}
            placeholder="22997000000"
            placeholderTextColor={theme.subText}
            keyboardType="phone-pad"
          />

          <Text style={[styles.fieldLabel, { color: theme.subText }]}>Montant reçu (XOF)</Text>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))}
            placeholder="0"
            placeholderTextColor={theme.subText}
            keyboardType="number-pad"
          />

          <Text style={[styles.fieldLabel, { color: theme.subText }]}>Description (optionnel)</Text>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
            value={description}
            onChangeText={setDescription}
            placeholder="Référence interne"
            placeholderTextColor={theme.subText}
          />

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: theme.primary, opacity: canSubmit && !submitting ? 1 : 0.5 }]}
            onPress={handleSubmit}
            disabled={!canSubmit || submitting}
          >
            <Text style={styles.submitBtnText}>{submitting ? 'Envoi…' : 'Demander le retrait'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 24 }]}>Historique</Text>
        {loading ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 12 }} />
        ) : payouts.length === 0 ? (
          <Text style={{ color: theme.subText, fontSize: 13 }}>Aucun retrait pour l&apos;instant.</Text>
        ) : (
          payouts.map((p) => {
            const statusColor =
              p.status === 'approved' ? '#34C759' : p.status === 'rejected' ? '#FF3B30' : '#FF9F0A';
            return (
              <View key={p.id} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, padding: 14 }]}>
                <View style={styles.payoutRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemLabel, { color: theme.text }]}>{p.recipient_name}</Text>
                    <Text style={{ color: theme.subText, fontSize: 12, marginTop: 2 }}>
                      {formatAmount(p.amount)} {p.currency} · {formatDate(p.created_at)}
                    </Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: statusColor + '1A' }]}>
                    <Text style={{ color: statusColor, fontSize: 12, fontWeight: '700' }}>
                      {STATUS_LABELS[p.status] ?? p.status}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 2 },
  noticeCard: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 20,
  },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 18 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  card: { borderRadius: 14, borderWidth: 1, marginBottom: 12, overflow: 'hidden' },
  fieldLabel: { fontSize: 12, marginTop: 10, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 },
  secondaryBtn: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  operatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
  },
  operatorLabel: { fontSize: 14, fontWeight: '600' },
  submitBtn: { borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 16 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  itemLabel: { fontSize: 14, fontWeight: '600' },
  payoutRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
});
