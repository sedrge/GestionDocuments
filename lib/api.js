import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

// Adresse du serveur Laravel, configurée dans app.config.js (extra.laravelApiUrl).
const API_URL = Constants.expoConfig.extra.laravelApiUrl;

const TOKEN_KEY = "laravel_token";

export async function getToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function setToken(token) {
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// Upload multipart (FormData) via XMLHttpRequest plutôt que fetch : le fetch
// installé par défaut par Expo (WinterCG) ne sait pas encoder les pièces
// jointes au format RN {uri, name, type} et lève "Unsupported FormDataPart
// implementation" sur les vrais builds (le flag EXPO_PUBLIC_USE_RN_FETCH=1
// ne suffit pas à empêcher ça de façon fiable en production, voir eas.json).
// XMLHttpRequest est un module natif RN, jamais remplacé par Expo — le fetch
// RN classique repose d'ailleurs lui-même dessus.
function requestForm(path, { method = "POST", body, headers = {} }, token) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, `${API_URL}${path}`);
    xhr.setRequestHeader("Accept", "application/json");
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    Object.entries(headers).forEach(([key, value]) =>
      xhr.setRequestHeader(key, value),
    );

    xhr.onload = () => {
      let data = null;
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        data = xhr.responseText;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        const error = new Error(data?.message || `Erreur HTTP ${xhr.status}`);
        error.status = xhr.status;
        error.data = data;
        reject(error);
        return;
      }
      resolve(data);
    };
    xhr.onerror = () => reject(new Error("Erreur réseau."));
    xhr.send(body);
  });
}

