import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../constants/theme';
import { getIgdbImageRequestHeadersSync } from '../services/igdbImageRequest';

const STATUS_COLOR: Record<string, string> = {
  pending: '#aaaaaa',
  resolved: '#40d67b',
  partial: '#f1c40f',
  error: '#ff6b6b',
};

interface TarjetaJuegoProps {
  id: number;
  titulo: string;
  plataforma: string;
  coverUrl?: string | null;
  metadataStatus?: 'pending' | 'resolved' | 'partial' | 'error';
  favorito?: boolean;
  soloDisco?: boolean;
  /** Texto ya formateado (ej. importe + moneda) */
  valorLabel?: string | null;
  /** Client ID de Twitch/IGDB (Ajustes): necesario para cargar imágenes del CDN de IGDB */
  igdbClientId?: string | null;
  onOpen: (id: number) => void;
  onDelete: (id: number) => void;
}

export default function TarjetaJuego({
  id,
  titulo,
  plataforma,
  coverUrl,
  metadataStatus = 'pending',
  favorito = false,
  soloDisco = false,
  valorLabel = null,
  igdbClientId = null,
  onOpen,
  onDelete,
}: TarjetaJuegoProps) {
  const coverHeaders = getIgdbImageRequestHeadersSync(coverUrl, igdbClientId ?? undefined);
  const coverSource =
    coverUrl != null && coverUrl !== ''
      ? coverHeaders
        ? { uri: coverUrl, headers: coverHeaders }
        : { uri: coverUrl }
      : null;

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.82}
        onPress={() => onOpen(id)}
        accessibilityRole="button"
        accessibilityLabel={`Abrir ${titulo}`}
        accessibilityHint="Abre la ficha detallada del juego"
      >

        {/* Portada */}
        <View style={styles.portadaContainer}>
          {coverSource ? (
            <Image
              source={coverSource}
              style={styles.coverImage}
              contentFit="contain"
              contentPosition="center"
              transition={200}
              cachePolicy="memory-disk"
              recyclingKey={`game-${id}-${coverUrl?.slice(-48) ?? 'x'}`}
            />
          ) : (
            <View style={styles.portadaPlaceholder}>
              <Ionicons name="game-controller-outline" size={32} color="#333" />
              <Text style={styles.portadaText}>SIN CARÁTULA</Text>
            </View>
          )}
        </View>

        {/* Metadata */}
        <Text style={styles.titulo} numberOfLines={2}>{titulo}</Text>
        <Text style={styles.plataforma} numberOfLines={1}>{plataforma}</Text>
        {valorLabel ? (
          <Text style={styles.valor} numberOfLines={1} accessibilityLabel={`Valor estimado ${valorLabel}`}>
            est. {valorLabel}
          </Text>
        ) : null}

        <View style={styles.footer}>
          <View style={styles.statusPill}>
            <View style={[styles.dot, { backgroundColor: STATUS_COLOR[metadataStatus] ?? '#aaa' }]} />
            <Text style={styles.statusText}>{metadataStatus}</Text>
          </View>
          <View style={styles.badges}>
            <Ionicons
              name={favorito ? 'heart' : 'heart-outline'}
              size={14}
              color={favorito ? '#ff4268' : theme.colors.textDim}
            />
            <Ionicons
              name={soloDisco ? 'disc' : 'disc-outline'}
              size={14}
              color={soloDisco ? theme.colors.primary : theme.colors.textDim}
            />
          </View>
        </View>

      </TouchableOpacity>

      {/* Botón eliminar: hermano absoluto para evitar conflictos de gestos */}
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={() => onDelete(id)}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel={`Eliminar ${titulo}`}
        accessibilityHint="Quita este juego de la colección"
      >
        <Ionicons name="trash-outline" size={13} color="#ff6b6b" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    width: 145,
    margin: 8,
  },
  card: {
    width: '100%',
    backgroundColor: '#111111',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    overflow: 'hidden',
  },
  /** ~proporción carátula PAL (ancho / alto); alto = ancho / ratio */
  portadaContainer: {
    width: '100%',
    aspectRatio: 90 / 128,
    backgroundColor: '#1a1a1a',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  portadaPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  portadaText: {
    color: '#333333',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  titulo: {
    color: theme.colors.textLight,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 7,
    marginHorizontal: 8,
    lineHeight: 16,
  },
  plataforma: {
    color: theme.colors.primary,
    fontSize: 10,
    fontWeight: '600',
    marginHorizontal: 8,
    marginTop: 2,
    marginBottom: 2,
  },
  valor: {
    color: '#9acd32',
    fontSize: 10,
    fontWeight: '700',
    marginHorizontal: 8,
    marginBottom: 5,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
    gap: 6,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    color: theme.colors.textDim,
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badges: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  deleteBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
