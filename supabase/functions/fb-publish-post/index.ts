// Publie une publication (enterprise_publications) sur la Page Facebook connectée
// de son entreprise. Authentifiée — revérifie côté serveur que l'appelant est bien
// enterprise_admin de l'entreprise propriétaire (ne pas se fier au FeatureGate client).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const GRAPH = "https://graph.facebook.com/v21.0";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

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

  // Plusieurs images : upload non publié de chaque photo, puis un seul post
  // via attached_media (pattern Facebook officiel pour les posts multi-photos).
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

  const { data: admin } = await supabaseClient
    .from("enterprise_admins")
    .select("enterprise_id")
    .eq("user_id", user.id)
    .eq("enterprise_id", pub.enterprise_id)
    .eq("role", "enterprise_admin")
    .single();
  if (!admin) return json(403, { error: "forbidden" });

  const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: fbPage } = await svc
    .from("enterprise_facebook_pages")
    .select("fb_page_id, fb_page_access_token")
    .eq("enterprise_id", pub.enterprise_id)
    .single();
  if (!fbPage) return json(400, { error: "no_facebook_page_connected" });

  try {
    const postId = await publishToFacebook(
      fbPage.fb_page_id,
      fbPage.fb_page_access_token,
      pub.texte,
      pub.images ?? [],
    );

    await svc.from("enterprise_publications").update({
      fb_post_id: postId,
      fb_published_at: new Date().toISOString(),
      fb_publish_status: "published",
      fb_publish_error: null,
    }).eq("id", pub.id);

    return json(200, { success: true, post_id: postId });
  } catch (err) {
    const message = String((err as Error).message ?? err);
    await svc.from("enterprise_publications").update({
      fb_publish_status: "error",
      fb_publish_error: message,
    }).eq("id", pub.id);

    return json(500, { success: false, error: message });
  }
});
