// Callback OAuth appelé directement par Facebook (pas de JWT Supabase).
// Déployer avec --no-verify-jwt. La sécurité repose entièrement sur la
// signature du `state` généré par fb-oauth-start.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FB_APP_ID = Deno.env.get("FB_APP_ID")!;
const FB_APP_SECRET = Deno.env.get("FB_APP_SECRET")!;
const FB_OAUTH_CALLBACK_URL = Deno.env.get("FB_OAUTH_CALLBACK_URL")!;
const OAUTH_STATE_SECRET = Deno.env.get("OAUTH_STATE_SECRET")!;

const APP_REDIRECT = "docvault://fb-connect-result";

function redirect(params: Record<string, string>) {
  const url = new URL(APP_REDIRECT);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

async function fbGet(url: string): Promise<any> {
  const res = await fetch(url);
  const body = await res.json();
  if (body.error) throw new Error(body.error.message ?? "facebook_api_error");
  return body;
}

// Vérifie le `state` signé par fb-oauth-start (HMAC-SHA256). Dupliqué volontairement
// (voir fb-oauth-start) plutôt qu'importé d'un module partagé, pour rester
// déployable un fichier à la fois depuis l'éditeur web du dashboard Supabase.
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
  const fbError = url.searchParams.get("error_message") ?? url.searchParams.get("error");

  if (fbError) return redirect({ status: "error", message: fbError });
  if (!code) return redirect({ status: "error", message: "missing_code" });

  const payload = await verifyState(state, OAUTH_STATE_SECRET);
  if (!payload) return redirect({ status: "error", message: "invalid_or_expired_state" });

  try {
    // 1) code -> token utilisateur courte durée
    const shortLived = await fbGet(
      "https://graph.facebook.com/v21.0/oauth/access_token"
        + `?client_id=${encodeURIComponent(FB_APP_ID)}`
        + `&redirect_uri=${encodeURIComponent(FB_OAUTH_CALLBACK_URL)}`
        + `&client_secret=${encodeURIComponent(FB_APP_SECRET)}`
        + `&code=${encodeURIComponent(code)}`,
    );

    // 2) token courte durée -> token utilisateur longue durée
    const longLived = await fbGet(
      "https://graph.facebook.com/v21.0/oauth/access_token"
        + "?grant_type=fb_exchange_token"
        + `&client_id=${encodeURIComponent(FB_APP_ID)}`
        + `&client_secret=${encodeURIComponent(FB_APP_SECRET)}`
        + `&fb_exchange_token=${encodeURIComponent(shortLived.access_token)}`,
    );

    // 3) liste des Pages gérées par l'utilisateur
    const pages = await fbGet(
      `https://graph.facebook.com/v21.0/me/accounts?access_token=${encodeURIComponent(longLived.access_token)}`,
    );

    const page = pages.data?.[0];
    if (!page) return redirect({ status: "error", message: "no_facebook_page_found" });

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error: upsertError } = await admin
      .from("enterprise_facebook_pages")
      .upsert({
        enterprise_id: payload.enterprise_id,
        fb_page_id: page.id,
        fb_page_name: page.name,
        fb_page_access_token: page.access_token,
        connected_by_user_id: payload.user_id,
        updated_at: new Date().toISOString(),
      }, { onConflict: "enterprise_id" });

    if (upsertError) return redirect({ status: "error", message: "storage_failed" });

    return redirect({ status: "success", page_name: page.name });
  } catch (err) {
    return redirect({ status: "error", message: String((err as Error).message ?? err) });
  }
});
