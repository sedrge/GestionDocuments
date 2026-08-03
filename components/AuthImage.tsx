import { useEffect, useState } from "react";
import { Image, ImageProps, ImageStyle, StyleProp } from "react-native";
import { getToken } from "../lib/api";

interface AuthImageProps extends Omit<ImageProps, "source" | "style"> {
  uri: string;
  style?: StyleProp<ImageStyle>;
}

/**
 * <Image> pour un fichier privé servi par Laravel (registres/décharges/reçus) :
 * ces disques ne sont pas publics, il faut le Bearer token en en-tête, pas
 * juste l'URL brute.
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
