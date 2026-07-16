import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { theme } from '../constants/theme';

type BotonAzulProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

export default function BotonAzul({
  label,
  onPress,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
}: BotonAzulProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        pressed && !disabled ? styles.buttonPressed : null,
        disabled ? styles.buttonDisabled : null,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: theme.colors.textLight,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
