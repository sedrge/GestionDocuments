// Diffusion croisée différée : appelée périodiquement par pg_cron (voir
// db_publications_cross_post_migration.sql). Pour chaque publication devenue
// visible (publish_at <= now()) dont l'utilisateur a sélectionné des réseaux
// à la création (selected_platforms), pousse vers Facebook/TikTok tout réseau
// pas encore traité. Pas de JWT utilisateur ici (déclenchement système) :
// sécurisée par un secret partagé, et utilise le quota "service" dédié
// (check_and_increment_feature_usage_service) puisque auth.uid() est absent.
//
// NOTE : la logique de publication Facebook/TikTok est dupliquée depuis
// fb-publish-post / tiktok-publish-post plutôt que partagée via un module
// _shared, car le déploiement se fait depuis le Dashboard Supabase (qui ne
// package que le fichier de la fonction, pas les dossiers voisins).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_DISPATCH_SECRET = Deno.env.get("CRON_DISPATCH_SECRET")!;
const TIKTOK_CLIENT_KEY = Deno.env.get("TIKTOK_CLIENT_KEY")!;
const TIKTOK_CLIENT_SECRET = Deno.env.get("TIKTOK_CLIENT_SECRET")!;

const GRAPH = "https://graph.facebook.com/v21.0";
const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const TIKTOK_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const BATCH_SIZE = 25;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ─── Facebook ────────────────────────────────────────────────────────────

