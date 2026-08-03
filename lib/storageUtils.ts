import { api } from "./api";

// Convertir taille en octets à un format lisible (Mo, Go, etc.)
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export interface StorageStats {
  total: number;
  motos: number;
  decharges: number;
  recus: number;
  registres: number;
  logo: number;
}

/**
 * Récupère le total des ressources consommées (taille réelle sur disque des
 * fichiers uploadés). Le calcul se fait côté serveur, les fichiers n'étant
 * plus du base64 en colonne mais de vrais fichiers stockés.
 */
export async function calculateTotalStorage(): Promise<StorageStats> {
  try {
    return await api.getStorageUsage();
  } catch (error) {
    console.error("Erreur lors du calcul du stockage:", error);
    return { total: 0, motos: 0, decharges: 0, recus: 0, registres: 0, logo: 0 };
  }
}
