import React from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { theme } from '../constants/theme';
import { GameRecord } from '../database/dbConfig';
import CatalogSlideCard from './CatalogSlideCard';

const { width: SCREEN_W } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_W * 0.22;
const SWIPE_VELOCITY = 420;

type Props = {
  games: GameRecord[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onOpen: (gameId: number) => void;
  onToggleFavorite: (gameId: number) => void;
  igdbClientId?: string | null;
  emptyComponent: React.ReactNode;
};

export default function CatalogSlideDeck({
  games,
  currentIndex,
  onIndexChange,
  onOpen,
  onToggleFavorite,
  igdbClientId,
  emptyComponent,
}: Props) {
  const [heartTrigger, setHeartTrigger] = React.useState(0);
  const [heartBurstFavorited, setHeartBurstFavorited] = React.useState(false);
  const translateX = useSharedValue(0);
  const indexSv = useSharedValue(currentIndex);
  const countSv = useSharedValue(games.length);

  React.useEffect(() => {
    indexSv.value = currentIndex;
    countSv.value = games.length;
    translateX.value = 0;
  }, [currentIndex, games.length, indexSv, countSv, translateX]);

  const game = games[currentIndex] ?? null;

  const goNext = React.useCallback(() => {
    if (currentIndex < games.length - 1) {
      onIndexChange(currentIndex + 1);
    }
  }, [currentIndex, games.length, onIndexChange]);

  const goPrev = React.useCallback(() => {
    if (currentIndex > 0) {
      onIndexChange(currentIndex - 1);
    }
  }, [currentIndex, onIndexChange]);

  const bounceBack = React.useCallback(() => {
    translateX.value = withSpring(0, { damping: 18, stiffness: 220 });
  }, [translateX]);

  const commitSwipe = React.useCallback(
    (direction: 'left' | 'right') => {
      const exit = direction === 'left' ? -SCREEN_W * 1.1 : SCREEN_W * 1.1;
      translateX.value = withTiming(exit, { duration: 180 }, (finished) => {
        if (!finished) return;
        translateX.value = 0;
        if (direction === 'left') {
          runOnJS(goNext)();
        } else {
          runOnJS(goPrev)();
        }
      });
    },
    [goNext, goPrev, translateX]
  );

  const panGesture = React.useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-18, 18])
        .failOffsetY([-24, 24])
        .onUpdate((e) => {
          'worklet';
          const idx = indexSv.value;
          const count = countSv.value;
          if (e.translationX > 0 && idx === 0) {
            translateX.value = e.translationX * 0.35;
            return;
          }
          if (e.translationX < 0 && idx >= count - 1) {
            translateX.value = e.translationX * 0.35;
            return;
          }
          translateX.value = e.translationX;
        })
        .onEnd((e) => {
          'worklet';
          const idx = indexSv.value;
          const count = countSv.value;
          const tx = e.translationX;
          const vx = e.velocityX;
          if (tx <= -SWIPE_THRESHOLD || vx <= -SWIPE_VELOCITY) {
            if (idx < count - 1) {
              runOnJS(commitSwipe)('left');
              return;
            }
            runOnJS(bounceBack)();
            return;
          }
          if (tx >= SWIPE_THRESHOLD || vx >= SWIPE_VELOCITY) {
            if (idx > 0) {
              runOnJS(commitSwipe)('right');
              return;
            }
            runOnJS(bounceBack)();
            return;
          }
          runOnJS(bounceBack)();
        }),
    [bounceBack, commitSwipe, countSv, indexSv, translateX]
  );

  const handleToggleFavorite = React.useCallback(() => {
    if (!game) return;
    const nextFav = game.favorite !== 1;
    setHeartBurstFavorited(nextFav);
    setHeartTrigger((n) => n + 1);
    onToggleFavorite(game.id);
  }, [game, onToggleFavorite]);

  const handleOpen = React.useCallback(() => {
    if (!game) return;
    onOpen(game.id);
  }, [game, onOpen]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  if (games.length === 0) {
    return <View style={styles.emptyWrap}>{emptyComponent}</View>;
  }

  if (!game) {
    return <View style={styles.emptyWrap}>{emptyComponent}</View>;
  }

  const indexLabel = `${currentIndex + 1} / ${games.length}`;

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(300)
    .onEnd(() => {
      runOnJS(handleToggleFavorite)();
    });

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .maxDuration(280)
    .requireExternalGestureToFail(doubleTap)
    .onEnd(() => {
      runOnJS(handleOpen)();
    });

  const tapGesture = Gesture.Exclusive(doubleTap, singleTap);
  const composed = Gesture.Simultaneous(panGesture, tapGesture);

  return (
    <View style={styles.deck}>
      <GestureDetector gesture={composed}>
        <Animated.View style={[styles.cardHost, cardStyle]}>
          <CatalogSlideCard
            game={game}
            indexLabel={indexLabel}
            igdbClientId={igdbClientId}
            heartTrigger={heartTrigger}
            heartBurstFavorited={heartBurstFavorited}
          />
        </Animated.View>
      </GestureDetector>
      <Text style={styles.swipeHint}>Desliza ← siguiente · → anterior</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  deck: {
    flex: 1,
    minHeight: 420,
  },
  cardHost: {
    flex: 1,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  swipeHint: {
    color: theme.colors.textDim,
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 8,
    fontStyle: 'italic',
  },
});
