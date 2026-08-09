import { Image, ImageProps, ImageStyle } from "expo-image";
import { useEffect, useState } from "react";
import { StyleProp } from "react-native";
import { getToken } from "../lib/api";

interface AuthImageProps extends Omit<ImageProps, "source" | "style"> {
  uri: string;
  style?: StyleProp<ImageStyle>;
}

/**
 * <Image> pour un fichier privé servi par Laravel (registres/décharges/reçus) :
 * ces disques ne sont pas publics, il faut le Bearer token en en-tête, pas
 * juste l'URL brute.
 *
 * Utilise expo-image (pas le <Image> natif de react-native) : les headers
 * personnalisés sur `source` sont réputés non fiables/ignorés sur Android
 * avec le composant natif (bug connu de longue date), expo-image (Glide/
 * SDWebImage) les gère correctement sur les deux plateformes.
 */
export function AuthImage({ uri, style, ...rest }: AuthImageProps) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getToken().then((t) => {
      if (mounted) setToken(t);
    });
    return () => {
      mounted = false;
    };
  }, [uri]);

  if (!token) return null;

  return (
    <Image
      source={{ uri, headers: { Authorization: `Bearer ${token}` } }}
      style={style}
      {...rest}
    />
  );
}
