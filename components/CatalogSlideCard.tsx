import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { theme } from '../constants/theme';
import { GameRecord } from '../database/dbConfig';
import HeartBurstOverlay from './HeartBurstOverlay';
import { getIgdbImageRequestHeadersSync } from '../services/igdbImageRequest';
import { pickGridCoverDisplayUri } from '../services/storage/coverThumbUrls';
import { formatMoneyMinor } from '../services/utils/moneyFormat';

/** Altura fija del área de portada: evita saltos al cambiar de slot en el carrusel. */
export const SLIDE_COVER_HEIGHT = 300;

type Props = {
  game: GameRecord;
  indexLabel?: string;
  igdbClientId?: string | null;
  heartTrigger?: number;
  heartBurstFavorited?: boolean;
  /** Solo la ficha activa muestra favorito / corazón. */
  showInteractive?: boolean;
};

function CatalogSlideCardInner({
  game,
  indexLabel,
  igdbClientId,
  heartTrigger = 0,
  heartBurstFavorited = false,
  showInteractive = false,
}: Props) {
  const coverUrl = pickGridCoverDisplayUri(game.coverUrl, game.coverLocalThumbUri);
  const coverHeaders = getIgdbImageRequestHeadersSync(coverUrl, igdbClientId ?? undefined);
  const coverSource =
    coverUrl != null && coverUrl !== ''
      ? coverHeaders
        ? { uri: coverUrl, headers: coverHeaders }
        : { uri: coverUrl }
      : null;

  const valorLabel = formatMoneyMinor(game.valueCents ?? null, game.valueCurrency ?? null);

  return (
    <View style={[styles.card, showInteractive && styles.cardActive]}>
      <View style={styles.coverWrap}>
        {coverSource ? (
          <Image
            source={coverSource}
            style={styles.cover}
            contentFit="contain"
            transition={0}
            recyclingKey={`slide-${game.id}`}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Ionicons name="game-controller-outline" size={48} color="#333" />
            <Text style={styles.coverPlaceholderText}>SIN CARÁTULA</Text>
          </View>
        )}
        {showInteractive ? (
          <>
            <HeartBurstOverlay trigger={heartTrigger} favorited={heartBurstFavorited} />
            {game.favorite === 1 ? (
              <View style={styles.favBadge}>
                <Ionicons name="heart" size={16} color="#ff4268" />
              </View>
            ) : null}
          </>
        ) : null}
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {game.title}
      </Text>
      <Text style={styles.platform} numberOfLines={1}>
        {game.platform}
      </Text>
      {valorLabel ? (
        <Text style={styles.value} numberOfLines={1}>
          est. {valorLabel}
        </Text>
      ) : (
        <View style={styles.valueSpacer} />
      )}
      {indexLabel ? <Text style={styles.indexLabel}>{indexLabel}</Text> : null}
      {showInteractive ? (
        <Text style={styles.hint}>Doble toque: favorito · Toque: abrir ficha</Text>
      ) : (
        <View style={styles.hintSpacer} />
      )}
    </View>
  );
}

const CatalogSlideCard = React.memo(CatalogSlideCardInner);
export default CatalogSlideCard;

const styles = StyleSheet.create({
  card: {
    height: '100%',
    backgroundColor: '#111111',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1e1e1e',
    padding: 14,
    overflow: 'hidden',
  },
  cardActive: {
    borderColor: 'rgba(0, 127, 255, 0.35)',
    ...Platform.select({
      ios: {
        shadowColor: '#007fff',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.28,
        shadowRadius: 16,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  coverWrap: {
    height: SLIDE_COVER_HEIGHT,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    overflow: 'hidden',
    marginBottom: 12,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  coverPlaceholderText: {
    color: '#333',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  favBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 14,
    padding: 6,
  },
  title: {
    color: theme.colors.textLight,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
    minHeight: 48,
  },
  platform: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
    minHeight: 20,
  },
  value: {
    color: '#9acd32',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
    minHeight: 18,
  },
  valueSpacer: {
    minHeight: 18,
    marginTop: 4,
  },
  indexLabel: {
    color: theme.colors.textDim,
    fontSize: 12,
    marginTop: 10,
    textAlign: 'center',
    minHeight: 16,
  },
  hint: {
    color: theme.colors.textDim,
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
    fontStyle: 'italic',
    minHeight: 16,
  },
  hintSpacer: {
    minHeight: 16,
    marginTop: 4,
  },
});
