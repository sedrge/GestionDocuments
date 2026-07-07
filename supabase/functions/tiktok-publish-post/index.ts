// Publie une publication (enterprise_publications) sur le compte TikTok connecté
// de son entreprise. Authentifiée — revérifie côté serveur que l'appelant est bien
// enterprise_admin de l'entreprise propriétaire (ne pas se fier au FeatureGate client).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TIKTOK_CLIENT_KEY = Deno.env.get("TIKTOK_CLIENT_KEY")!;
const TIKTOK_CLIENT_SECRET = Deno.env.get("TIKTOK_CLIENT_SECRET")!;

const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const REFRESH_BUFFER_MS = 5 * 60 * 1000; // rafraîchit un peu avant l'expiration réelle

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type TikTokConnection = {
  id: string;
  access_token: string;
  refresh_token: string;
  access_token_expires_at: string;
};

// Le token utilisateur TikTok expire en ~24h (contrairement au token de Page
// Facebook, non-expirant en pratique) : on rafraîchit avant chaque publication
// si nécessaire, et on persiste le nouveau refresh_token (TikTok peut le faire
// tourner à chaque rafraîchissement).
async function refreshIfNeeded(svc: ReturnType<typeof createClient>, conn: TikTokConnection): Promise<string> {
  const expiresAt = new Date(conn.access_token_expires_at).getTime();
  if (Date.now() < expiresAt - REFRESH_BUFFER_MS) return conn.access_token;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: TIKTOK_CLIENT_KEY,
      client_secret: TIKTOK_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: conn.refresh_token,
    }),
  });
  const body = await res.json();
  if (body.error) throw new Error(body.error_description ?? body.error ?? "tiktok_refresh_failed");

  const now = Date.now();
  await svc.from("enterprise_social_connections").update({
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    access_token_expires_at: new Date(now + body.expires_in * 1000).toISOString(),
    refresh_token_expires_at: new Date(now + body.refresh_expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", conn.id);

  return body.access_token;
}

// Tant que l'app n'a pas passé l'audit TikTok, seul SELF_ONLY est disponible ;
// une fois l'audit passé, PUBLIC_TO_EVERYONE devient disponible pour le créateur
// et ce code le choisit automatiquement, sans changement de code nécessaire.
async function pickPrivacyLevel(accessToken: string): Promise<string> {
  try {
    const res = await fetch("https://open.tiktokapis.com/v2/post/publish/creator_info/query/", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8" },
    });
    const body = await res.json();
    const options: string[] = body?.data?.privacy_level_options ?? [];
    if (options.includes("PUBLIC_TO_EVERYONE")) return "PUBLIC_TO_EVERYONE";
  } catch {
    // Non bloquant : on retombe sur SELF_ONLY, toujours accepté.
  }
  return "SELF_ONLY";
}

async function publishToTikTok(accessToken: string, texte: string | null, images: string[]): Promise<string> {
  const privacyLevel = await pickPrivacyLevel(accessToken);

  const res = await fetch("https://open.tiktokapis.com/v2/post/publish/content/init/", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify({
      media_type: "PHOTO",
      post_mode: "DIRECT_POST",
      post_info: {
        title: (texte ?? "").slice(0, 90),
        description: (texte ?? "").slice(0, 4000),
        privacy_level: privacyLevel,
        disable_comment: false,
      },
      source_info: {
        source: "PULL_FROM_URL",
        photo_images: images,
        photo_cover_index: 0,
      },
    }),
  });
  const body = await res.json();
  if (body.error && body.error.code !== "ok") {
    throw new Error(body.error.message ?? "tiktok_api_error");
  }
  return body.data.publish_id;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return json(401, { error: "unauthenticated" });

  const { publication_id } = await req.json().catch(() => ({}));
  if (!publication_id) return json(400, { error: "missing_publication_id" });

  const { data: pub } = await supabaseClient
    .from("enterprise_publications")
    .select("id, enterprise_id, texte, images")
    .eq("id", publication_id)
    .single();
  if (!pub) return json(404, { error: "publication_not_found" });

  // TikTok n'a pas d'équivalent d'un post texte-seul : le mode Photo requiert
  // au moins une image.
  if (!pub.images || pub.images.length === 0) {
    return json(400, { error: "tiktok_requires_at_least_one_image" });
  }

  const { data: admin } = await supabaseClient
    .from("enterprise_admins")
    .select("enterprise_id")
    .eq("user_id", user.id)
    .eq("enterprise_id", pub.enterprise_id)
    .eq("role", "enterprise_admin")
    .single();
  if (!admin) return json(403, { error: "forbidden" });

  const { data: quota, error: quotaError } = await supabaseClient.rpc(
    "check_and_increment_feature_usage",
    { p_enterprise_id: pub.enterprise_id, p_feature_key: "publications.tiktok" },
  );
  if (quotaError) return json(500, { error: "quota_check_failed" });
  if (!quota?.allowed) {
    const message = quota?.error === "feature_disabled"
      ? "La publication automatique sur TikTok n'est pas activée pour votre entreprise. Contactez le concepteur."
      : "Quota quotidien atteint pour cette fonctionnalité. Contactez le concepteur pour passer en mode illimité.";
    return json(403, { error: message });
  }

  const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: connection } = await svc
    .from("enterprise_social_connections")
    .select("id, access_token, refresh_token, access_token_expires_at")
    .eq("enterprise_id", pub.enterprise_id)
    .eq("platform", "tiktok")
    .single();
  if (!connection) return json(400, { error: "no_tiktok_account_connected" });

  try {
    const accessToken = await refreshIfNeeded(svc, connection as TikTokConnection);
    const publishId = await publishToTikTok(accessToken, pub.texte, pub.images);

    await svc.from("publication_platform_status").upsert({
      publication_id: pub.id,
      platform: "tiktok",
      external_post_id: publishId,
      status: "published",
      error_message: null,
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "publication_id,platform" });

    return json(200, { success: true, publish_id: publishId });
  } catch (err) {
    const message = String((err as Error).message ?? err);
    await svc.from("publication_platform_status").upsert({
      publication_id: pub.id,
      platform: "tiktok",
      status: "error",
      error_message: message,
      updated_at: new Date().toISOString(),
    }, { onConflict: "publication_id,platform" });

    return json(500, { success: false, error: message });
  }
});