async function request(
  path,
  { method = "GET", body, isForm = false, headers = {} } = {},
) {
  const token = await getToken();

  if (isForm) return requestForm(path, { method, body, headers }, token);

  const finalHeaders = {
    Accept: "application/json",
    ...headers,
  };
  if (token) finalHeaders.Authorization = `Bearer ${token}`;
  if (body !== undefined) finalHeaders["Content-Type"] = "application/json";

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const error = new Error(data?.message || `Erreur HTTP ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  // --- Auth ---
  register: (payload) =>
    request("/auth/register", { method: "POST", body: payload }),
  verifyEmail: (payload) =>
    request("/auth/verify-email", { method: "POST", body: payload }),
  resendVerification: (payload) =>
    request("/auth/resend-verification", { method: "POST", body: payload }),
  forgotPassword: (payload) =>
    request("/auth/forgot-password", { method: "POST", body: payload }),
  resetPassword: (payload) =>
    request("/auth/reset-password", { method: "POST", body: payload }),
  login: async (payload) => {
    const data = await request("/auth/login", {
      method: "POST",
      body: payload,
    });
    await setToken(data.token);
    return data;
  },
  logout: async () => {
    // La déconnexion locale doit toujours réussir, même si l'appel serveur
    // échoue (réseau, token déjà expiré/révoqué...) — sinon l'utilisateur
    // reste bloqué sans pouvoir se déconnecter (certains écrans appellent
    // logout() sans .catch()).
    try {
      await request("/auth/logout", { method: "POST" });
    } catch {
      // Session déjà invalide côté serveur ou requête échouée : pas grave,
      // on nettoie quand même la session locale ci-dessous.
    } finally {
      await setToken(null);
    }
  },
  me: () => request("/auth/me"),
  checkSuperAdminExists: () => request("/auth/check-super-admin"),
  registerSuperAdmin: (payload) =>
    request("/auth/register-super-admin", { method: "POST", body: payload }),
  getSuperAdminConfig: () => request("/super-admin-config"),
  updateSuperAdminConfig: (payload) =>
    request("/super-admin-config", { method: "PUT", body: payload }),

  // --- Entreprises ---
  listEnterprises: () => request("/enterprises"),
  getEnterprise: (id) => request(`/enterprises/${id}`),
  createEnterprise: async (payload) => {
    const isForm = typeof payload?.append === "function";
    return request("/enterprises", {
      method: "POST",
      body: payload,
      isForm,
    });
  },
  uploadEnterpriseLogo: (enterpriseId, form) =>
    request(`/enterprises/${enterpriseId}/logo`, {
      method: "POST",
      body: form,
      isForm: true,
    }),

  // --- Contact entreprise (public) ---
  getEnterpriseContact: (enterpriseId) =>
    request(`/enterprises/${enterpriseId}/contact`),
  updateEnterpriseContact: (enterpriseId, payload) =>
    request(`/enterprises/${enterpriseId}/contact`, {
      method: "PUT",
      body: payload,
    }),
  deleteEnterpriseContact: (enterpriseId) =>
    request(`/enterprises/${enterpriseId}/contact`, { method: "DELETE" }),

  // --- Entreprises (super-admin) ---
  listPendingEnterprises: () => request("/enterprises/pending"),
  listActiveEnterprisesDetailed: () => request("/enterprises/active-detailed"),
  getEnterpriseStats: () => request("/enterprises/stats"),
  activateEnterprise: (id) =>
    request(`/enterprises/${id}/activate`, { method: "PATCH" }),
  deactivateEnterprise: (id) =>
    request(`/enterprises/${id}/deactivate`, { method: "PATCH" }),
  deleteEnterprise: (id) => request(`/enterprises/${id}`, { method: "DELETE" }),
  regenerateEnterpriseCode: (id) =>
    request(`/enterprises/${id}/regenerate-code`, { method: "PATCH" }),

  // --- Magasins (entreprises enfants) ---
  // Un magasin est une entreprise avec `parent_enterprise_id` : activation,
  // modification et gestion des membres passent par les routes génériques
  // /enterprises/{id} habituelles, il n'y a donc que la liste et la création
  // à exposer ici. `logo_url` est une simple chaîne (pas d'upload de fichier),
  // d'où des requêtes JSON classiques et non du FormData.
  listEnterpriseStores: (enterpriseId) =>
    request(`/enterprises/${enterpriseId}/stores`),
  createEnterpriseStore: (enterpriseId, payload) =>
    request(`/enterprises/${enterpriseId}/stores`, {
      method: "POST",
      body: payload,
    }),

  // --- Features entreprise ---
  // Lecture : ouverte à tout membre de l'entreprise (gating client).
  // Écriture (features/quotas/usage) : réservée au super-admin.
  getEnterpriseFeatures: (enterpriseId) =>
    request(`/enterprises/${enterpriseId}/features`),
  updateEnterpriseFeatures: (enterpriseId, features) =>
    request(`/enterprises/${enterpriseId}/features`, {
      method: "PUT",
      body: { features },
    }),
  getEnterpriseFeatureQuotas: (enterpriseId) =>
    request(`/enterprises/${enterpriseId}/feature-quotas`),
  updateEnterpriseFeatureQuota: (enterpriseId, featureKey, dailyLimit) =>
    request(`/enterprises/${enterpriseId}/feature-quotas/${featureKey}`, {
      method: "PUT",
      body: { daily_limit: dailyLimit },
    }),

  // --- Abonnement entreprise (gestion super-admin) ---
  getEnterpriseSubscription: (enterpriseId) =>
    request(`/enterprises/${enterpriseId}/subscription`),
  updateEnterpriseSubscription: (enterpriseId, payload) =>
    request(`/enterprises/${enterpriseId}/subscription`, {
      method: "PUT",
      body: payload,
    }),
  // payload : { amount, plan, period_start?, period_end?, note? }
  markEnterpriseSubscriptionPaid: (enterpriseId, payload) =>
    request(`/enterprises/${enterpriseId}/subscription/mark-paid`, {
      method: "POST",
      body: payload,
    }),
  getEnterpriseSubscriptionPayments: (enterpriseId, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(
      query
        ? `/enterprises/${enterpriseId}/subscription/payments?${query}`
        : `/enterprises/${enterpriseId}/subscription/payments`,
    );
  },

  // --- Tarifs & fonctionnalités premium (config globale) ---
  // Lecture des tarifs ouverte à tout utilisateur authentifié (l'entreprise
  // doit voir le prix courant pour payer) ; écriture réservée au super-admin.
  getSubscriptionPlanPrices: () => request("/subscription-plan-prices"),
  updateSubscriptionPlanPrices: (prices) =>
    request("/subscription-plan-prices", { method: "PUT", body: { prices } }),
  getSubscriptionGatedFeatures: () => request("/subscription-gated-features"),
  updateSubscriptionGatedFeatures: (featureKeys) =>
    request("/subscription-gated-features", {
      method: "PUT",
      body: { feature_keys: featureKeys },
    }),

  // --- Aide (guide d'utilisation + contact concepteur, config globale) ---
  // Lecture ouverte à tout utilisateur connecté, écriture réservée au super-admin.
  getHelpItems: () => request("/help-items"),
  // form : FormData (type, title, body?, media fichier requis si type video/audio).
  createHelpItem: (form) =>
    request("/help-items", { method: "POST", body: form, isForm: true }),
  // Pour l'upload vidéo/audio via expo-file-system (createUploadTask),
  // même contournement que publicationsUploadUrl.
  helpItemsUploadUrl: () => `${API_URL}/help-items`,
  updateHelpItem: (id, payload) =>
    request(`/help-items/${id}`, { method: "PATCH", body: payload }),
  deleteHelpItem: (id) => request(`/help-items/${id}`, { method: "DELETE" }),
  reorderHelpItems: (ids) =>
    request("/help-items/reorder", { method: "POST", body: { ids } }),

  getSupportContact: () => request("/support-contact"),
  updateSupportContact: (payload) =>
    request("/support-contact", { method: "PUT", body: payload }),

  // --- Paiement mobile SebPay (self-service entreprise) ---
  // Les clés SebPay ne transitent jamais par le mobile : tout passe par le
  // proxy Laravel.
  getSebPayOperators: (enterpriseId, country, plan) =>
    request(
      `/enterprises/${enterpriseId}/subscription/operators?country=${encodeURIComponent(country)}&plan=${encodeURIComponent(plan || "monthly")}`,
    ),
  getSebPayOperatorCatalog: () => request("/sebpay-operators?all=1"),
  createSebPayOperator: (payload) =>
    request("/sebpay-operators", { method: "POST", body: payload }),
  updateSebPayOperator: (id, payload) =>
    request(`/sebpay-operators/${id}`, { method: "PATCH", body: payload }),
  deleteSebPayOperator: (id) =>
    request(`/sebpay-operators/${id}`, { method: "DELETE" }),
  // payload : { plan, country, operator, phone, otp_code? }
  // Réservé à l'admin de l'entreprise elle-même (le super-admin reçoit un 403 :
  // un prélèvement ne peut être déclenché que par le payeur).
  paySubscription: (enterpriseId, payload) =>
    request(`/enterprises/${enterpriseId}/subscription/pay`, {
      method: "POST",
      body: payload,
    }),
  getSubscriptionPaymentStatus: (enterpriseId, paymentId) =>
    request(`/enterprises/${enterpriseId}/subscription/payments/${paymentId}`),

  // --- Supplément frais SebPay (config globale, super-admin) ---
  // Ajouté au prix de l'abonnement lors d'un paiement self-service, pour
  // compenser la commission SebPay (absorbée par le marchand par défaut).
  getSebPaySurchargeConfig: () => request("/sebpay-surcharge-config"),
  updateSebPaySurchargeConfig: (payload) =>
    request("/sebpay-surcharge-config", { method: "PUT", body: payload }),

  // --- Décaissements SebPay (retraits du wallet du concepteur, super-admin) ---
  getSebPayPayoutOperators: (country) =>
    request(`/sebpay-payouts/operators?country=${encodeURIComponent(country)}`),
  listSebPayPayouts: () => request("/sebpay-payouts"),
  // payload : { recipient_name, phone, operator, country, amount, currency?, description? }
  createSebPayPayout: (payload) =>
    request("/sebpay-payouts", { method: "POST", body: payload }),
  getSebPayPayout: (id) => request(`/sebpay-payouts/${id}`),

  // --- Permissions de menu par utilisateur ---
  getUserMenuPermissions: (enterpriseId, userId) =>
    request(`/enterprises/${enterpriseId}/members/${userId}/menu-permissions`),
  updateUserMenuPermissions: (enterpriseId, userId, permissions) =>
    request(`/enterprises/${enterpriseId}/members/${userId}/menu-permissions`, {
      method: "PUT",
      body: { permissions },
    }),
  deleteUserMenuPermissions: (enterpriseId, userId) =>
    request(`/enterprises/${enterpriseId}/members/${userId}/menu-permissions`, {
      method: "DELETE",
    }),

  // --- Visibilité des données d'équipe par utilisateur ---
  getDataVisibilityPermissions: (enterpriseId, userId) =>
    request(
      `/enterprises/${enterpriseId}/members/${userId}/data-visibility-permissions`,
    ),
  updateDataVisibilityPermissions: (enterpriseId, userId, permissions) =>
    request(
      `/enterprises/${enterpriseId}/members/${userId}/data-visibility-permissions`,
      {
        method: "PUT",
        body: { permissions },
      },
    ),
  deleteDataVisibilityPermissions: (enterpriseId, userId) =>
    request(
      `/enterprises/${enterpriseId}/members/${userId}/data-visibility-permissions`,
      {
        method: "DELETE",
      },
    ),
  getEnterpriseFeatureUsageToday: (enterpriseId) =>
    request(`/enterprises/${enterpriseId}/feature-usage-today`),
  // Consomme une utilisation du jour ; lève une erreur (403 feature_disabled
  // ou 429 quota_exceeded) si le quota est atteint ou la feature désactivée.
  checkFeatureUsage: (enterpriseId, featureKey) =>
    request(`/enterprises/${enterpriseId}/features/${featureKey}/check-usage`, {
      method: "POST",
    }),

  // --- Membres d'entreprise (admin) ---
  listPendingMembers: (enterpriseId) =>
    request(`/enterprises/${enterpriseId}/members/pending`),
  listActiveMembers: (enterpriseId) =>
    request(`/enterprises/${enterpriseId}/members/active`),
  createEnterpriseMember: (enterpriseId, payload) =>
    request(`/enterprises/${enterpriseId}/members`, {
      method: "POST",
      body: payload,
    }),
  activateMember: (enterpriseId, userId) =>
    request(`/enterprises/${enterpriseId}/members/${userId}/activate`, {
      method: "PATCH",
    }),
  deactivateMember: (enterpriseId, userId) =>
    request(`/enterprises/${enterpriseId}/members/${userId}/deactivate`, {
      method: "PATCH",
    }),
  removeMember: (enterpriseId, userId) =>
    request(`/enterprises/${enterpriseId}/members/${userId}`, {
      method: "DELETE",
    }),

  // --- Invitations ---
  createInvitation: (enterpriseId, payload) =>
    request(`/enterprises/${enterpriseId}/invitations`, {
      method: "POST",
      body: payload,
    }),
  getInvitation: (token) => request(`/invitations/${token}`),
  acceptInvitation: (token) =>
    request(`/invitations/${token}/accept`, { method: "POST", body: {} }),

  // --- Categories ---
  listCategories: () => request("/categories"),
  createCategory: (payload) =>
    request("/categories", { method: "POST", body: payload }),
  updateCategory: (id, payload) =>
    request(`/categories/${id}`, { method: "PATCH", body: payload }),
  deleteCategory: (id) => request(`/categories/${id}`, { method: "DELETE" }),

  // --- Documents ---
  listDocuments: () => request("/documents"),
  uploadDocument: (form) =>
    request("/documents", { method: "POST", body: form, isForm: true }),
  deleteDocument: (id) => request(`/documents/${id}`, { method: "DELETE" }),
  updateDocument: (id, payload) =>
    request(`/documents/${id}`, { method: "PATCH", body: payload }),
  // Fichier privé (disque non public) : à télécharger avec un header
  // Authorization, jamais comme une URL directe (voir handleOpenDoc, home.tsx).
  documentDownloadUrl: (id) => `${API_URL}/documents/${id}/download`,

  // --- Motos ---
  listPublicMotos: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(query ? `/motos?${query}` : "/motos");
  },
  getMoto: (id) => request(`/motos/${id}`),
  listMyMotos: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(query ? `/motos/mine?${query}` : "/motos/mine");
  },
  createMoto: (payload) => request("/motos", { method: "POST", body: payload }),
  updateMoto: (id, payload) =>
    request(`/motos/${id}`, { method: "PATCH", body: payload }),
  deleteMoto: (id) => request(`/motos/${id}`, { method: "DELETE" }),
  // increment=false décrémente (toggle "j'aime" côté client, sans compte).
  likeMoto: (id, increment = true) =>
    request(`/motos/${id}/like`, { method: "POST", body: { increment } }),
  uploadMotoImage: (motoId, form) =>
    request(`/motos/${motoId}/images`, {
      method: "POST",
      body: form,
      isForm: true,
    }),
  updateMotoImage: (id, payload) =>
    request(`/moto-images/${id}`, { method: "PATCH", body: payload }),
  deleteMotoImage: (id) => request(`/moto-images/${id}`, { method: "DELETE" }),

  // --- Rendez-vous ---
  listRendezVous: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(query ? `/rendez-vous?${query}` : "/rendez-vous");
  },
  getRendezVous: (id) => request(`/rendez-vous/${id}`),
  createRendezVous: (payload) =>
    request("/rendez-vous", { method: "POST", body: payload }),
  updateRendezVous: (id, payload) =>
    request(`/rendez-vous/${id}`, { method: "PATCH", body: payload }),
  deleteRendezVous: (id) => request(`/rendez-vous/${id}`, { method: "DELETE" }),

  // --- Push token ---
  registerPushToken: (expoToken, deviceName) =>
    request("/push-token", {
      method: "POST",
      body: { expo_token: expoToken, device_name: deviceName },
    }),
  removePushToken: () => request("/push-token", { method: "DELETE" }),

  // --- Notifications ---
  listNotifications: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(query ? `/notifications?${query}` : "/notifications");
  },
  createNotification: (payload) =>
    request("/notifications", { method: "POST", body: payload }),
  markNotificationRead: (id) =>
    request(`/notifications/${id}/read`, { method: "PATCH" }),
  cancelNotification: (id) =>
    request(`/notifications/${id}/cancel`, { method: "PATCH" }),
  deleteNotification: (id) =>
    request(`/notifications/${id}`, { method: "DELETE" }),
  countUnreadNotifications: () => request("/notifications/unread/count"),

  // --- Paramètres Entreprise ---
  // Entête reçu/facture : une ligne par entreprise (parent ou magasin), d'où
  // enterpriseId (tenant.enterprise_id courant) sur les trois appels — sans
  // ça, un même utilisateur basculant entre son entreprise et un magasin
  // verrait/modifierait toujours la même entête (voir migration
  // scope_entreprise_parametres_by_enterprise côté serveur).
  getEnterpriseSettings: (enterpriseId) =>
    request(`/entreprise-parametres?enterprise_id=${enterpriseId}`),
  // form : FormData (champs texte + éventuellement "logo" fichier). POST +
  // _method=PATCH pour que PHP peuple $_FILES (cf registres/decharges/recus).
  updateEnterpriseSettings: (form, enterpriseId) => {
    form.append("enterprise_id", enterpriseId);
    form.append("_method", "PATCH");
    return request("/entreprise-parametres", {
      method: "POST",
      body: form,
      isForm: true,
    });
  },
  enterpriseLogoUrl: (enterpriseId) =>
    `${API_URL}/entreprise-parametres/logo?enterprise_id=${enterpriseId}`,

  // --- Années / Mois (registres) ---
  listAnneesMois: () => request("/annees-mois"),
  createAnneeMois: (payload) =>
    request("/annees-mois", { method: "POST", body: payload }),
  updateAnneeMois: (id, payload) =>
    request(`/annees-mois/${id}`, { method: "PATCH", body: payload }),
  deleteAnneeMois: (id) => request(`/annees-mois/${id}`, { method: "DELETE" }),

  // --- Années / Mois (décharges) ---
  listAnneesMoisDecharge: () => request("/annees-mois-decharge"),
  createAnneeMoisDecharge: (payload) =>
    request("/annees-mois-decharge", { method: "POST", body: payload }),
  updateAnneeMoisDecharge: (id, payload) =>
    request(`/annees-mois-decharge/${id}`, { method: "PATCH", body: payload }),
  deleteAnneeMoisDecharge: (id) =>
    request(`/annees-mois-decharge/${id}`, { method: "DELETE" }),

  // --- Années / Mois (reçus) ---
  listAnneesMoisRecu: () => request("/annees-mois-recu"),
  createAnneeMoisRecu: (payload) =>
    request("/annees-mois-recu", { method: "POST", body: payload }),
  updateAnneeMoisRecu: (id, payload) =>
    request(`/annees-mois-recu/${id}`, { method: "PATCH", body: payload }),
  deleteAnneeMoisRecu: (id) =>
    request(`/annees-mois-recu/${id}`, { method: "DELETE" }),

  // --- Registres, Recus, Decharges ---
  // create/update en isForm:true : ces ressources ont des champs photo/signature
  // (upload multipart). update() passe par POST + _method=PATCH (method
  // spoofing Laravel) car PHP ne peuple $_FILES que sur une vraie requête POST,
  // jamais sur PATCH/PUT natif — un PATCH multipart direct perdrait les fichiers.
  listRegistres: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/registres?${query}`);
  },
  getRegistre: (id) => request(`/registres/${id}`),
  createRegistre: (form) =>
    request("/registres", { method: "POST", body: form, isForm: true }),
  updateRegistre: (id, form) => {
    form.append("_method", "PATCH");
    return request(`/registres/${id}`, {
      method: "POST",
      body: form,
      isForm: true,
    });
  },
  deleteRegistre: (id) => request(`/registres/${id}`, { method: "DELETE" }),

  listRecus: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/recus?${query}`);
  },
  getRecu: (id) => request(`/recus/${id}`),
  createRecu: (form) =>
    request("/recus", { method: "POST", body: form, isForm: true }),
  updateRecu: (id, form) => {
    form.append("_method", "PATCH");
    return request(`/recus/${id}`, {
      method: "POST",
      body: form,
      isForm: true,
    });
  },
  deleteRecu: (id) => request(`/recus/${id}`, { method: "DELETE" }),

  listDecharges: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/decharges?${query}`);
  },
  getDecharge: (id) => request(`/decharges/${id}`),
  createDecharge: (form) =>
    request("/decharges", { method: "POST", body: form, isForm: true }),
  updateDecharge: (id, form) => {
    form.append("_method", "PATCH");
    return request(`/decharges/${id}`, {
      method: "POST",
      body: form,
      isForm: true,
    });
  },
  deleteDecharge: (id) => request(`/decharges/${id}`, { method: "DELETE" }),

  // URL d'un fichier privé (photo/signature) — à combiner avec un header
  // Authorization (voir components/AuthImage.tsx), le disque n'étant pas public.
  fileUrl: (resource, id, field) =>
    `${API_URL}/${resource}/${id}/files/${field}`,

  // --- Stockage ---
  getStorageUsage: () => request("/storage-usage"),

  // --- Audit ---
  listAuditLogs: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/audit-logs?${query}`);
  },
  logAction: (payload) =>
    request("/audit-logs", { method: "POST", body: payload }),

  // --- Chat (admin, Sanctum) ---
  listEnterpriseChats: (enterpriseId) =>
    request(`/enterprises/${enterpriseId}/chats`),
  getChat: (chatId) => request(`/chats/${chatId}`),
  updateChat: (chatId, payload) =>
    request(`/chats/${chatId}`, { method: "PATCH", body: payload }),
  sendAdminMessage: (chatId, message) =>
    request(`/chats/${chatId}/messages`, { method: "POST", body: { message } }),
  // Pour l'upload d'un message vocal via expo-file-system (createUploadTask),
  // même contournement que helpItemsUploadUrl.
  chatMessageUploadUrl: (chatId) => `${API_URL}/chats/${chatId}/messages`,

  // --- Chat (client anonyme, via client_token) ---
  startChat: (enterpriseId, payload) =>
    request(`/enterprises/${enterpriseId}/chats`, {
      method: "POST",
      body: payload,
    }),
  getPublicChat: (chatId, clientToken) =>
    request(`/public-chats/${chatId}`, {
      headers: { "X-Client-Token": clientToken },
    }),
  sendClientMessage: (chatId, clientToken, message) =>
    request(`/public-chats/${chatId}/messages`, {
      method: "POST",
      body: { message },
      headers: { "X-Client-Token": clientToken },
    }),
  // Pour l'upload d'un message vocal via expo-file-system (createUploadTask),
  // même contournement que helpItemsUploadUrl.
  publicChatMessageUploadUrl: (chatId) =>
    `${API_URL}/public-chats/${chatId}/messages`,

  // --- Publications (réseaux sociaux) ---
  // Fil public toutes entreprises confondues (accueil anonyme).
  listPublicPublications: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(query ? `/publications?${query}` : "/publications");
  },
  likePublication: (id, increment = true) =>
    request(`/publications/${id}/like`, {
      method: "POST",
      body: { increment },
    }),
  listPublications: (enterpriseId) =>
    request(`/enterprises/${enterpriseId}/publications`),
  // form : FormData (images[] fichiers et/ou source_images[] URLs déjà
  // hébergées, texte, selected_platforms[], scheduled_at, is_auto_generated).
  createPublication: (form) =>
    request("/publications", { method: "POST", body: form, isForm: true }),
  // Pour l'upload vidéo via expo-file-system (createUploadTask), qui
  // contourne fetch/FormData — voir handleSave dans admin/publications.tsx.
  publicationsUploadUrl: () => `${API_URL}/publications`,
  updatePublication: (id, payload) =>
    request(`/publications/${id}`, { method: "PATCH", body: payload }),
  deletePublication: (id) =>
    request(`/publications/${id}`, { method: "DELETE" }),
  // Publie immédiatement sur une plateforme donnée (idempotent côté serveur).
  publishPublicationToPlatform: (id, platform) =>
    request(`/publications/${id}/publish`, {
      method: "POST",
      body: { platform },
    }),
  listSocialConnections: (enterpriseId) =>
    request(`/enterprises/${enterpriseId}/social-connections`),
  // Renvoie { url } : URL d'autorisation OAuth à ouvrir dans un navigateur
  // in-app (WebBrowser.openAuthSessionAsync), qui redirige ensuite vers le
  // deep link docvault://fb-connect-result / tiktok-connect-result.
  startFacebookConnect: (enterpriseId) =>
    request(`/enterprises/${enterpriseId}/facebook/connect`),
  startTikTokConnect: (enterpriseId) =>
    request(`/enterprises/${enterpriseId}/tiktok/connect`),
  deleteFacebookConnection: (enterpriseId) =>
    request(`/enterprises/${enterpriseId}/social-connections/facebook`, {
      method: "DELETE",
    }),
  deleteTiktokConnection: (enterpriseId) =>
    request(`/enterprises/${enterpriseId}/social-connections/tiktok`, {
      method: "DELETE",
    }),
};
