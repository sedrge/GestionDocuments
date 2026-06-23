import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Alert, Platform } from "react-native";

async function sharePdf(uri: string, dialogTitle: string) {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    Alert.alert("Non disponible", "Le partage n'est pas disponible sur cet appareil.");
    return;
  }

  if (Platform.OS === "android") {
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle });
  } else {
    await Sharing.shareAsync(uri, { UTI: "com.adobe.pdf" });
  }
}

// Use this instead of calling printToFileAsync + sharePdf directly.
// expo-print writes to cache/Print/ which is outside the experience sandbox;
// we get the base64 output and write it ourselves to cacheDirectory instead.
export async function printAndSharePdf(html: string, dialogTitle: string) {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    Alert.alert("Non disponible", "Le partage n'est pas disponible sur cet appareil.");
    return;
  }

  const { uri, base64 } = await Print.printToFileAsync({ html, base64: true });

  let shareUri = uri;

  if (Platform.OS === "android" && base64) {
    const dest = `${FileSystem.cacheDirectory}pdf_${Date.now()}.pdf`;
    await FileSystem.writeAsStringAsync(dest, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    shareUri = dest;
  }

  await sharePdf(shareUri, dialogTitle);
}