async function fbPost(path: string, params: Record<string, string>): Promise<any> {
  const res = await fetch(`${GRAPH}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const body = await res.json();
  if (body.error) throw new Error(body.error.message ?? "facebook_api_error");
  return body;
}

async function publishToFacebook(
  pageId: string,
  pageToken: string,
  texte: string | null,
  images: string[],
): Promise<string> {
  const message = texte ?? "";

  if (images.length === 0) {
    const res = await fbPost(`${pageId}/feed`, { message, access_token: pageToken });
    return res.id;
  }

  if (images.length === 1) {
    const res = await fbPost(`${pageId}/photos`, {
      url: images[0],
      caption: message,
      access_token: pageToken,
    });
    return res.post_id ?? res.id;
  }

  const mediaFbids: string[] = [];
  for (const imgUrl of images) {
    const res = await fbPost(`${pageId}/photos`, {
      url: imgUrl,
      published: "false",
      access_token: pageToken,
    });
    mediaFbids.push(res.id);
  }

  const params: Record<string, string> = { message, access_token: pageToken };
  mediaFbids.forEach((id, i) => {
    params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id });
  });
  const res = await fbPost(`${pageId}/feed`, params);
  return res.id;
}

// ─── TikTok ──────────────────────────────────────────────────────────────

type TikTokConnection = {
  id: string;
  access_token: string;
  refresh_token: string;
  access_token_expires_at: string;
};

async function refreshIfNeeded(svc: ReturnType<typeof createClient>, conn: TikTokConnection): Promise<string> {
  const expiresAt = new Date(conn.access_token_expires_at).getTime();
  if (Date.now() < expiresAt - TIKTOK_REFRESH_BUFFER_MS) return conn.access_token;

  const res = await fetch(TIKTOK_TOKEN_URL, {
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

// ─── Dispatch ────────────────────────────────────────────────────────────

type PendingPublication = {
  id: string;
  enterprise_id: string;
  texte: string | null;
  images: string[];
  selected_platforms: string[];
  fb_publish_status: "not_published" | "published" | "error";
};

async function checkQuota(
  svc: ReturnType<typeof createClient>,
  enterpriseId: string,
  featureKey: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const { data, error } = await svc.rpc("check_and_increment_feature_usage_service", {
    p_enterprise_id: enterpriseId,
    p_feature_key: featureKey,
  });
  if (error) return { allowed: false, reason: "quota_check_failed" };
  return { allowed: !!data?.allowed, reason: data?.error };
}

async function dispatchFacebook(svc: ReturnType<typeof createClient>, pub: PendingPublication) {
  const quota = await checkQuota(svc, pub.enterprise_id, "publications.facebook");
  if (!quota.allowed) {
    await svc.from("enterprise_publications").update({
      fb_publish_status: "error",
      fb_publish_error: quota.reason === "feature_disabled"
        ? "La publication automatique sur Facebook n'est plus activée pour cette entreprise."
        : "Quota quotidien atteint au moment de la diffusion programmée.",
    }).eq("id", pub.id);
    return;
  }

  const { data: fbPage } = await svc
    .from("enterprise_facebook_pages")
    .select("fb_page_id, fb_page_access_token")
    .eq("enterprise_id", pub.enterprise_id)
    .single();
  if (!fbPage) {
    await svc.from("enterprise_publications").update({
      fb_publish_status: "error",
      fb_publish_error: "no_facebook_page_connected",
    }).eq("id", pub.id);
    return;
  }

  try {
    const postId = await publishToFacebook(fbPage.fb_page_id, fbPage.fb_page_access_token, pub.texte, pub.images ?? []);
    await svc.from("enterprise_publications").update({
      fb_post_id: postId,
      fb_published_at: new Date().toISOString(),
      fb_publish_status: "published",
      fb_publish_error: null,
    }).eq("id", pub.id);
  } catch (err) {
    await svc.from("enterprise_publications").update({
      fb_publish_status: "error",
      fb_publish_error: String((err as Error).message ?? err),
    }).eq("id", pub.id);
  }
}

async function dispatchTikTok(svc: ReturnType<typeof createClient>, pub: PendingPublication) {
  if (!pub.images || pub.images.length === 0) {
    await svc.from("publication_platform_status").upsert({
      publication_id: pub.id,
      platform: "tiktok",
      status: "error",
      error_message: "tiktok_requires_at_least_one_image",
      updated_at: new Date().toISOString(),
    }, { onConflict: "publication_id,platform" });
    return;
  }

  const quota = await checkQuota(svc, pub.enterprise_id, "publications.tiktok");
  if (!quota.allowed) {
    await svc.from("publication_platform_status").upsert({
      publication_id: pub.id,
      platform: "tiktok",
      status: "error",
      error_message: quota.reason === "feature_disabled"
        ? "La publication automatique sur TikTok n'est plus activée pour cette entreprise."
        : "Quota quotidien atteint au moment de la diffusion programmée.",
      updated_at: new Date().toISOString(),
    }, { onConflict: "publication_id,platform" });
    return;
  }

  const { data: connection } = await svc
    .from("enterprise_social_connections")
    .select("id, access_token, refresh_token, access_token_expires_at")
    .eq("enterprise_id", pub.enterprise_id)
    .eq("platform", "tiktok")
    .single();
  if (!connection) {
    await svc.from("publication_platform_status").upsert({
      publication_id: pub.id,
      platform: "tiktok",
      status: "error",
      error_message: "no_tiktok_account_connected",
      updated_at: new Date().toISOString(),
    }, { onConflict: "publication_id,platform" });
    return;
  }

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
  } catch (err) {
    await svc.from("publication_platform_status").upsert({
      publication_id: pub.id,
      platform: "tiktok",
      status: "error",
      error_message: String((err as Error).message ?? err),
      updated_at: new Date().toISOString(),
    }, { onConflict: "publication_id,platform" });
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  if (req.headers.get("x-cron-secret") !== CRON_DISPATCH_SECRET) {
    return json(401, { error: "unauthorized" });
  }

  const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: candidates, error } = await svc
    .from("enterprise_publications")
    .select("id, enterprise_id, texte, images, selected_platforms, fb_publish_status")
    .lte("publish_at", new Date().toISOString())
    .neq("selected_platforms", "{}")
    .order("publish_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) return json(500, { error: "fetch_candidates_failed" });

  const pubs = (candidates as PendingPublication[]) ?? [];
  if (pubs.length === 0) return json(200, { processed: 0 });

  const { data: tiktokRows } = await svc
    .from("publication_platform_status")
    .select("publication_id, status")
    .eq("platform", "tiktok")
    .in("publication_id", pubs.map((p) => p.id));
  const tiktokDone = new Set(
    (tiktokRows ?? []).filter((r) => r.status !== "not_published").map((r) => r.publication_id),
  );

  let processed = 0;
  for (const pub of pubs) {
    const wantsFacebook = pub.selected_platforms.includes("facebook") && pub.fb_publish_status === "not_published";
    const wantsTiktok = pub.selected_platforms.includes("tiktok") && !tiktokDone.has(pub.id);
    if (!wantsFacebook && !wantsTiktok) continue;

    if (wantsFacebook) await dispatchFacebook(svc, pub);
    if (wantsTiktok) await dispatchTikTok(svc, pub);
    processed++;
  }

  return json(200, { processed });
});
