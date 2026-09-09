import { api } from "./api";

// ── Types ──────────────────────────────────────────────────────────────────────

export type SubscriptionPlan = "monthly" | "annual";
export type SubscriptionStatus = "active" | "expired" | "cancelled";
export type PaymentMode = "manual" | "sebpay";

export type EnterpriseSubscription = {
  id: string;
  enterprise_id: string;
  plan: SubscriptionPlan;
  amount: string | number;
  current_period_start: string | null;
  current_period_end: string | null;
  status: SubscriptionStatus;
  payment_mode: PaymentMode;
  auto_cutoff_enabled: boolean;
  grace_period_days: number;
  sebpay_phone: string | null;
  sebpay_operator: string | null;
  sebpay_country: string | null;
  last_notified_expired_at?: string | null;
  last_cutoff_notified_at?: string | null;
  last_cutoff_applied_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type SubscriptionPayment = {
  id: string;
  enterprise_id: string;
  source: "manual" | "sebpay";
  plan: SubscriptionPlan;
  amount: string | number;
  period_start: string | null;
  period_end: string | null;
  status: "pending" | "completed" | "failed";
  external_reference: string | null;
  sebpay_transaction_id: string | null;
  recorded_by_user_id: string | null;
  paid_at: string | null;
  created_at: string;
};

export type PlanPrice = {
  plan: SubscriptionPlan;
  amount: number;
};

/**
 * Opérateur Mobile Money renvoyé par le proxy SebPay. Les noms de champs
 * exacts venant de l'API SebPay ne sont pas figés côté doc : on garde les
 * variantes probables en optionnel et on normalise via `operatorCode()` /
 * `operatorLabel()`.
 */
export type SebPayOperator = {
  id?: number;
  code?: string;
  slug?: string;
  name?: string;
  label?: string;
  country?: string;
  otp_required?: boolean;
  ussd_code?: string | null;
  active?: boolean;
  sort_order?: number;
};

export const operatorCode = (op: SebPayOperator): string =>
  op.code ?? op.slug ?? op.name ?? "";

export const operatorLabel = (op: SebPayOperator): string =>
  op.label ?? op.name ?? operatorCode(op);

// ── Helpers de normalisation ──────────────────────────────────────────────────

/** Le serveur peut renvoyer soit une liste paginée, soit un tableau brut. */
const asArray = (data: any): any[] => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

// ── Abonnement d'une entreprise (super-admin) ─────────────────────────────────

export async function getEnterpriseSubscription(enterpriseId: string): Promise<{
  success: boolean;
  subscription: EnterpriseSubscription | null;
  error?: string;
}> {
  try {
    const data = await api.getEnterpriseSubscription(enterpriseId);
    // L'entreprise peut ne pas encore avoir de ligne d'abonnement.
    const subscription = (data?.subscription ??
      data ??
      null) as EnterpriseSubscription | null;
    return { success: true, subscription };
  } catch (err: any) {
    return { success: false, subscription: null, error: err.message };
  }
}

export async function updateEnterpriseSubscription(
  enterpriseId: string,
  payload: Partial<EnterpriseSubscription>,
): Promise<{
  success: boolean;
  subscription?: EnterpriseSubscription;
  error?: string;
}> {
  try {
    const data = await api.updateEnterpriseSubscription(enterpriseId, payload);
    return {
      success: true,
      subscription: (data?.subscription ?? data) as EnterpriseSubscription,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Enregistre un paiement reçu hors application (virement, espèces...).
 * Toujours disponible, même en mode SebPay (garde-fou super-admin).
 */
export async function markEnterpriseSubscriptionPaid(
  enterpriseId: string,
  payload: {
    amount: number;
    plan: SubscriptionPlan;
    period_start?: string | null;
    period_end?: string | null;
    note?: string | null;
  },
): Promise<{
  success: boolean;
  subscription?: EnterpriseSubscription;
  error?: string;
}> {
  try {
    const data = await api.markEnterpriseSubscriptionPaid(
      enterpriseId,
      payload,
    );
    return {
      success: true,
      subscription: (data?.subscription ?? undefined) as EnterpriseSubscription,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getEnterpriseSubscriptionPayments(
  enterpriseId: string,
  page = 1,
): Promise<{
  success: boolean;
  payments: SubscriptionPayment[];
  hasMore: boolean;
  error?: string;
}> {
  try {
    const data = await api.getEnterpriseSubscriptionPayments(enterpriseId, {
      page,
    });
    const payments = asArray(data) as SubscriptionPayment[];
    // Pagination Laravel : `current_page` / `last_page` quand la réponse est
    // un paginator, sinon on considère qu'il n'y a qu'une page.
    const hasMore =
      typeof data?.current_page === "number" &&
      typeof data?.last_page === "number"
        ? data.current_page < data.last_page
        : false;
    return { success: true, payments, hasMore };
  } catch (err: any) {
    return { success: false, payments: [], hasMore: false, error: err.message };
  }
}

// ── Tarifs globaux ────────────────────────────────────────────────────────────

/**
 * Tarifs courants. Lecture ouverte à tout utilisateur authentifié : une
 * entreprise doit voir le prix avant de payer.
 */
export async function getSubscriptionPlanPrices(): Promise<{
  success: boolean;
  prices: Record<SubscriptionPlan, number | null>;
  error?: string;
}> {
  const empty: Record<SubscriptionPlan, number | null> = {
    monthly: null,
    annual: null,
  };
  try {
    const data = await api.getSubscriptionPlanPrices();
    const prices = { ...empty };
    asArray(data?.prices ?? data).forEach((row: any) => {
      if (row?.plan === "monthly" || row?.plan === "annual") {
        prices[row.plan as SubscriptionPlan] = Number(row.amount);
      }
    });
    // Variante "map" : { prices: { monthly: 5000, annual: 50000 } }
    const map =
      data?.prices && !Array.isArray(data.prices) ? data.prices : null;
    if (map) {
      if (map.monthly != null) prices.monthly = Number(map.monthly);
      if (map.annual != null) prices.annual = Number(map.annual);
    }
    return { success: true, prices };
  } catch (err: any) {
    return { success: false, prices: empty, error: err.message };
  }
}

export async function setSubscriptionPlanPrices(prices: {
  monthly: number;
  annual: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await api.updateSubscriptionPlanPrices(prices);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Fonctionnalités "premium" coupées automatiquement ─────────────────────────

export async function getSubscriptionGatedFeatures(): Promise<{
  success: boolean;
  featureKeys: string[];
  error?: string;
}> {
  try {
    const data = await api.getSubscriptionGatedFeatures();
    const featureKeys = asArray(data?.feature_keys ?? data)
      .map((row: any) => (typeof row === "string" ? row : row?.feature_key))
      .filter(Boolean) as string[];
    return { success: true, featureKeys };
  } catch (err: any) {
    return { success: false, featureKeys: [], error: err.message };
  }
}

export async function setSubscriptionGatedFeatures(
  featureKeys: string[],
): Promise<{ success: boolean; error?: string }> {
  try {
    await api.updateSubscriptionGatedFeatures(featureKeys);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Paiement mobile (self-service entreprise) ─────────────────────────────────

export async function getSebPayOperators(
  enterpriseId: string,
  country: string,
): Promise<{ success: boolean; operators: SebPayOperator[]; error?: string }> {
  try {
    const data = await api.getSebPayOperators(enterpriseId, country);
    return {
      success: true,
      operators: asArray(data?.operators ?? data) as SebPayOperator[],
    };
  } catch (err: any) {
    return { success: false, operators: [], error: err.message };
  }
}

export async function getSebPayOperatorCatalog(): Promise<{
  success: boolean;
  operators: SebPayOperator[];
  error?: string;
}> {
  try {
    const data = await api.getSebPayOperatorCatalog();
    return { success: true, operators: asArray(data) as SebPayOperator[] };
  } catch (err: any) {
    return { success: false, operators: [], error: err.message };
  }
}

export async function createSebPayOperator(payload: {
  country: string;
  code: string;
  label: string;
  active: boolean;
  otp_required: boolean;
  ussd_code?: string | null;
  sort_order: number;
}): Promise<{ success: boolean; operator?: SebPayOperator; error?: string }> {
  try {
    return { success: true, operator: await api.createSebPayOperator(payload) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateSebPayOperator(
  id: number,
  payload: Partial<SebPayOperator>,
): Promise<{ success: boolean; operator?: SebPayOperator; error?: string }> {
  try {
    return {
      success: true,
      operator: await api.updateSebPayOperator(id, payload),
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteSebPayOperator(
  id: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    await api.deleteSebPayOperator(id);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Déclenche le prélèvement Mobile Money. Réservé à l'admin de l'entreprise
 * elle-même côté serveur (le super-admin reçoit un 403 volontairement).
 */
export async function paySubscription(
  enterpriseId: string,
  payload: {
    plan: SubscriptionPlan;
    country: string;
    operator: string;
    phone: string;
    otp_code?: string;
  },
): Promise<{
  success: boolean;
  payment?: SubscriptionPayment;
  paymentId?: string;
  providerLink?: string | null;
  error?: string;
}> {
  try {
    const data = await api.paySubscription(enterpriseId, payload);
    const payment = (data?.payment ?? data) as SubscriptionPayment;
    return {
      success: true,
      payment,
      paymentId: payment?.id,
      providerLink: data?.provider_link ?? null,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/** Polling léger côté client — la source de vérité reste le webhook SebPay. */
export async function getSubscriptionPaymentStatus(
  enterpriseId: string,
  paymentId: string,
): Promise<{
  success: boolean;
  payment: SubscriptionPayment | null;
  status?: SubscriptionPayment["status"];
  error?: string;
}> {
  try {
    const data = await api.getSubscriptionPaymentStatus(
      enterpriseId,
      paymentId,
    );
    const payment = (data?.payment ?? data) as SubscriptionPayment;
    return { success: true, payment, status: payment?.status };
  } catch (err: any) {
    return { success: false, payment: null, error: err.message };
  }
}

// ── Supplément frais SebPay (config globale, super-admin) ─────────────────────

export type SurchargeMode = "fixed" | "percentage";

export type SebPaySurchargeConfig = {
  mode: SurchargeMode;
  value: string | number;
};

export async function getSebPaySurchargeConfig(): Promise<{
  success: boolean;
  config: SebPaySurchargeConfig;
  error?: string;
}> {
  const empty: SebPaySurchargeConfig = { mode: "percentage", value: 0 };
  try {
    const data = await api.getSebPaySurchargeConfig();
    return {
      success: true,
      config: { mode: data?.mode ?? "percentage", value: data?.value ?? 0 },
    };
  } catch (err: any) {
    return { success: false, config: empty, error: err.message };
  }
}

export async function setSebPaySurchargeConfig(
  config: SebPaySurchargeConfig,
): Promise<{ success: boolean; error?: string }> {
  try {
    await api.updateSebPaySurchargeConfig(config);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Décaissements SebPay (retraits du wallet du concepteur, super-admin) ──────

export type SebPayPayoutStatus = "pending" | "approved" | "rejected";

export type SebPayPayout = {
  id: string;
  recipient_name: string;
  phone: string;
  operator: string;
  country: string;
  amount: string | number;
  currency: string;
  external_reference: string;
  status: SebPayPayoutStatus;
  fee_amount: string | number | null;
  total_deducted: string | number | null;
  sebpay_transaction_id: string | null;
  description: string | null;
  created_at: string;
};

export async function getSebPayPayoutOperators(
  country: string,
): Promise<{ success: boolean; operators: SebPayOperator[]; error?: string }> {
  try {
    const data = await api.getSebPayPayoutOperators(country);
    return {
      success: true,
      operators: asArray(data?.operators ?? data) as SebPayOperator[],
    };
  } catch (err: any) {
    return { success: false, operators: [], error: err.message };
  }
}

export async function listSebPayPayouts(): Promise<{
  success: boolean;
  payouts: SebPayPayout[];
  error?: string;
}> {
  try {
    const data = await api.listSebPayPayouts();
    return { success: true, payouts: asArray(data) as SebPayPayout[] };
  } catch (err: any) {
    return { success: false, payouts: [], error: err.message };
  }
}

export async function createSebPayPayout(payload: {
  recipient_name: string;
  phone: string;
  operator: string;
  country: string;
  amount: number;
  currency?: string;
  description?: string;
}): Promise<{ success: boolean; payout?: SebPayPayout; error?: string }> {
  try {
    const data = await api.createSebPayPayout(payload);
    return { success: true, payout: data as SebPayPayout };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
