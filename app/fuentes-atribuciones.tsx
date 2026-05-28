import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { theme } from '../constants/theme';

/** Favicons vía CDN homogénea (misma resolución pedida → encaje visual uniforme). */
function faviconForDomain(domain: string, size = 128) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
}

const LOGO_TILE = { width: 100, height: 56 };
const TILE_GAP = 10;

const PARTNERS: Array<{
  key: string;
  displayName: string;
  faviconDomain: string;
  url: string;
  note: string;
}> = [
  {
    key: 'gameplay',
    displayName: 'GameplayStores',
    faviconDomain: 'gameplaystores.es',
    url: 'https://www.gameplaystores.es/',
    note: 'Búsqueda opcional en catálogo y portadas.',
  },
  {
    key: 'igdb',
    displayName: 'IGDB',
    faviconDomain: 'igdb.com',
    url: 'https://api-docs.igdb.com/',
    note: 'Metadatos e imágenes opcionales (API de Twitch / IGDB).',
  },
  {
    key: 'sgdb',
    displayName: 'SteamGridDB',
    faviconDomain: 'steamgriddb.com',
    url: 'https://www.steamgriddb.com/',
    note: 'Portadas opcionales (uso sujeto a sus términos y tu clave).',
  },
  {
    key: 'ss',
    displayName: 'ScreenScraper',
    faviconDomain: 'screenscraper.fr',
    url: 'https://www.screenscraper.fr/',
    note: 'Metadatos y portadas opcionales.',
  },
  {
    key: 'gameupc',
    displayName: 'GameUPC',
    faviconDomain: 'gameupc.com',
    url: 'https://www.gameupc.com/',
    note: 'Fallback opcional por código de barras.',
  },
];

function LogoTile({
  uri,
  label,
  onPress,
}: {
  uri: string;
  label: string;
  onPress: () => void;
}) {
  const [failed, setFailed] = React.useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir sitio ${label}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.logoTileOuter,
        pressed && styles.logoTilePressed,
      ]}
    >
      <View style={styles.logoTileInner}>
        {!failed ? (
          <Image
            source={{ uri }}
            style={styles.logoImage}
            contentFit="contain"
            cachePolicy="memory-disk"
            onError={() => setFailed(true)}
          />
        ) : (
          <Ionicons name="globe-outline" size={28} color={theme.colors.textDim} />
        )}
      </View>
    </Pressable>
  );
}

export default function FuentesAtribucionesScreen() {
  const { width: windowW } = useWindowDimensions();

  const open = React.useCallback(async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      // Si falla el intent del sistema, el enlace sigue visible debajo en cada tarjeta.
    }
  }, []);

  const stripSnap = React.useMemo(() => {
    const pad = theme.spacing.medium * 2;
    const available = Math.max(0, windowW - pad);
    const gaps = Math.max(0, PARTNERS.length - 1);
    const totalTile = PARTNERS.length * LOGO_TILE.width + gaps * TILE_GAP;
    return totalTile <= available ? 'center' : 'start';
  }, [windowW]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.poweredEyebrow}>Powered by</Text>
        <Text style={styles.heroTitle}>Servicios externos</Text>
        <Text style={styles.heroBody}>
          Las fuentes opcionales de datos y arte que puedes configurar en Ajustes reconocen a estos
          proveedores.
        </Text>
      </View>

      <Text style={styles.stripLabel}>Partners tecnológicos</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.stripScrollBleed}
        contentContainerStyle={[
          styles.stripRow,
          stripSnap === 'center' && styles.stripRowCentered,
        ]}
      >
        {PARTNERS.map((p, i) => (
          <React.Fragment key={p.key}>
            {i > 0 ? <View style={{ width: TILE_GAP }} /> : null}
            <LogoTile
              uri={faviconForDomain(p.faviconDomain)}
              label={p.displayName}
              onPress={() => void open(p.url)}
            />
          </React.Fragment>
        ))}
      </ScrollView>

      <View style={styles.divider} />

      <Text style={styles.detailSectionTitle}>Detalle</Text>
      <Text style={styles.lead}>
        CoverLens es un proyecto independiente y no está afiliado oficialmente a estos
        proveedores.
      </Text>

      {PARTNERS.map((p) => (
        <DetailCard key={p.key} partner={p} onOpen={() => void open(p.url)} />
      ))}
    </ScrollView>
  );
}

function DetailCard({
  partner,
  onOpen,
}: {
  partner: (typeof PARTNERS)[number];
  onOpen: () => void;
}) {
  const uri = faviconForDomain(partner.faviconDomain);
  const [failed, setFailed] = React.useState(false);

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardLogoShell}>
          {!failed ? (
            <Image
              source={{ uri }}
              style={styles.cardLogo}
              contentFit="contain"
              cachePolicy="memory-disk"
              onError={() => setFailed(true)}
            />
          ) : (
            <Ionicons name="globe-outline" size={26} color={theme.colors.textDim} />
          )}
        </View>
        <View style={styles.cardTitleBlock}>
          <Text style={styles.providerName}>{partner.displayName}</Text>
          <Text style={styles.note}>{partner.note}</Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Abrir ${partner.displayName}`}
        onPress={onOpen}
        style={({ pressed }) => [styles.ctaRow, pressed && styles.ctaPressed]}
      >
        <Text style={styles.ctaHost} numberOfLines={1}>
          {partner.url.replace(/^https?:\/\//, '')}
        </Text>
        <Ionicons name="open-outline" size={18} color={theme.colors.primary} />
      </Pressable>
    </View>
  );
}

const STRIP_SIDE_PAD = theme.spacing.medium;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: STRIP_SIDE_PAD, paddingBottom: 44, paddingTop: 8 },
  hero: {
    marginBottom: 20,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  poweredEyebrow: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  heroTitle: {
    color: theme.colors.textLight,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  heroBody: {
    color: theme.colors.textDim,
    fontSize: 14,
    lineHeight: 21,
  },
  stripLabel: {
    color: theme.colors.textDim,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  stripScrollBleed: {
    marginHorizontal: -STRIP_SIDE_PAD,
  },
  stripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: STRIP_SIDE_PAD,
  },
  stripRowCentered: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  logoTileOuter: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e1e1e',
    backgroundColor: '#121212',
    overflow: 'hidden',
  },
  logoTilePressed: { opacity: 0.82 },
  logoTileInner: {
    width: LOGO_TILE.width,
    height: LOGO_TILE.height,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  divider: {
    marginTop: 22,
    marginBottom: 6,
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
  },
  detailSectionTitle: {
    marginTop: 12,
    color: theme.colors.textLight,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 6,
  },
  lead: {
    color: theme.colors.textDim,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    padding: 14,
    backgroundColor: theme.colors.surface,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  cardLogoShell: {
    width: 52,
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1f1f1f',
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    flexShrink: 0,
  },
  cardLogo: { width: '100%', height: '100%' },
  cardTitleBlock: { flex: 1, minWidth: 0 },
  providerName: {
    color: theme.colors.textLight,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  note: {
    color: theme.colors.textDim,
    fontSize: 13,
    lineHeight: 18,
  },
  ctaRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  ctaPressed: { opacity: 0.85 },
  ctaHost: {
    flex: 1,
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
});
