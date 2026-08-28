import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from "react-native";
import { useTheme } from "@/context/ThemeContext";

const BAR_COUNT = 24;

/** Hauteurs de barres pseudo-aléatoires mais stables (seedées par l'URL) — pas une vraie forme d'onde, juste un rendu visuel cohérent par message. */
function seededHeights(seed: string, count: number): number[] {
  let x = 0;
  for (let i = 0; i < seed.length; i++) x = (x * 31 + seed.charCodeAt(i)) & 0x7fffffff;
  if (x === 0) x = 1;
  const heights: number[] = [];
  for (let i = 0; i < count; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    heights.push(0.25 + (x % 1000) / 1000 / 1.3);
  }
  return heights;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VoiceMessageBubble({ uri, isMine }: { uri: string; isMine: boolean }) {
  const { theme } = useTheme();
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const [trackWidth, setTrackWidth] = useState(0);

  const heights = useMemo(() => seededHeights(uri, BAR_COUNT), [uri]);
  const progress = status.duration > 0 ? status.currentTime / status.duration : 0;
  const activeBars = Math.round(progress * BAR_COUNT);

  // expo-audio laisse currentTime figé à la fin (playing=false) une fois le
  // clip terminé — sans ça, la barre reste bloquée en fin de lecture au lieu
  // de revenir à l'état initial.
  useEffect(() => {
    if (status.didJustFinish) {
      player.pause();
      player.seekTo(0);
    }
  }, [status.didJustFinish, player]);

  function handleSeek(event: GestureResponderEvent) {
    if (!trackWidth || !status.duration) return;
    const fraction = Math.min(1, Math.max(0, event.nativeEvent.locationX / trackWidth));
    player.seekTo(fraction * status.duration);
  }

  const activeColor = isMine ? "#fff" : theme.primary;
  const inactiveColor = isMine ? "rgba(255,255,255,0.4)" : theme.border;
  const timeColor = isMine ? "rgba(255,255,255,0.75)" : theme.subText;

  return (
    <View style={styles.row}>
      <Pressable onPress={() => (status.playing ? player.pause() : player.play())} hitSlop={8}>
        <Ionicons name={status.playing ? "pause-circle" : "play-circle"} size={34} color={activeColor} />
      </Pressable>

      <View style={styles.trackArea}>
        <Pressable style={styles.track} onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)} onPress={handleSeek}>
          {heights.map((h, i) => (
            <View
              key={i}
              style={[
                styles.bar,
                {
                  height: 3 + h * 16,
                  backgroundColor: i < activeBars ? activeColor : inactiveColor,
                },
              ]}
            />
          ))}
        </Pressable>
        <Text style={[styles.durationText, { color: timeColor }]}>
          {formatTime(status.playing || status.currentTime > 0 ? status.currentTime : status.duration)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 190,
  },
  trackArea: {
    flex: 1,
    gap: 2,
  },
  track: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    height: 20,
  },
  bar: {
    width: 2.5,
    borderRadius: 1.5,
  },
  durationText: {
    fontSize: 11,
  },
});
