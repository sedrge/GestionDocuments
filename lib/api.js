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

async function request(
  path,
  { method = "GET", body, isForm = false, headers = {} } = {},
) {
  const token = await getToken();
  const finalHeaders = {
    Accept: "application/json",
    ...headers,
  };
  if (token) finalHeaders.Authorization = `Bearer ${token}`;
  if (!isForm && body !== undefined)
    finalHeaders["Content-Type"] = "application/json";

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: finalHeaders,
    body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
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
  createEnterprise: (payload) =>
    request("/enterprises", { method: "POST", body: payload }),

  // --- Contact entreprise (public) ---
  getEnterpriseContact: (enterpriseId) =>
    request(`/enterprises/${enterpriseId}/contact`),
  updateEnterpriseContact: (enterpriseId, payload) =>
    request(`/enterprises/${enterpriseId}/contact`, { method: "PUT", body: payload }),
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
    request(`/enterprises/${enterpriseId}/members/${userId}/data-visibility-permissions`),
  updateDataVisibilityPermissions: (enterpriseId, userId, permissions) =>
    request(`/enterprises/${enterpriseId}/members/${userId}/data-visibility-permissions`, {
      method: "PUT",
      body: { permissions },
    }),
  deleteDataVisibilityPermissions: (enterpriseId, userId) =>
    request(`/enterprises/${enterpriseId}/members/${userId}/data-visibility-permissions`, {
      method: "DELETE",
    }),
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
  getEnterpriseSettings: () => request("/entreprise-parametres"),
  // form : FormData (champs texte + éventuellement "logo" fichier). POST +
  // _method=PATCH pour que PHP peuple $_FILES (cf registres/decharges/recus).
  updateEnterpriseSettings: (form) => {
    form.append("_method", "PATCH");
    return request("/entreprise-parametres", { method: "POST", body: form, isForm: true });
  },
  enterpriseLogoUrl: () => `${API_URL}/entreprise-parametres/logo`,

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
    return request(`/registres/${id}`, { method: "POST", body: form, isForm: true });
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
    return request(`/recus/${id}`, { method: "POST", body: form, isForm: true });
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
    return request(`/decharges/${id}`, { method: "POST", body: form, isForm: true });
  },
  deleteDecharge: (id) => request(`/decharges/${id}`, { method: "DELETE" }),

  // URL d'un fichier privé (photo/signature) — à combiner avec un header
  // Authorization (voir components/AuthImage.tsx), le disque n'étant pas public.
  fileUrl: (resource, id, field) => `${API_URL}/${resource}/${id}/files/${field}`,

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

  // --- Publications (réseaux sociaux) ---
  // Fil public toutes entreprises confondues (accueil anonyme).
  listPublicPublications: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(query ? `/publications?${query}` : "/publications");
  },
  likePublication: (id, increment = true) =>
    request(`/publications/${id}/like`, { method: "POST", body: { increment } }),
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
  deletePublication: (id) => request(`/publications/${id}`, { method: "DELETE" }),
  // Publie immédiatement sur une plateforme donnée (idempotent côté serveur).
  publishPublicationToPlatform: (id, platform) =>
    request(`/publications/${id}/publish`, { method: "POST", body: { platform } }),
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
    request(`/enterprises/${enterpriseId}/social-connections/facebook`, { method: "DELETE" }),
  deleteTiktokConnection: (enterpriseId) =>
    request(`/enterprises/${enterpriseId}/social-connections/tiktok`, { method: "DELETE" }),
};
