import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";

export interface LocationResult {
  latitude: number;
  longitude: number;
  label: string;
}

interface MapPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onLocationSelected: (location: LocationResult) => void;
  initialLatitude?: number;
  initialLongitude?: number;
}

const buildMapHtml = (lat: number, lng: number) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; width: 100%; overflow: hidden; background: #1a1a1a; }
    #map { position: absolute; top: 0; left: 0; right: 0; bottom: 64px; }
    #toolbar {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      height: 64px;
      display: flex;
      align-items: center;
      padding: 0 12px;
      gap: 10px;
      background: #1E1E1E;
      border-top: 1px solid #333;
    }
    .btn {
      height: 42px;
      padding: 0 14px;
      border: none;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
    }
    #btn-locate { background: #0A84FF; color: #fff; flex: 1; }
    #btn-locate:disabled { background: #444; color: #888; }
    #btn-confirm { background: #30D158; color: #fff; flex: 1.2; }
    #btn-confirm:disabled { background: #2a2a2a; color: #555; border: 1px solid #333; }
    #hint {
      position: absolute;
      top: 12px; left: 50%; transform: translateX(-50%);
      background: rgba(0,0,0,0.72);
      color: #fff;
      font-size: 13px;
      padding: 8px 16px;
      border-radius: 20px;
      pointer-events: none;
      white-space: nowrap;
      z-index: 1000;
      transition: opacity 0.3s;
    }
    .leaflet-control-attribution { font-size: 9px !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="hint">Touchez la carte pour placer un marqueur</div>
  <div id="toolbar">
    <button class="btn" id="btn-locate" onclick="locateMe()">📍 Ma position</button>
    <button class="btn" id="btn-confirm" onclick="confirmSelection()" disabled>✓ Confirmer la position</button>
  </div>
  <script>
    var defaultLat = ${lat};
    var defaultLng = ${lng};
    var map = L.map('map', { zoomControl: true }).setView([defaultLat, defaultLng], 13);
    var marker = null;
    var selectedLat = null;
    var selectedLng = null;
    var hint = document.getElementById('hint');

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(map);

    // Redimensionner la carte après le rendu initial
    setTimeout(function() { map.invalidateSize(); }, 300);

    map.on('click', function(e) {
      placeMarker(e.latlng.lat, e.latlng.lng);
    });

    function placeMarker(lat, lng) {
      selectedLat = lat;
      selectedLng = lng;
      var icon = L.divIcon({
        html: '<div style="font-size:32px;line-height:1;margin-top:-32px;margin-left:-12px;">📍</div>',
        className: '',
        iconSize: [24, 32],
        iconAnchor: [12, 32]
      });
      if (marker) {
        marker.setLatLng([lat, lng]);
      } else {
        marker = L.marker([lat, lng], { icon: icon }).addTo(map);
      }
      hint.style.opacity = '0';
      document.getElementById('btn-confirm').disabled = false;
    }

    function locateMe() {
      var btn = document.getElementById('btn-locate');
      btn.disabled = true;
      btn.textContent = '⏳ Localisation...';
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          function(pos) {
            var lat = pos.coords.latitude;
            var lng = pos.coords.longitude;
            map.setView([lat, lng], 17);
            placeMarker(lat, lng);
            btn.disabled = false;
            btn.textContent = '📍 Ma position';
          },
          function(err) {
            btn.disabled = false;
            btn.textContent = '📍 Ma position';
            alert('Impossible de récupérer votre position GPS. Vérifiez les permissions de localisation.');
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      } else {
        btn.disabled = false;
        btn.textContent = '📍 Ma position';
        alert('La géolocalisation n\\'est pas supportée sur cet appareil.');
      }
    }

    function confirmSelection() {
      if (selectedLat !== null && selectedLng !== null) {
        var payload = JSON.stringify({
          latitude: selectedLat,
          longitude: selectedLng,
          label: selectedLat.toFixed(6) + ', ' + selectedLng.toFixed(6)
        });
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(payload);
        }
      }
    }
  </script>
</body>
</html>
`;

export default function MapPickerModal({
  visible,
  onClose,
  onLocationSelected,
  initialLatitude = 12.3647,
  initialLongitude = -1.5330,
}: MapPickerModalProps) {
  const [loading, setLoading] = useState(true);

  const handleMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const data: LocationResult = JSON.parse(event.nativeEvent.data);
      if (data.latitude && data.longitude) {
        onLocationSelected(data);
        onClose();
      }
    } catch {
      // ignore malformed messages
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Localisation de la boutique</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>Fermer</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.subtitle}>
          Touchez la carte ou utilisez votre position GPS pour marquer l'emplacement.
        </Text>

        {/* Loading overlay */}
        {loading && (
          <View style={styles.loaderOverlay}>
            <ActivityIndicator color="#0A84FF" size="large" />
            <Text style={styles.loaderText}>Chargement de la carte…</Text>
          </View>
        )}

        {/* Map WebView */}
        <WebView
          style={styles.webview}
          source={{ html: buildMapHtml(initialLatitude, initialLongitude) }}
          javaScriptEnabled
          geolocationEnabled
          domStorageEnabled
          onLoadEnd={() => setLoading(false)}
          onMessage={handleMessage}
          originWhitelist={["*"]}
          mixedContentMode="always"
          allowsInlineMediaPlayback
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#121212",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#1E1E1E",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  closeBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  closeBtnText: {
    color: "#0A84FF",
    fontSize: 16,
    fontWeight: "600",
  },
  subtitle: {
    color: "#8E8E93",
    fontSize: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#1E1E1E",
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#1E1E1E",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    top: 90,
  },
  loaderText: {
    color: "#8E8E93",
    marginTop: 12,
    fontSize: 14,
  },
  webview: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
});
