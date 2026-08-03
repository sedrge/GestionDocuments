import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

// Adresse du serveur Laravel local, configurée dans app.config.js (extra.laravelApiUrl).
// Doit être l'IP LAN de ce PC (pas localhost) pour être joignable depuis un téléphone.
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
    // Évite la page d'avertissement HTML de localtunnel (tunnel de test temporaire).
    "Bypass-Tunnel-Reminder": "true",
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
    await request("/auth/logout", { method: "POST" });
    await setToken(null);
  },
  me: () => request("/auth/me"),
  checkSuperAdminExists: () => request("/auth/check-super-admin"),
  registerSuperAdmin: (payload) =>
    request("/auth/register-super-admin", { method: "POST", body: payload }),

  // --- Entreprises ---
  listEnterprises: () => request("/enterprises"),
  createEnterprise: (payload) =>
    request("/enterprises", { method: "POST", body: payload }),

  // --- Entreprises (super-admin) ---
  listPendingEnterprises: () => request("/enterprises/pending"),
  listActiveEnterprisesDetailed: () => request("/enterprises/active-detailed"),
  activateEnterprise: (id) =>
    request(`/enterprises/${id}/activate`, { method: "PATCH" }),
  deactivateEnterprise: (id) =>
    request(`/enterprises/${id}/deactivate`, { method: "PATCH" }),

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

  // --- Motos ---
  listPublicMotos: () => request("/motos"),
  getMoto: (id) => request(`/motos/${id}`),
  listMyMotos: () => request("/motos/mine"),
  createMoto: (payload) => request("/motos", { method: "POST", body: payload }),
  updateMoto: (id, payload) =>
    request(`/motos/${id}`, { method: "PATCH", body: payload }),
  deleteMoto: (id) => request(`/motos/${id}`, { method: "DELETE" }),
  likeMoto: (id) => request(`/motos/${id}/like`, { method: "POST" }),
  uploadMotoImage: (motoId, form) =>
    request(`/motos/${motoId}/images`, {
      method: "POST",
      body: form,
      isForm: true,
    }),

  // --- Rendez-vous ---
  listRendezVous: () => request("/rendez-vous"),
  createRendezVous: (payload) =>
    request("/rendez-vous", { method: "POST", body: payload }),

  // --- Notifications ---
  listNotifications: () => request("/notifications"),
  markNotificationRead: (id) =>
    request(`/notifications/${id}/read`, { method: "PATCH" }),
  deleteNotification: (id) =>
    request(`/notifications/${id}`, { method: "DELETE" }),
  countUnreadNotifications: () => request("/notifications/unread/count"),

  // --- Paramètres Entreprise ---
  getEnterpriseSettings: () => request("/entreprise-parametres"),
  updateEnterpriseSettings: (payload) =>
    request("/entreprise-parametres", { method: "PATCH", body: payload }),

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

  // --- Audit ---
  logAction: (payload) =>
    request("/audit-logs", { method: "POST", body: payload }),

  // --- Chat (admin, Sanctum) ---
  listEnterpriseChats: (enterpriseId) =>
    request(`/enterprises/${enterpriseId}/chats`),
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
};
