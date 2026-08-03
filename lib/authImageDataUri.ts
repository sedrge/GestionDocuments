// lib/authImageDataUri.ts
//
// Récupère un fichier privé (photo/signature) servi par Laravel et le
// convertit en data URI base64. Nécessaire partout où une URL ne peut pas
// porter le header Authorization : export PDF (expo-print) et aperçu
// plein écran (WebView avec HTML statique) — contrairement à <Image>, qui
// peut passer par AuthImage.

import * as FileSystem from "expo-file-system/legacy";
import { getToken } from "./api";

let counter = 0;

export async function fetchAuthImageDataUri(url: string): Promise<string | null> {
  const token = await getToken();
  if (!token) return null;

  const path = `${FileSystem.cacheDirectory}auth_img_${Date.now()}_${counter++}`;
  try {
    const result = await FileSystem.downloadAsync(url, path, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (result.status !== 200) return null;

    const base64 = await FileSystem.readAsStringAsync(path, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const mime = result.headers?.["Content-Type"] || result.headers?.["content-type"] || "image/jpeg";
    return `data:${mime};base64,${base64}`;
  } catch {
    return null;
  } finally {
    FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {});
  }
}

/**
 * Résout plusieurs champs fichier d'un modèle (resource + id) en data URIs,
 * en une seule fois. Les champs vides (valeur falsy sur le modèle) sont
 * ignorés sans requête réseau.
 */
export async function resolveAuthImages(
  resource: string,
  id: string,
  fields: string[],
  fileUrl: (resource: string, id: string, field: string) => string,
  hasField: (field: string) => boolean,
): Promise<Record<string, string | null>> {
  const entries = await Promise.all(
    fields.map(async (field) => {
      if (!hasField(field)) return [field, null] as const;
      const uri = await fetchAuthImageDataUri(fileUrl(resource, id, field));
      return [field, uri] as const;
    }),
  );
  return Object.fromEntries(entries);
}
