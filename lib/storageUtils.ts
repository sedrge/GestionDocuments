// Convertir taille en octets à un format lisible (Mo, Go, etc.)
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Calculer la taille en octets d'une string en base64
function getBase64SizeInBytes(base64String: string): number {
  if (!base64String || typeof base64String !== "string") return 0;
  // Enlever le préfixe "data:image/...;base64,"
  const base64Data = base64String.split(",")[1] || base64String;
  // La taille approximative = (longueur * 3) / 4
  return Math.ceil((base64Data.length * 3) / 4);
}

export interface StorageStats {
  total: number;
  motos: number;
  decharges: number;
  recus: number;
  registres: number;
  logo: number;
  notifications: number;
}

// Calculer le total des ressources consommées
export async function calculateTotalStorage(
  userId: string,
  supabase: any,
): Promise<StorageStats> {
  const stats: StorageStats = {
    total: 0,
    motos: 0,
    decharges: 0,
    recus: 0,
    registres: 0,
    logo: 0,
    notifications: 0,
  };

  try {
    // 1. Images motos
    const { data: motoImages } = await supabase
      .from("moto_images")
      .select("image_uri")
      .eq("user_id", userId);

    if (motoImages) {
      motoImages.forEach((img: any) => {
        const size = getBase64SizeInBytes(img.image_uri);
        stats.motos += size;
        stats.total += size;
      });
    }

    // 2. Décharges (photo_recto, photo_verso, cate_grise_recto, cate_grise_verso)
    const { data: decharges } = await supabase
      .from("decharges")
      .select("photo_recto, photo_verso, cate_grise_recto, cate_grise_verso")
      .eq("user_id", userId);

    if (decharges) {
      decharges.forEach((decharge: any) => {
        [
          decharge.photo_recto,
          decharge.photo_verso,
          decharge.cate_grise_recto,
          decharge.cate_grise_verso,
        ].forEach((photo: any) => {
          const size = getBase64SizeInBytes(photo);
          stats.decharges += size;
          stats.total += size;
        });
      });
    }

    // 3. Réçus (signature_vendeur, signature_client)
    const { data: recus } = await supabase
      .from("recus")
      .select("signature_vendeur, signature_client")
      .eq("user_id", userId);

    if (recus) {
      recus.forEach((recu: any) => {
        [recu.signature_vendeur, recu.signature_client].forEach((sig: any) => {
          const size = getBase64SizeInBytes(sig);
          stats.recus += size;
          stats.total += size;
        });
      });
    }

    // 4. Logo entreprise
    const { data: params } = await supabase
      .from("entreprise_parametres")
      .select("logo_uri")
      .eq("user_id", userId)
      .maybeSingle();

    if (params?.logo_uri) {
      const size = getBase64SizeInBytes(params.logo_uri);
      stats.logo += size;
      stats.total += size;
    }

    // 5. Registres (photo_vendeur, photo_cate_grise)
    const { data: registres } = await supabase
      .from("registres")
      .select("photo_vendeur, photo_cate_grise")
      .eq("user_id", userId);

    if (registres) {
      registres.forEach((registre: any) => {
        [registre.photo_vendeur, registre.photo_cate_grise].forEach(
          (photo: any) => {
            const size = getBase64SizeInBytes(photo);
            stats.registres += size;
            stats.total += size;
          },
        );
      });
    }

    return stats;
  } catch (error) {
    console.error("Erreur lors du calcul du stockage:", error);
    return stats;
  }
}
