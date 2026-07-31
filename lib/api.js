import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

// Adresse du serveur Laravel local, configurée dans app.config.js (extra.laravelApiUrl).
// Doit être l'IP LAN de ce PC (pas localhost) pour être joignable depuis un téléphone.
const API_URL = Constants.expoConfig.extra.laravelApiUrl;

const TOKEN_KEY = 'laravel_token';

export async function getToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function setToken(token) {
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function request(path, { method = 'GET', body, isForm = false, headers = {} } = {}) {
  const token = await getToken();
  const finalHeaders = {
    Accept: 'application/json',
    // Évite la page d'avertissement HTML de localtunnel (tunnel de test temporaire).
    'Bypass-Tunnel-Reminder': 'true',
    ...headers,
  };
  if (token) finalHeaders.Authorization = `Bearer ${token}`;
  if (!isForm && body !== undefined) finalHeaders['Content-Type'] = 'application/json';

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
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  login: async (payload) => {
    const data = await request('/auth/login', { method: 'POST', body: payload });
    await setToken(data.token);
    return data;
  },
  logout: async () => {
    await request('/auth/logout', { method: 'POST' });
    await setToken(null);
  },
  me: () => request('/auth/me'),

  // --- Entreprises ---
  listEnterprises: () => request('/enterprises'),
  createEnterprise: (payload) => request('/enterprises', { method: 'POST', body: payload }),

  // --- Motos ---
  listPublicMotos: () => request('/motos'),
  listMyMotos: () => request('/motos/mine'),
  createMoto: (payload) => request('/motos', { method: 'POST', body: payload }),
  updateMoto: (id, payload) => request(`/motos/${id}`, { method: 'PATCH', body: payload }),
  likeMoto: (id) => request(`/motos/${id}/like`, { method: 'POST' }),
  uploadMotoImage: (motoId, form) =>
    request(`/motos/${motoId}/images`, { method: 'POST', body: form, isForm: true }),

  // --- Documents ---
  listDocuments: () => request('/documents'),
  uploadDocument: (form) => request('/documents', { method: 'POST', body: form, isForm: true }),

  // --- Rendez-vous ---
  listRendezVous: () => request('/rendez-vous'),
  createRendezVous: (payload) => request('/rendez-vous', { method: 'POST', body: payload }),

  // --- Notifications ---
  listNotifications: () => request('/notifications'),

  // --- Chat (admin, Sanctum) ---
  listEnterpriseChats: (enterpriseId) => request(`/enterprises/${enterpriseId}/chats`),
  sendAdminMessage: (chatId, message) =>
    request(`/chats/${chatId}/messages`, { method: 'POST', body: { message } }),

  // --- Chat (client anonyme, via client_token) ---
  startChat: (enterpriseId, payload) =>
    request(`/enterprises/${enterpriseId}/chats`, { method: 'POST', body: payload }),
  getPublicChat: (chatId, clientToken) =>
    request(`/public-chats/${chatId}`, { headers: { 'X-Client-Token': clientToken } }),
  sendClientMessage: (chatId, clientToken, message) =>
    request(`/public-chats/${chatId}/messages`, {
      method: 'POST',
      body: { message },
      headers: { 'X-Client-Token': clientToken },
    }),
};
