import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  /** Incrementar para disparar la animación. */
  trigger: number;
  /** Si el favorito quedó activo tras el toque. */
  favorited: boolean;
};

export default function HeartBurstOverlay({ trigger, favorited }: Props) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const lastTrigger = React.useRef(0);

  React.useEffect(() => {
    if (trigger === 0 || trigger === lastTrigger.current) return;
    lastTrigger.current = trigger;
    scale.value = 0;
    opacity.value = favorited ? 1 : 0.85;
    scale.value = withSequence(
      withTiming(1.25, { duration: 180 }),
      withTiming(1, { duration: 120 }),
      withTiming(1.1, { duration: 100 })
    );
    opacity.value = withTiming(0, { duration: 550 });
  }, [trigger, favorited, opacity, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View style={[styles.heart, animStyle]}>
        <Ionicons name="heart" size={72} color="#ff4268" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  heart: {
    shadowColor: '#ff4268',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
  },
});
