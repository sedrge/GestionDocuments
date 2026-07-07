// Démarre la connexion OAuth TikTok pour le compte de l'entreprise de l'admin appelant.
// Authentifiée (JWT Supabase requis) — vérifie que l'appelant est bien un
// enterprise_admin avant de générer l'URL d'autorisation TikTok.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const TIKTOK_CLIENT_KEY = Deno.env.get("TIKTOK_CLIENT_KEY")!;
const TIKTOK_OAUTH_CALLBACK_URL = Deno.env.get("TIKTOK_OAUTH_CALLBACK_URL")!;
const OAUTH_STATE_SECRET = Deno.env.get("OAUTH_STATE_SECRET")!;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Signe le paramètre OAuth `state` (HMAC-SHA256) — voir tiktok-oauth-callback pour la
// vérification symétrique. Même approche que fb-oauth-start (dupliquée volontairement
// dans chaque fonction pour rester déployable un fichier à la fois depuis l'éditeur
// web du dashboard Supabase).
type StatePayload = { enterprise_id: string; user_id: string; nonce: string; iat: number };

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signState(payload: StatePayload, secret: string): Promise<string> {
  const encodedPayload = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encodedPayload));
  return `${encodedPayload}.${toBase64Url(new Uint8Array(sig))}`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return json(401, { error: "unauthenticated" });

  const { data: admin, error: adminError } = await supabaseClient
    .from("enterprise_admins")
    .select("enterprise_id")
    .eq("user_id", user.id)
    .eq("role", "enterprise_admin")
    .single();

  if (adminError || !admin) return json(403, { error: "not_an_enterprise_admin" });

  const state = await signState(
    { enterprise_id: admin.enterprise_id, user_id: user.id, nonce: crypto.randomUUID(), iat: Date.now() },
    OAUTH_STATE_SECRET,
  );

  const authUrl = "https://www.tiktok.com/v2/auth/authorize/"
    + `?client_key=${encodeURIComponent(TIKTOK_CLIENT_KEY)}`
    + `&redirect_uri=${encodeURIComponent(TIKTOK_OAUTH_CALLBACK_URL)}`
    + `&state=${encodeURIComponent(state)}`
    + "&scope=user.info.basic,video.publish"
    + "&response_type=code";

  return json(200, { authUrl });
});
