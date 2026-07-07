// Callback OAuth appelé directement par TikTok (pas de JWT Supabase).
// Déployer avec --no-verify-jwt. La sécurité repose entièrement sur la
// signature du `state` généré par tiktok-oauth-start.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TIKTOK_CLIENT_KEY = Deno.env.get("TIKTOK_CLIENT_KEY")!;
const TIKTOK_CLIENT_SECRET = Deno.env.get("TIKTOK_CLIENT_SECRET")!;
const TIKTOK_OAUTH_CALLBACK_URL = Deno.env.get("TIKTOK_OAUTH_CALLBACK_URL")!;
const OAUTH_STATE_SECRET = Deno.env.get("OAUTH_STATE_SECRET")!;

const APP_REDIRECT = "docvault://tiktok-connect-result";

function redirect(params: Record<string, string>) {
  const url = new URL(APP_REDIRECT);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

// Vérifie le `state` signé par tiktok-oauth-start (HMAC-SHA256). Dupliqué
// volontairement (voir tiktok-oauth-start) plutôt qu'importé d'un module partagé,
// pour rester déployable un fichier à la fois depuis l'éditeur web du dashboard.
type StatePayload = { enterprise_id: string; user_id: string; nonce: string; iat: number };
const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(
    value.length + ((4 - (value.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function verifyState(state: string | null, secret: string): Promise<StatePayload | null> {
  if (!state) return null;
  const parts = state.split(".");
  if (parts.length !== 2) return null;
  const [encodedPayload, encodedSig] = parts;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    fromBase64Url(encodedSig),
    new TextEncoder().encode(encodedPayload),
  );
  if (!valid) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(encodedPayload))) as StatePayload;
    if (!payload.enterprise_id || !payload.user_id || !payload.iat) return null;
    if (Date.now() - payload.iat > STATE_MAX_AGE_MS) return null;
    return payload;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const tiktokError = url.searchParams.get("error_description") ?? url.searchParams.get("error");

  if (tiktokError) return redirect({ status: "error", message: tiktokError });
  if (!code) return redirect({ status: "error", message: "missing_code" });

  const payload = await verifyState(state, OAUTH_STATE_SECRET);
  if (!payload) return redirect({ status: "error", message: "invalid_or_expired_state" });

  try {
    // Échange code -> tokens
    const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: TIKTOK_CLIENT_KEY,
        client_secret: TIKTOK_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: TIKTOK_OAUTH_CALLBACK_URL,
      }),
    });
    const tokenBody = await tokenRes.json();
    if (tokenBody.error) {
      throw new Error(tokenBody.error_description ?? tokenBody.error ?? "tiktok_token_exchange_failed");
    }

    const { access_token, refresh_token, expires_in, refresh_expires_in, open_id } = tokenBody;
    const now = Date.now();

    // Nom affiché du compte (facultatif, pour l'UI de connexion)
    let displayName: string | null = null;
    try {
      const userInfoRes = await fetch(
        "https://open.tiktokapis.com/v2/user/info/?fields=display_name",
        { headers: { Authorization: `Bearer ${access_token}` } },
      );
      const userInfoBody = await userInfoRes.json();
      displayName = userInfoBody?.data?.user?.display_name ?? null;
    } catch {
      // Non bloquant : on garde displayName à null si cet appel échoue.
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error: upsertError } = await admin
      .from("enterprise_social_connections")
      .upsert({
        enterprise_id: payload.enterprise_id,
        platform: "tiktok",
        external_account_id: open_id,
        external_account_name: displayName,
        access_token,
        refresh_token,
        access_token_expires_at: new Date(now + expires_in * 1000).toISOString(),
        refresh_token_expires_at: new Date(now + refresh_expires_in * 1000).toISOString(),
        connected_by_user_id: payload.user_id,
        updated_at: new Date().toISOString(),
      }, { onConflict: "enterprise_id,platform" });

    if (upsertError) return redirect({ status: "error", message: "storage_failed" });

    return redirect({ status: "success", account_name: displayName ?? "TikTok" });
  } catch (err) {
    return redirect({ status: "error", message: String((err as Error).message ?? err) });
  }
});
