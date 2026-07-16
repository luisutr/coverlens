import React from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { theme } from '../constants/theme';
import { GameRecord } from '../database/dbConfig';
import CatalogSlideCard, { SLIDE_COVER_HEIGHT } from './CatalogSlideCard';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = Math.round(SCREEN_W * 0.78);
const CARD_GAP = 14;
const STRIDE = CARD_W + CARD_GAP;
const CARD_H = SLIDE_COVER_HEIGHT + 168;
const SWIPE_THRESHOLD = STRIDE * 0.2;
const SWIPE_VELOCITY = 420;
const TAP_MAX_DISTANCE = 10;
const PAN_ACTIVE_OFFSET = 10;
const OPEN_SUPPRESS_MS = 450;

type Props = {
  games: GameRecord[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onOpen: (gameId: number) => void;
  onToggleFavorite: (gameId: number) => void;
  igdbClientId?: string | null;
  emptyComponent: React.ReactNode;
};

type CarouselSlotProps = {
  gameIndex: number;
  game: GameRecord;
  activeIndexSv: SharedValue<number>;
  translateX: SharedValue<number>;
  indexLabel?: string;
  igdbClientId?: string | null;
  heartTrigger?: number;
  heartBurstFavorited?: boolean;
  showInteractive?: boolean;
};

function CarouselSlot({
  gameIndex,
  game,
  activeIndexSv,
  translateX,
  indexLabel,
  igdbClientId,
  heartTrigger,
  heartBurstFavorited,
  showInteractive = false,
}: CarouselSlotProps) {
  const slotStyle = useAnimatedStyle(() => {
    const relIndex = gameIndex - activeIndexSv.value;
    const offsetX = relIndex * STRIDE + translateX.value;
    const centerDist = Math.abs(offsetX) / STRIDE;
    const scale = interpolate(centerDist, [0, 1], [1, 0.86], Extrapolation.CLAMP);
    const opacity = interpolate(centerDist, [0, 0.45, 1], [1, 0.62, 0.34], Extrapolation.CLAMP);

    return {
      position: 'absolute',
      width: CARD_W,
      height: CARD_H,
      left: (SCREEN_W - CARD_W) / 2,
      transform: [{ translateX: offsetX }, { scale }],
      opacity,
      zIndex: Math.round(100 - centerDist * 90),
    };
  });

  const veilStyle = useAnimatedStyle(() => {
    const relIndex = gameIndex - activeIndexSv.value;
    const offsetX = relIndex * STRIDE + translateX.value;
    const centerDist = Math.abs(offsetX) / STRIDE;
    return {
      opacity: interpolate(centerDist, [0, 0.35, 1], [0, 0.25, 0.45], Extrapolation.CLAMP),
    };
  });

  return (
    <Animated.View style={slotStyle} pointerEvents={showInteractive ? 'auto' : 'none'}>
      <CatalogSlideCard
        game={game}
        indexLabel={indexLabel}
        igdbClientId={igdbClientId}
        heartTrigger={heartTrigger}
        heartBurstFavorited={heartBurstFavorited}
        showInteractive={showInteractive}
      />
      <Animated.View style={[styles.sideVeil, veilStyle]} pointerEvents="none" />
    </Animated.View>
  );
}

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
  const [deckIndex, setDeckIndex] = React.useState(currentIndex);
  const translateX = useSharedValue(0);
  const activeIndexSv = useSharedValue(currentIndex);
  const countSv = useSharedValue(games.length);
  const panDidMoveSv = useSharedValue(false);
  const suppressOpenRef = React.useRef(false);
  const suppressTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const suppressOpenBriefly = React.useCallback(() => {
    suppressOpenRef.current = true;
    if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
    suppressTimerRef.current = setTimeout(() => {
      suppressOpenRef.current = false;
      suppressTimerRef.current = null;
    }, OPEN_SUPPRESS_MS);
  }, []);

  React.useEffect(
    () => () => {
      if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
    },
    []
  );

  React.useEffect(() => {
    setDeckIndex(currentIndex);
    activeIndexSv.value = currentIndex;
    countSv.value = games.length;
    translateX.value = 0;
  }, [activeIndexSv, countSv, currentIndex, games.length, translateX]);

  const game = games[deckIndex] ?? null;
  const prevGame = deckIndex > 0 ? games[deckIndex - 1] : null;
  const nextGame = deckIndex < games.length - 1 ? games[deckIndex + 1] : null;

  const applyIndexChange = React.useCallback(
    (nextIndex: number) => {
      setDeckIndex(nextIndex);
      activeIndexSv.value = nextIndex;
      translateX.value = 0;
      onIndexChange(nextIndex);
    },
    [activeIndexSv, onIndexChange, translateX]
  );

  const bounceBack = React.useCallback(() => {
    translateX.value = withSpring(0, { damping: 20, stiffness: 240 });
  }, [translateX]);

  const commitSwipe = React.useCallback(
    (direction: 'left' | 'right') => {
      suppressOpenBriefly();
      const target = direction === 'left' ? -STRIDE : STRIDE;
      translateX.value = withTiming(target, { duration: 240 }, (finished) => {
        if (!finished) return;
        const count = countSv.value;
        const idx = activeIndexSv.value;
        const nextIdx = direction === 'left' ? idx + 1 : idx - 1;
        if (nextIdx < 0 || nextIdx >= count) {
          translateX.value = withSpring(0, { damping: 20, stiffness: 240 });
          return;
        }
        runOnJS(applyIndexChange)(nextIdx);
      });
    },
    [activeIndexSv, applyIndexChange, countSv, suppressOpenBriefly, translateX]
  );

  const panGesture = React.useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-PAN_ACTIVE_OFFSET, PAN_ACTIVE_OFFSET])
        .failOffsetY([-28, 28])
        .onBegin(() => {
          'worklet';
          panDidMoveSv.value = false;
        })
        .onUpdate((e) => {
          'worklet';
          if (Math.abs(e.translationX) > PAN_ACTIVE_OFFSET) {
            panDidMoveSv.value = true;
          }
          const idx = activeIndexSv.value;
          const count = countSv.value;
          if (e.translationX > 0 && idx === 0) {
            translateX.value = e.translationX * 0.28;
            return;
          }
          if (e.translationX < 0 && idx >= count - 1) {
            translateX.value = e.translationX * 0.28;
            return;
          }
          translateX.value = e.translationX;
        })
        .onEnd((e) => {
          'worklet';
          const idx = activeIndexSv.value;
          const count = countSv.value;
          const tx = e.translationX;
          const vx = e.velocityX;
          const moved =
            panDidMoveSv.value ||
            Math.abs(tx) > TAP_MAX_DISTANCE ||
            Math.abs(vx) > SWIPE_VELOCITY * 0.5;
          if (moved) {
            runOnJS(suppressOpenBriefly)();
          }
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
    [
      activeIndexSv,
      bounceBack,
      commitSwipe,
      countSv,
      panDidMoveSv,
      suppressOpenBriefly,
      translateX,
    ]
  );

  const handleToggleFavorite = React.useCallback(() => {
    if (!game) return;
    const nextFav = game.favorite !== 1;
    setHeartBurstFavorited(nextFav);
    setHeartTrigger((n) => n + 1);
    onToggleFavorite(game.id);
  }, [game, onToggleFavorite]);

  const handleOpen = React.useCallback(() => {
    if (!game || suppressOpenRef.current) return;
    onOpen(game.id);
  }, [game, onOpen]);

  const tapGesture = React.useMemo(() => {
    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .maxDelay(300)
      .maxDistance(TAP_MAX_DISTANCE)
      .requireExternalGestureToFail(panGesture)
      .onEnd(() => {
        runOnJS(handleToggleFavorite)();
      });

    const singleTap = Gesture.Tap()
      .numberOfTaps(1)
      .maxDuration(250)
      .maxDistance(TAP_MAX_DISTANCE)
      .requireExternalGestureToFail(panGesture)
      .requireExternalGestureToFail(doubleTap)
      .onEnd(() => {
        runOnJS(handleOpen)();
      });

    return Gesture.Exclusive(doubleTap, singleTap);
  }, [handleOpen, handleToggleFavorite, panGesture]);

  const composed = React.useMemo(
    () => Gesture.Exclusive(panGesture, tapGesture),
    [panGesture, tapGesture]
  );

  if (games.length === 0) {
    return <View style={styles.emptyWrap}>{emptyComponent}</View>;
  }

  if (!game) {
    return <View style={styles.emptyWrap}>{emptyComponent}</View>;
  }

  const indexLabel = `${deckIndex + 1} / ${games.length}`;

  return (
    <View style={styles.deck}>
      <GestureDetector gesture={composed}>
        <View
          style={styles.carouselStage}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`Juego ${deckIndex + 1} de ${games.length}: ${game.title}, ${game.platform}`}
          accessibilityHint="Desliza izquierda para el siguiente juego, desliza derecha para el anterior, toca dos veces para favorito, toca una vez para abrir la ficha"
          accessibilityValue={{ min: 1, max: games.length, now: deckIndex + 1 }}
        >
          {prevGame ? (
            <CarouselSlot
              key={prevGame.id}
              gameIndex={deckIndex - 1}
              game={prevGame}
              activeIndexSv={activeIndexSv}
              translateX={translateX}
              igdbClientId={igdbClientId}
            />
          ) : null}
          <CarouselSlot
            key={game.id}
            gameIndex={deckIndex}
            game={game}
            activeIndexSv={activeIndexSv}
            translateX={translateX}
            indexLabel={indexLabel}
            igdbClientId={igdbClientId}
            heartTrigger={heartTrigger}
            heartBurstFavorited={heartBurstFavorited}
            showInteractive
          />
          {nextGame ? (
            <CarouselSlot
              key={nextGame.id}
              gameIndex={deckIndex + 1}
              game={nextGame}
              activeIndexSv={activeIndexSv}
              translateX={translateX}
              igdbClientId={igdbClientId}
            />
          ) : null}
        </View>
      </GestureDetector>
      <Text style={styles.swipeHint}>Desliza ← siguiente · → anterior</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  deck: {
    flex: 1,
    minHeight: CARD_H + 24,
  },
  carouselStage: {
    flex: 1,
    minHeight: CARD_H,
    overflow: 'hidden',
  },
  sideVeil: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    backgroundColor: '#000',
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
