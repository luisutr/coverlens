import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../constants/theme';
import { GameRecord } from '../database/dbConfig';
import HeartBurstOverlay from './HeartBurstOverlay';
import { getIgdbImageRequestHeadersSync } from '../services/igdbImageRequest';
import { pickGridCoverDisplayUri } from '../services/storage/coverThumbUrls';
import { formatMoneyMinor } from '../services/utils/moneyFormat';

type Props = {
  game: GameRecord;
  indexLabel: string;
  igdbClientId?: string | null;
  heartTrigger: number;
  heartBurstFavorited: boolean;
};

export default function CatalogSlideCard({
  game,
  indexLabel,
  igdbClientId,
  heartTrigger,
  heartBurstFavorited,
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
    <View style={styles.card}>
      <View style={styles.coverWrap}>
        {coverSource ? (
          <Image
            source={coverSource}
            style={styles.cover}
            contentFit="contain"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Ionicons name="game-controller-outline" size={48} color="#333" />
            <Text style={styles.coverPlaceholderText}>SIN CARÁTULA</Text>
          </View>
        )}
        <HeartBurstOverlay trigger={heartTrigger} favorited={heartBurstFavorited} />
        {game.favorite === 1 ? (
          <View style={styles.favBadge}>
            <Ionicons name="heart" size={16} color="#ff4268" />
          </View>
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
      ) : null}
      <Text style={styles.indexLabel}>{indexLabel}</Text>
      <Text style={styles.hint}>Doble toque: favorito · Toque: abrir ficha</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#111111',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 14,
    overflow: 'hidden',
  },
  coverWrap: {
    flex: 1,
    minHeight: 280,
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
  },
  platform: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  value: {
    color: '#9acd32',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  indexLabel: {
    color: theme.colors.textDim,
    fontSize: 12,
    marginTop: 10,
    textAlign: 'center',
  },
  hint: {
    color: theme.colors.textDim,
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
