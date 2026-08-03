import * as FileSystem from "expo-file-system/legacy";

export type FormFile = { uri: string; name: string; type: string };

let counter = 0;

/**
 * Convertit une data URI base64 (ex: sortie de react-native-signature-canvas)
 * en fichier temporaire local, exploitable comme pièce jointe FormData.
 * fetch ne sait pas uploader une data URI directement en RN — il faut un
 * vrai chemin de fichier local.
 */
export async function base64ToFormFile(
  dataUri: string,
  baseName: string,
): Promise<FormFile> {
  const match = dataUri.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) throw new Error("Format d'image invalide (attendu: data URI base64).");
  const [, mime, base64] = match;
  const ext = mime.split("/")[1] || "png";
  const path = `${FileSystem.cacheDirectory}upload_${Date.now()}_${counter++}.${ext}`;
  await FileSystem.writeAsStringAsync(path, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return { uri: path, name: `${baseName}.${ext}`, type: mime };
}

/** Pièce jointe FormData pour un fichier déjà local (photo via ImagePicker). */
export function localUriToFormFile(uri: string, baseName: string): FormFile {
  const ext = uri.split(".").pop()?.toLowerCase().split("?")[0] || "jpg";
  const type = ext === "png" ? "image/png" : "image/jpeg";
  return { uri, name: `${baseName}.${ext}`, type };
}

/** Ajoute un champ à un FormData, en le convertissant en fichier s'il s'agit d'une data URI base64. */
export async function appendMaybeImage(
  form: FormData,
  field: string,
  value: string | null | undefined,
): Promise<void> {
  if (!value) return;
  const file = value.startsWith("data:")
    ? await base64ToFormFile(value, field)
    : localUriToFormFile(value, field);
  form.append(field, file as any);
}

/**
 * Construit un FormData à partir d'un objet de champs simples (texte/nombre/
 * booléen). Ignore les valeurs null/undefined (le champ n'est simplement pas
 * envoyé, cohérent avec les règles de validation Laravel "sometimes").
 */
export function buildFormData(fields: Record<string, any>): FormData {
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value === null || value === undefined) return;
    form.append(key, typeof value === "boolean" ? (value ? "1" : "0") : String(value));
  });
  return form;
}
