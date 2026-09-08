import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
    StyleProp,
    StyleSheet,
    TextInput,
    TextInputProps,
    TouchableOpacity,
    View,
    ViewStyle,
} from "react-native";

type PasswordInputProps = TextInputProps & {
  iconColor?: string;
  containerStyle?: StyleProp<ViewStyle>;
};

export default function PasswordInput({
  iconColor = "#8E8E93",
  containerStyle,
  style,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      <TextInput
        {...props}
        style={[style, styles.input]}
        secureTextEntry={!visible}
        autoCapitalize={props.autoCapitalize ?? "none"}
        autoCorrect={props.autoCorrect ?? false}
      />
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={
          visible ? "Masquer le mot de passe" : "Afficher le mot de passe"
        }
        onPress={() => setVisible((current) => !current)}
        style={styles.toggle}
        hitSlop={8}
      >
        <Ionicons
          name={visible ? "eye" : "eye-off"}
          size={21}
          color={iconColor}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: "relative", width: "100%" },
  input: { paddingRight: 48 },
  toggle: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
});
