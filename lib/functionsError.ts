// supabase-js n'expose que "Edge Function returned a non-2xx status code" par
// défaut sur `functions.invoke()` en cas d'erreur HTTP : le vrai message est dans
// le corps JSON de la réponse, accessible via `error.context` (un objet Response).
export async function getFunctionErrorMessage(error: any, fallback: string): Promise<string> {
  if (error?.context && typeof error.context.json === "function") {
    try {
      const body = await error.context.json();
      if (body?.error) return String(body.error);
    } catch {
      // corps non-JSON ou déjà consommé : on retombe sur error.message
    }
  }
  return error?.message ?? fallback;
}
