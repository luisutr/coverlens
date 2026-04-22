import { Orbitron_900Black, useFonts } from '@expo-google-fonts/orbitron';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TarjetaJuego from '../../components/TarjetaJuego';
import { theme } from '../../constants/theme';
import { GameRecord, deleteGame, getGames, initDatabase } from '../../database/dbConfig';
import {
  type CatalogFilters,
  type CatalogSort,
  filterAndSortGames,
} from '../../services/catalogDisplay';
import { getApiCredentials } from '../../services/credentialsStore';
import { uniqueCanonicalPlatforms } from '../../services/utils/platformTokens';
import { pickGridCoverDisplayUri } from '../../services/storage/coverThumbUrls';
import { formatMoneyMinor } from '../../services/utils/moneyFormat';

const SORT_OPTIONS: { key: CatalogSort; label: string }[] = [
  { key: 'added_desc', label: 'Reciente' },
  { key: 'title_asc', label: 'Título' },
  { key: 'platform_asc', label: 'Plataforma' },
  { key: 'year_desc', label: 'Año' },
  { key: 'rating_desc', label: 'Puntuación' },
  { key: 'value_desc', label: 'Valor' },
];

/** Alto de la barra fija (filtros + orden) debajo de la safe area; debe coincidir con el padding superior del list header. */
const STICKY_FILTER_BAR_BODY = 52;

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollY = React.useRef(new Animated.Value(0)).current;

  const [fontsLoaded] = useFonts({
    Orbitron_900Black,
  });

  const [games, setGames] = React.useState<GameRecord[]>([]);
  const [search, setSearch] = React.useState('');
  const [platformFilter, setPlatformFilter] = React.useState<string | null>(null);
  const [platformModalOpen, setPlatformModalOpen] = React.useState(false);
  const [sortMenuOpen, setSortMenuOpen] = React.useState(false);
  const [onlyFavorite, setOnlyFavorite] = React.useState(false);
  const [onlyDiscOnly, setOnlyDiscOnly] = React.useState(false);
  const [sort, setSort] = React.useState<CatalogSort>('added_desc');
  const [igdbClientId, setIgdbClientId] = React.useState<string>('');

  useFocusEffect(
    React.useCallback(() => {
      void getApiCredentials().then((c) => setIgdbClientId(c.igdbClientId.trim()));
    }, [])
  );

  const platformOptions = React.useMemo(() => uniqueCanonicalPlatforms(games), [games]);

  React.useEffect(() => {
    if (platformFilter && !platformOptions.includes(platformFilter)) {
      setPlatformFilter(null);
    }
  }, [platformFilter, platformOptions]);

  const filters = React.useMemo<CatalogFilters>(
    () => ({
      search,
      platform: platformFilter,
      onlyFavorite,
      onlyDiscOnly,
    }),
    [search, platformFilter, onlyFavorite, onlyDiscOnly]
  );

  const displayedGames = React.useMemo(
    () => filterAndSortGames(games, filters, sort),
    [games, filters, sort]
  );

  const sortLabel = React.useMemo(
    () => SORT_OPTIONS.find((o) => o.key === sort)?.label ?? 'Reciente',
    [sort]
  );

  const chromeOpacity = scrollY.interpolate({
    inputRange: [0, 64, 180],
    outputRange: [1, 0.9, 0.72],
    extrapolate: 'clamp',
  });

  const onScroll = React.useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: false,
      }),
    [scrollY]
  );

  const loadGames = React.useCallback(async () => {
    await initDatabase();
    const data = await getGames();
    setGames(data);
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadGames().catch(() => {
        Alert.alert('Error', 'No se pudo cargar el catálogo local.');
      });
    }, [loadGames])
  );

  const onDeleteGame = React.useCallback(
    (gameId: number) => {
      Alert.alert('Eliminar juego', '¿Quitar este juego del catálogo?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            deleteGame(gameId)
              .then(loadGames)
              .catch(() => Alert.alert('Error', 'No se pudo eliminar el juego.'));
          },
        },
      ]);
    },
    [loadGames]
  );

  const onOpenGame = React.useCallback(
    (gameId: number) => {
      router.push(`/game/${gameId}`);
    },
    [router]
  );

  const resolved = games.filter((g) => g.metadataStatus === 'resolved').length;
  const partial = games.filter((g) => g.metadataStatus === 'partial').length;
  const errors = games.filter((g) => g.metadataStatus === 'error').length;

  const listData = games.length === 0 ? [] : displayedGames;

  const renderListEmpty = React.useCallback(() => {
    if (games.length === 0) {
      return (
        <View style={styles.emptyBox}>
          <Ionicons name="game-controller-outline" size={48} color={theme.colors.textDim} />
          <Text style={styles.emptyTitle}>Catálogo vacío</Text>
          <Text style={styles.emptyText}>
            Escanea tu primer juego con el botón de abajo o búscalo manualmente.
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyBox}>
        <Ionicons name="funnel-outline" size={44} color={theme.colors.textDim} />
        <Text style={styles.emptyTitle}>Sin resultados</Text>
        <Text style={styles.emptyText}>Prueba a cambiar la búsqueda o los filtros.</Text>
      </View>
    );
  }, [games.length]);

  const listHeaderPaddingTop =
    games.length > 0 ? insets.top + STICKY_FILTER_BAR_BODY : insets.top + 8;

  const listHeader = React.useMemo(
    () => (
      <View style={[styles.listHeader, { paddingTop: listHeaderPaddingTop }]}>
        <View style={styles.brandRow}>
          <Image
            source={require('../../assets/images/icon.png')}
            style={styles.brandIcon}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
          <View style={styles.brandTextCol}>
            <Text
              style={[
                styles.brandTitle,
                fontsLoaded ? { fontFamily: 'Orbitron_900Black' } : { fontWeight: '900' },
              ]}
              accessibilityRole="header"
            >
              COVERLENS
            </Text>
            <Text style={styles.brandTagline}>Tu colección en la mano</Text>
          </View>
        </View>

        <View style={styles.searchStatsRow}>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar título, plataforma o código…"
            placeholderTextColor={theme.colors.textDim}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Buscar en el catálogo"
          />
          <View style={styles.countBadge} accessibilityLabel={`${games.length} juegos en el catálogo`}>
            <Text style={styles.countBadgeNum}>{games.length}</Text>
            <Text style={styles.countBadgeLbl}>juegos</Text>
          </View>
        </View>

        {displayedGames.length !== games.length && games.length > 0 ? (
          <Text style={styles.filterMeta}>
            Mostrando {displayedGames.length} de {games.length}
          </Text>
        ) : null}

        {(resolved > 0 || partial > 0 || errors > 0) && games.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statsRow}
          >
            {resolved > 0 && (
              <View style={[styles.statChip, styles.statChipGreen]}>
                <Text style={[styles.statNumber, { color: '#2ecc71' }]}>{resolved}</Text>
                <Text style={styles.statLabel}>OK</Text>
              </View>
            )}
            {partial > 0 && (
              <View style={[styles.statChip, styles.statChipYellow]}>
                <Text style={[styles.statNumber, { color: '#f39c12' }]}>{partial}</Text>
                <Text style={styles.statLabel}>parcial</Text>
              </View>
            )}
            {errors > 0 && (
              <View style={[styles.statChip, styles.statChipRed]}>
                <Text style={[styles.statNumber, { color: '#e74c3c' }]}>{errors}</Text>
                <Text style={styles.statLabel}>error</Text>
              </View>
            )}
          </ScrollView>
        ) : null}
      </View>
    ),
    [
      listHeaderPaddingTop,
      search,
      games.length,
      displayedGames.length,
      resolved,
      partial,
      errors,
      fontsLoaded,
    ]
  );

  const filterSortStickyBar = (
    <View style={[styles.filterRow, styles.filterRowInSticky]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterChipsScrollHost}
        contentContainerStyle={styles.filterChipsScroll}
      >
        <TouchableOpacity
          style={[styles.chip, platformFilter != null && styles.chipOn, styles.chipPlatform]}
          onPress={() => setPlatformModalOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Filtrar por plataforma"
        >
          <Ionicons
            name="layers-outline"
            size={15}
            color={platformFilter != null ? theme.colors.primary : theme.colors.textDim}
          />
          <Text
            style={[styles.chipText, platformFilter != null && styles.chipTextOn]}
            numberOfLines={1}
          >
            {platformFilter ?? 'Plataforma'}
          </Text>
          <Ionicons name="chevron-down" size={14} color={theme.colors.textDim} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.chipIconOnly, onlyFavorite && styles.chipOn]}
          onPress={() => setOnlyFavorite((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ selected: onlyFavorite }}
          accessibilityLabel="Solo favoritos"
        >
          <Ionicons
            name={onlyFavorite ? 'heart' : 'heart-outline'}
            size={22}
            color={onlyFavorite ? '#ffffff' : theme.colors.textDim}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.chipIconOnly, onlyDiscOnly && styles.chipOn]}
          onPress={() => setOnlyDiscOnly((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ selected: onlyDiscOnly }}
          accessibilityLabel="Solo disco"
        >
          <Ionicons
            name={onlyDiscOnly ? 'star' : 'star-outline'}
            size={22}
            color={onlyDiscOnly ? '#ffffff' : theme.colors.textDim}
          />
        </TouchableOpacity>
      </ScrollView>
      <TouchableOpacity
        style={styles.sortPill}
        onPress={() => setSortMenuOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Orden: ${sortLabel}. Abrir menú de ordenación`}
      >
        <Text style={styles.sortPillText} numberOfLines={1}>
          {sortLabel}
        </Text>
        <Ionicons name="chevron-down" size={16} color={theme.colors.primary} />
      </TouchableOpacity>
    </View>
  );

  if (!fontsLoaded) {
    return (
      <View style={[styles.container, styles.fontsLoading]}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Modal
        visible={platformModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setPlatformModalOpen(false)}
      >
        <View style={styles.platformModalRoot}>
          <Pressable style={styles.platformModalBackdrop} onPress={() => setPlatformModalOpen(false)} />
          <View style={styles.platformModalSheet}>
            <View style={styles.platformModalHandle} />
            <Text style={styles.platformModalTitle}>Plataforma</Text>
            <FlatList
              data={platformOptions}
              keyExtractor={(item) => item}
              ListHeaderComponent={
                <TouchableOpacity
                  style={[styles.platformRow, platformFilter === null && styles.platformRowSelected]}
                  onPress={() => {
                    setPlatformFilter(null);
                    setPlatformModalOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: platformFilter === null }}
                >
                  <Text
                    style={[
                      styles.platformRowText,
                      platformFilter === null && styles.platformRowTextSelected,
                    ]}
                  >
                    Todas
                  </Text>
                </TouchableOpacity>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.platformRow, platformFilter === item && styles.platformRowSelected]}
                  onPress={() => {
                    setPlatformFilter(item);
                    setPlatformModalOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: platformFilter === item }}
                >
                  <Text
                    style={[
                      styles.platformRowText,
                      platformFilter === item && styles.platformRowTextSelected,
                    ]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
              style={styles.platformList}
              keyboardShouldPersistTaps="handled"
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={sortMenuOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setSortMenuOpen(false)}
      >
        <View style={styles.platformModalRoot}>
          <Pressable style={styles.platformModalBackdrop} onPress={() => setSortMenuOpen(false)} />
          <View style={styles.sortMenuSheet}>
            <View style={styles.platformModalHandle} />
            <Text style={styles.platformModalTitle}>Ordenar por</Text>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={styles.sortMenuScroll}
              contentContainerStyle={styles.sortMenuScrollContent}
            >
              {SORT_OPTIONS.map((o) => (
                <TouchableOpacity
                  key={o.key}
                  style={[styles.sortOptionRow, sort === o.key && styles.sortOptionRowSelected]}
                  onPress={() => {
                    setSort(o.key);
                    setSortMenuOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sort === o.key }}
                >
                  <Text
                    style={[styles.sortOptionText, sort === o.key && styles.sortOptionTextSelected]}
                  >
                    {o.label}
                  </Text>
                  {sort === o.key ? (
                    <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} />
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Animated.FlatList
        style={styles.gameList}
        data={listData}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        ListHeaderComponent={listHeader}
        renderItem={({ item }) => (
          <View style={styles.gridCell}>
            <TarjetaJuego
              id={item.id}
              titulo={item.title}
              plataforma={item.platform}
              coverUrl={pickGridCoverDisplayUri(item.coverUrl, item.coverLocalThumbUri)}
              metadataStatus={item.metadataStatus}
              favorito={item.favorite === 1}
              soloDisco={item.discOnly === 1}
              valorLabel={formatMoneyMinor(item.valueCents ?? null, item.valueCurrency ?? null)}
              igdbClientId={igdbClientId || null}
              onOpen={onOpenGame}
              onDelete={onDeleteGame}
            />
          </View>
        )}
        ListEmptyComponent={renderListEmpty}
        contentContainerStyle={[
          styles.gridList,
          listData.length === 0 && styles.gridListEmpty,
        ]}
        columnWrapperStyle={listData.length > 0 ? styles.gridRow : undefined}
        initialNumToRender={12}
        windowSize={7}
        onScroll={onScroll}
        scrollEventThrottle={16}
      />

      {games.length > 0 ? (
        <View style={[styles.stickyChromeWrap, { paddingTop: insets.top }]} pointerEvents="box-none">
          <Animated.View style={[styles.stickyChromeInner, { opacity: chromeOpacity }]}>
            {filterSortStickyBar}
          </Animated.View>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.fab, { bottom: 24 + Math.max(insets.bottom, 8), zIndex: 30 }]}
        activeOpacity={0.7}
        onPress={() => router.push('/escaner')}
        accessibilityRole="button"
        accessibilityLabel="Abrir escáner"
        accessibilityHint="Abre la pantalla para escanear códigos de barras"
      >
        <Ionicons name="barcode-outline" size={30} color="#ffffff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  fontsLoading: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  stickyChromeWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    elevation: 14,
  },
  stickyChromeInner: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 8,
    backgroundColor: 'rgba(6, 10, 16, 0.78)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 127, 255, 0.22)',
  },
  listHeader: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  filterRowInSticky: {
    marginTop: 0,
  },
  filterChipsScrollHost: {
    flex: 1,
    minWidth: 0,
  },
  filterChipsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(18, 22, 28, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(42, 42, 42, 0.9)',
    maxWidth: 200,
  },
  chipPlatform: {
    maxWidth: 168,
  },
  chipOn: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(0,127,255,0.18)',
  },
  chipText: {
    color: theme.colors.textDim,
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  chipTextOn: {
    color: theme.colors.primary,
  },
  chipIconOnly: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 36,
    borderRadius: 20,
    backgroundColor: 'rgba(18, 22, 28, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(42, 42, 42, 0.9)',
  },
  sortPill: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(18, 22, 28, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(0, 127, 255, 0.4)',
    maxWidth: 118,
  },
  sortPillText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  sortMenuSheet: {
    backgroundColor: '#121212',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderBottomWidth: 0,
    maxHeight: '52%',
    paddingBottom: 24,
  },
  sortMenuScroll: {
    maxHeight: 320,
  },
  sortMenuScrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  sortOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e1e',
  },
  sortOptionRowSelected: {
    backgroundColor: 'rgba(0,127,255,0.08)',
  },
  sortOptionText: {
    color: theme.colors.textLight,
    fontSize: 15,
  },
  sortOptionTextSelected: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  brandIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 127, 255, 0.35)',
  },
  brandTextCol: {
    flex: 1,
    minWidth: 0,
  },
  brandTitle: {
    fontSize: 22,
    letterSpacing: 2.5,
    color: '#e8f4ff',
    textShadowColor: 'rgba(0, 127, 255, 0.75)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  brandTagline: {
    marginTop: 2,
    fontSize: 12,
    color: theme.colors.textDim,
    letterSpacing: 0.3,
  },
  searchStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.textLight,
    fontSize: 14,
  },
  countBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 56,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(0, 127, 255, 0.12)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 127, 255, 0.35)',
  },
  countBadgeNum: {
    color: theme.colors.primary,
    fontSize: 17,
    fontWeight: '800',
  },
  countBadgeLbl: {
    color: theme.colors.textDim,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterMeta: {
    color: theme.colors.textDim,
    fontSize: 11,
    marginTop: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingRight: 8,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#222',
  },
  statChipGreen: { borderColor: 'rgba(46,204,113,0.3)' },
  statChipYellow: { borderColor: 'rgba(243,156,18,0.3)' },
  statChipRed: { borderColor: 'rgba(231,76,60,0.3)' },
  statNumber: {
    color: theme.colors.textLight,
    fontSize: 15,
    fontWeight: '700',
  },
  statLabel: {
    color: theme.colors.textDim,
    fontSize: 11,
  },
  gameList: { flex: 1 },
  gridList: {
    paddingBottom: 100,
  },
  gridListEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  gridRow: {
    justifyContent: 'center',
    marginBottom: 4,
  },
  gridCell: {
    width: '50%',
    alignItems: 'center',
  },
  emptyBox: {
    alignItems: 'center',
    marginTop: 40,
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: theme.colors.textLight,
    fontSize: 18,
    fontWeight: '700',
  },
  emptyText: {
    color: theme.colors.textDim,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  fab: {
    position: 'absolute',
    right: 20,
    backgroundColor: theme.colors.primary,
    width: 65,
    height: 65,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 8,
  },
  platformModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  platformModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  platformModalSheet: {
    backgroundColor: '#121212',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderBottomWidth: 0,
    maxHeight: '72%',
    paddingBottom: 28,
  },
  platformModalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3a3a3a',
    marginTop: 10,
    marginBottom: 8,
  },
  platformModalTitle: {
    color: theme.colors.textLight,
    fontSize: 17,
    fontWeight: '700',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  platformList: {
    flexGrow: 0,
  },
  platformRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e1e',
  },
  platformRowSelected: {
    backgroundColor: 'rgba(0,127,255,0.1)',
  },
  platformRowText: {
    color: theme.colors.textLight,
    fontSize: 15,
  },
  platformRowTextSelected: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
});
