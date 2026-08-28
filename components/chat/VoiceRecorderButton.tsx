import { Ionicons } from "@expo/vector-icons";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "@/context/ThemeContext";

const LOCK_THRESHOLD = 80;
const CANCEL_THRESHOLD = 90;
const MIN_DURATION_MS = 400;

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Bouton micro façon WhatsApp : maintenir pour enregistrer, glisser vers le
 * haut pour verrouiller (mains libres), glisser vers la gauche pour annuler.
 */
export function VoiceRecorderButton({
  onRecorded,
}: {
  onRecorded: (result: { uri: string; durationMillis: number }) => void;
}) {
  const { theme } = useTheme();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 200);
  const [locked, setLocked] = useState(false);
  const [paused, setPaused] = useState(false);
  const sessionActive = useRef(false);

  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const lockedShared = useSharedValue(false);
  const cancelledShared = useSharedValue(false);
  const lockProgress = useSharedValue(0);
  const cancelProgress = useSharedValue(0);

  async function handleStart() {
    if (sessionActive.current) return;
    sessionActive.current = true;

    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      sessionActive.current = false;
      Alert.alert("Micro requis", "Autorisez l'accès au micro pour envoyer un message vocal.");
      return;
    }

    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      sessionActive.current = false;
    }
  }

  async function finish(send: boolean) {
    if (!sessionActive.current) return;
    sessionActive.current = false;

    const durationMillis = state.durationMillis;
    const uri = recorder.uri;

    try {
      await recorder.stop();
    } catch {
      // déjà arrêté / jamais préparé — rien à nettoyer
    }
    await setAudioModeAsync({ allowsRecording: false });

    if (send && uri && durationMillis >= MIN_DURATION_MS) {
      onRecorded({ uri, durationMillis });
    }

    setLocked(false);
    setPaused(false);
    translateY.value = 0;
    translateX.value = 0;
    lockedShared.value = false;
    cancelledShared.value = false;
    lockProgress.value = 0;
    cancelProgress.value = 0;
  }

  function togglePause() {
    if (paused) {
      recorder.record();
      setPaused(false);
    } else {
      recorder.pause();
      setPaused(true);
    }
  }

  const pan = Gesture.Pan()
    .onBegin(() => {
      translateY.value = 0;
      translateX.value = 0;
      lockedShared.value = false;
      cancelledShared.value = false;
      lockProgress.value = 0;
      cancelProgress.value = 0;
      runOnJS(handleStart)();
    })
    .onUpdate((event) => {
      if (lockedShared.value) return;
      const y = Math.min(0, event.translationY);
      const x = Math.min(0, event.translationX);
      translateY.value = y;
      translateX.value = x;
      lockProgress.value = Math.min(1, -y / LOCK_THRESHOLD);
      cancelProgress.value = Math.min(1, -x / CANCEL_THRESHOLD);
      if (-y > LOCK_THRESHOLD && !lockedShared.value) {
        lockedShared.value = true;
        runOnJS(setLocked)(true);
      }
      if (-x > CANCEL_THRESHOLD) {
        cancelledShared.value = true;
      } else if (-x < CANCEL_THRESHOLD * 0.6) {
        cancelledShared.value = false;
      }
    })
    .onEnd(() => {
      translateY.value = withTiming(0);
      translateX.value = withTiming(0);
      if (!lockedShared.value) {
        runOnJS(finish)(!cancelledShared.value);
      }
    });

  const micAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { translateX: translateX.value }],
  }));

  const lockHintStyle = useAnimatedStyle(() => ({
    opacity: state.isRecording && !locked ? 1 - lockProgress.value * 0.3 : 0,
    transform: [{ translateY: translateY.value }],
  }));

  const cancelHintStyle = useAnimatedStyle(() => ({
    opacity: state.isRecording && !locked ? Math.max(0.5, 1 - cancelProgress.value) : 0,
  }));

  if (locked) {
    return (
      <View style={styles.lockedRow}>
        <Pressable onPress={() => finish(false)} hitSlop={8}>
          <Ionicons name="trash-outline" size={22} color="#FF3B30" />
        </Pressable>
        <Text style={[styles.duration, { color: theme.subText }]}>
          {formatDuration(state.durationMillis)}
        </Text>
        <Pressable onPress={togglePause} hitSlop={8}>
          <Ionicons name={paused ? "play-circle" : "pause-circle"} size={26} color={theme.subText} />
        </Pressable>
        <Pressable onPress={() => finish(true)} hitSlop={8}>
          <View style={[styles.sendCircle, { backgroundColor: theme.primary }]}>
            <Ionicons name="send" size={16} color="#fff" />
          </View>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      {state.isRecording ? (
        <>
          <Animated.View style={[styles.cancelHint, cancelHintStyle]}>
            <Text style={[styles.cancelText, { color: theme.subText }]}>‹ Glisser pour annuler</Text>
          </Animated.View>
          <Animated.View style={[styles.lockHint, lockHintStyle]}>
            <Ionicons name="lock-closed" size={16} color={theme.subText} />
          </Animated.View>
          <View style={[styles.recDot, { backgroundColor: "#FF3B30" }]} />
          <Text style={[styles.recordingDuration, { color: theme.subText }]}>
            {formatDuration(state.durationMillis)}
          </Text>
        </>
      ) : null}
      <GestureDetector gesture={pan}>
        <Animated.View style={micAnimatedStyle} accessibilityLabel="Message vocal">
          <View style={[styles.micCircle, { backgroundColor: theme.primary }]}>
            <Ionicons name="mic" size={20} color="#fff" />
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  micCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  lockedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  duration: {
    minWidth: 38,
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  recordingDuration: {
    minWidth: 36,
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  lockHint: {
    position: "absolute",
    top: -44,
    right: 8,
  },
  cancelHint: {
    position: "absolute",
    top: 10,
    right: 52,
    width: 150,
  },
  cancelText: {
    fontSize: 12,
    textAlign: "right",
  },
  sendCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
