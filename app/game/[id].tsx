import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import {
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFirstRunTour } from '../../contexts/FirstRunTourContext';
import { ATTRIBUTIONS } from '../../constants/thirdPartyAttribution';
import { theme } from '../../constants/theme';
import {
  GameRecord,
  getGameById,
  initDatabase,
  setDiscOnly,
  setFavorite,
  updateGameFull,
  updateGameMetadata,
  updateGameValueEstimate,
} from '../../database/dbConfig';
import { getApiCredentials } from '../../services/credentialsStore';
import {
  advanceTourOnOpenGameDetail,
  completeFirstRunTour,
  getFirstRunTourStep,
  isFirstRunTourActive,
} from '../../services/firstRunTour';
import { loadCoverSourcePreferences } from '../../services/coverSourcePreferences';
import { loadValueSourcePreferences } from '../../services/valueSourcePreferences';
import { resolveValueEstimateFromPreferences } from '../../services/valuePreferenceResolver';
import { resolvePreferredCoverWithSource } from '../../services/coverPreferenceResolver';
import { resolveMetadata } from '../../services/metadataResolver';
import { resolveFromIgdb } from '../../services/providers/igdbProvider';
import { inferCoverSourceLabel } from '../../services/utils/coverUrlSource';
import { deriveMetadataStatusFromGameFields } from '../../services/utils/metadataCompleteness';
import { getIgdbImageRequestHeaders } from '../../services/igdbImageRequest';
import { enqueueCoverThumbCache } from '../../services/storage/coverThumbCache';
import { formatMoneyMinor, parseMoneyInputToMinor } from '../../services/utils/moneyFormat';

const { width: SCREEN_W } = Dimensions.get('window');
const COVER_HEIGHT = Math.round(SCREEN_W * 0.55);

const STATUS_COLOR: Record<string, string> = {
  pending: '#aaaaaa',
  resolved: '#40d67b',
  partial: '#f1c40f',
  error: '#ff6b6b',
};

type EditForm = {
  title: string;
  platform: string;
  version: string;
  releaseYear: string;
  genre: string;
  developer: string;
  publisher: string;
  barcode: string;
  coverUrl: string;
  /** Cabecera ancha en ficha (opcional); catálogo usa solo coverUrl */
  headerImageUrl: string;
  description: string;
  valueAmount: string;
  valueCurrency: 'EUR' | 'USD';
};

export default function GameDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { refresh: refreshTour } = useFirstRunTour();
  const [game, setGame] = React.useState<GameRecord | null>(null);
  const [retrying, setRetrying] = React.useState(false);
  const [coverRefreshing, setCoverRefreshing] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [priceBusy, setPriceBusy] = React.useState(false);
  const [coverImageHeaders, setCoverImageHeaders] = React.useState<Record<string, string> | undefined>();
  const [form, setForm] = React.useState<EditForm>({
    title: '', platform: '', version: '', releaseYear: '',
    genre: '', developer: '', publisher: '', barcode: '', coverUrl: '', headerImageUrl: '', description: '',
    valueAmount: '', valueCurrency: 'EUR',
  });

  const loadGame = React.useCallback(async () => {
    await initDatabase();
    const record = await getGameById(Number(id));
    setGame(record ?? null);
  }, [id]);

  React.useEffect(() => { loadGame(); }, [loadGame]);

  useFocusEffect(
    React.useCallback(() => {
      void (async () => {
        await advanceTourOnOpenGameDetail();
        await refreshTour();
      })();
    }, [refreshTour])
  );

  const headerDisplayUrl = game?.headerImageUrl?.trim() || game?.coverUrl;

  React.useEffect(() => {
    if (!headerDisplayUrl) {
      setCoverImageHeaders(undefined);
      return;
    }
    void getIgdbImageRequestHeaders(headerDisplayUrl).then(setCoverImageHeaders);
  }, [headerDisplayUrl]);

  const startEditing = React.useCallback(() => {
    if (!game) return;
    const vc = game.valueCurrency === 'USD' || game.valueCurrency === 'EUR' ? game.valueCurrency : 'EUR';
    setForm({
      title: game.title ?? '',
      platform: game.platform ?? '',
      version: game.version ?? '',
      releaseYear: game.releaseYear?.toString() ?? '',
      genre: game.genre ?? '',
      developer: game.developer ?? '',
      publisher: game.publisher ?? '',
      barcode: game.barcode ?? '',
      coverUrl: game.coverUrl ?? '',
      headerImageUrl: game.headerImageUrl ?? '',
      description: game.description ?? '',
      valueAmount:
        game.valueCents != null && game.valueCurrency
          ? (game.valueCents / 100).toFixed(2)
          : '',
      valueCurrency: vc,
    });
    setEditing(true);
  }, [game]);

  const onSaveEdit = React.useCallback(async () => {
    if (!game) return;
    setSaving(true);
    try {
      let valueCents: number | null = game.valueCents ?? null;
      let valueCurrency: string | null = game.valueCurrency ?? null;
      let valueSource = game.valueSource ?? null;
      let valueUpdatedAt = game.valueUpdatedAt ?? null;
      const amountTrim = form.valueAmount.trim();
      if (amountTrim === '') {
        valueCents = null;
        valueCurrency = null;
        valueSource = null;
        valueUpdatedAt = null;
      } else {
        const parsed = parseMoneyInputToMinor(amountTrim);
        if (parsed != null) {
          valueCents = parsed;
          valueCurrency = form.valueCurrency;
          valueSource = 'manual';
          valueUpdatedAt = new Date().toISOString();
        }
      }
      await updateGameFull(game.id, {
        title: form.title.trim() || game.title,
        barcode: form.barcode.trim() || null,
        platform: form.platform.trim() || game.platform,
        version: form.version.trim() || null,
        releaseYear: form.releaseYear.trim() ? Number(form.releaseYear.trim()) : null,
        genre: form.genre.trim() || null,
        developer: form.developer.trim() || null,
        publisher: form.publisher.trim() || null,
        description: form.description.trim() || null,
        rating: game.rating,
        franchise: game.franchise,
        coverUrl: form.coverUrl.trim() || null,
        headerImageUrl: form.headerImageUrl.trim() || null,
        metadataStatus: game.metadataStatus,
        metadataSource: game.metadataSource,
        lastError: game.lastError,
        valueCents,
        valueCurrency,
        valueSource,
        valueUpdatedAt,
      });
      await loadGame();
      enqueueCoverThumbCache(game.id, form.coverUrl.trim() || null);
      setEditing(false);
    } catch {
      // silencioso
    } finally {
      setSaving(false);
    }
  }, [form, game, loadGame]);

  const onPriceFromPreferencesChain = React.useCallback(async () => {
    if (!game) return;
    const prefs = await loadValueSourcePreferences();
    const anyEnabled = prefs.order.some((id) => prefs.enabled[id]);
    if (!anyEnabled) {
      Alert.alert(
        'Valor',
        'Activa al menos una fuente en Ajustes → Catálogo → Orden de fuentes (valor en ficha).'
      );
      return;
    }
    setPriceBusy(true);
    try {
      const creds = await getApiCredentials();
      const res = await resolveValueEstimateFromPreferences({
        title: game.title,
        platform: game.platform,
        barcode: game.barcode,
        discOnly: game.discOnly === 1,
        creds,
        prefs,
      });
      if (!res) {
        Alert.alert(
          'Valor',
          'No se obtuvo precio con las fuentes activas. Si usas PriceCharting o eBay, revisa credenciales en Ajustes. GameplayStores solo cubre juegos que existan en la tienda con plataforma reconocida.'
        );
        return;
      }
      await updateGameValueEstimate(game.id, {
        valueCents: res.cents,
        valueCurrency: res.currency,
        valueSource: res.source,
        valueUpdatedAt: new Date().toISOString(),
      });
      await loadGame();
      const label = formatMoneyMinor(res.cents, res.currency);
      Alert.alert('Valor', `Guardado: ${label ?? ''}`);
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el valor.');
    } finally {
      setPriceBusy(false);
    }
  }, [game, loadGame]);

  const onRetry = React.useCallback(async () => {
    if (!game) return;
    setRetrying(true);
    try {
      const resolved = await resolveMetadata({
        barcode: game.barcode ?? undefined,
        titleHint: game.title,
        platformHint: game.platform,
        yearHint: game.releaseYear ?? undefined,
        fetchCovers: false,
      });
      const isGood = (v: string | null | undefined) =>
        !!v && !v.toLowerCase().includes('desconocida') && !v.toLowerCase().startsWith('juego ');
      const merged = {
        title: game.title,
        platform: isGood(resolved.platform) ? resolved.platform : game.platform,
        version: resolved.version ?? game.version,
        releaseYear: resolved.releaseYear ?? game.releaseYear,
        genre: resolved.genre ?? game.genre,
        developer: resolved.developer ?? game.developer,
        publisher: resolved.publisher ?? game.publisher,
        description: resolved.description ?? game.description,
        rating: resolved.rating ?? game.rating,
        franchise: resolved.franchise ?? game.franchise,
        coverUrl: game.coverUrl,
        headerImageUrl: game.headerImageUrl,
      };
      await updateGameMetadata(game.id, {
        ...merged,
        metadataStatus:
          resolved.status === 'error' ? game.metadataStatus : deriveMetadataStatusFromGameFields(merged),
        metadataSource: resolved.status !== 'error' ? resolved.source : game.metadataSource,
        lastError: resolved.status === 'error' ? (resolved.error ?? null) : null,
      });
      await loadGame();
      enqueueCoverThumbCache(game.id, game.coverUrl ?? null);

      if (resolved.status === 'error') {
        Alert.alert(
          'Ficha',
          resolved.error
            ? `No se pudo actualizar: ${resolved.error}`
            : 'No se pudo actualizar. Revisa título, plataforma o código de barras.'
        );
      } else {
        Alert.alert('Ficha', 'Datos de texto actualizados (portadas sin cambios).');
      }
    } catch {
      Alert.alert('Error', 'No se pudo completar la búsqueda de metadatos.');
    } finally {
      setRetrying(false);
    }
  }, [game, loadGame]);

  const onRefreshCoverOnly = React.useCallback(async () => {
    if (!game) return;
    setCoverRefreshing(true);
    try {
      const coverPrefs = await loadCoverSourcePreferences();
      const { url, source } = await resolvePreferredCoverWithSource(
        game.title,
        game.platform,
        null,
        coverPrefs
      );

      // La cabecera solo se descarga de IGDB si esa fuente está activa en preferencias
      // Y el usuario tiene credenciales configuradas. Si no, se usa la portada de catálogo
      // como cabecera (o se mantiene la existente si tampoco hay portada nueva).
      let nextHeader = game.headerImageUrl;
      let headerSource: string | null = null;

      const igdbEnabled = coverPrefs.enabled['igdb'] ?? false;
      if (igdbEnabled) {
        const creds = await getApiCredentials();
        if (creds.igdbClientId?.trim() && creds.igdbClientSecret?.trim()) {
          const igdb = await resolveFromIgdb({
            titleHint: game.title,
            platformHint: game.platform,
            yearHint: game.releaseYear ?? undefined,
          });
          if (igdb && igdb.status !== 'error' && igdb.headerImageUrl?.trim()) {
            nextHeader = igdb.headerImageUrl.trim();
            headerSource = 'IGDB';
          }
        }
      }

      // Si IGDB no aportó cabecera y hay una portada de catálogo nueva, usarla como cabecera
      if (nextHeader === game.headerImageUrl && url) {
        nextHeader = url;
        headerSource = source;
      }

      const merged = {
        title: game.title,
        platform: game.platform,
        version: game.version,
        releaseYear: game.releaseYear,
        genre: game.genre,
        developer: game.developer,
        publisher: game.publisher,
        description: game.description,
        rating: game.rating,
        franchise: game.franchise,
        coverUrl: url ?? game.coverUrl,
        headerImageUrl: nextHeader,
      };
      await updateGameMetadata(game.id, {
        ...merged,
        metadataStatus: deriveMetadataStatusFromGameFields(merged),
        metadataSource: game.metadataSource,
        lastError: game.lastError,
      });
      await loadGame();
      enqueueCoverThumbCache(game.id, url ?? game.coverUrl ?? null);

      if (await isFirstRunTourActive() && (await getFirstRunTourStep()) === 3) {
        await completeFirstRunTour();
        await refreshTour();
      }

      const headerCambiada = nextHeader !== game.headerImageUrl;
      if (!url && !headerCambiada) {
        Alert.alert('Portadas', 'No se encontró imagen de catálogo ni cabecera nueva.');
      } else {
        const lineas: string[] = [];
        if (url) lineas.push(`Catálogo: ${source ?? 'fuente desconocida'}.`);
        else lineas.push('Catálogo: sin cambios.');
        if (headerCambiada) lineas.push(`Cabecera: actualizada${headerSource ? ` (${headerSource})` : ''}.`);
        Alert.alert('Portadas', lineas.join('\n'));
      }
    } catch {
      Alert.alert('Error', 'No se pudo actualizar la portada.');
    } finally {
      setCoverRefreshing(false);
    }
  }, [game, loadGame, refreshTour]);

  const toggleFavorite = React.useCallback(async () => {
    if (!game) return;
    await setFavorite(game.id, game.favorite === 1 ? 0 : 1);
    await loadGame();
  }, [game, loadGame]);

  const toggleDiscOnly = React.useCallback(async () => {
    if (!game) return;
    await setDiscOnly(game.id, game.discOnly === 1 ? 0 : 1);
    await loadGame();
  }, [game, loadGame]);

  if (!game) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  const coverSourceLabel = inferCoverSourceLabel(game.coverUrl);
  const headerSourceLabel = inferCoverSourceLabel(game.headerImageUrl ?? null);

  const METADATA_SOURCE_DISPLAY: Record<string, string> = {
    cholloweb: 'CoverLens',
    igdb: 'IGDB',
    screenscraper: 'ScreenScraper',
    gameupc: 'GameUPC',
    gameplaystores: 'GameplayStores',
  };
  const metadataSourceDisplay = game.metadataSource
    ? (METADATA_SOURCE_DISPLAY[game.metadataSource.toLowerCase()] ?? game.metadataSource)
    : null;

  const showIgdbAttribution =
    headerSourceLabel === 'IGDB' ||
    coverSourceLabel === 'IGDB' ||
    game.metadataSource?.toLowerCase() === 'igdb';
  const showSteamGridAttribution =
    headerSourceLabel === 'SteamGridDB' || coverSourceLabel === 'SteamGridDB';
  const showGameUpcAttribution = game.metadataSource?.toLowerCase() === 'gameupc';

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* CABECERA: portada a pantalla completa de ancho */}
        <View style={styles.coverWrapper}>
          {headerDisplayUrl ? (
            <Image
              source={
                coverImageHeaders
                  ? { uri: headerDisplayUrl, headers: coverImageHeaders }
                  : { uri: headerDisplayUrl }
              }
              style={styles.coverImageFill}
              contentFit="cover"
              transition={400}
            />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Ionicons name="game-controller-outline" size={60} color="#333" />
              <Text style={styles.coverPlaceholderText}>SIN CARÁTULA</Text>
            </View>
          )}
          {/* Gradiente oscuro sobre la imagen */}
          <View style={styles.coverOverlay} />
          {/* Botón volver flotante sobre la imagen */}
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </Pressable>
          {/* Título sobre la imagen */}
          <View style={styles.coverMeta}>
            <Text style={styles.coverTitle} numberOfLines={2}>{game.title}</Text>
            <Text style={styles.coverPlatform}>{game.platform}</Text>
          </View>
        </View>

        {/* CUERPO */}
        <View style={styles.body}>

          {/* Estado + botón editar */}
          <View style={styles.topRow}>
            <View style={styles.statusBlock}>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[game.metadataStatus] ?? '#aaa' }]} />
                <Text style={styles.statusLabel}>{game.metadataStatus.toUpperCase()}</Text>
              </View>
              {metadataSourceDisplay ? (
                <Text style={styles.sourceLabel}>Ficha · {metadataSourceDisplay}</Text>
              ) : null}
              {game.headerImageUrl?.trim() && headerSourceLabel ? (
                <Text style={styles.sourceLabel}>Cabecera · {headerSourceLabel}</Text>
              ) : null}
              {coverSourceLabel ? (
                <Text style={styles.sourceLabel}>
                  {game.headerImageUrl?.trim() ? 'Catálogo · ' : 'Portada · '}
                  {coverSourceLabel}
                </Text>
              ) : null}
              {showIgdbAttribution ? (
                <TouchableOpacity onPress={() => void Linking.openURL(ATTRIBUTIONS.igdb.url)}>
                  <Text style={styles.attributionLabel}>{ATTRIBUTIONS.igdb.text}</Text>
                </TouchableOpacity>
              ) : null}
              {showSteamGridAttribution ? (
                <TouchableOpacity onPress={() => void Linking.openURL(ATTRIBUTIONS.steamGridDb.url)}>
                  <Text style={styles.attributionLabel}>{ATTRIBUTIONS.steamGridDb.text}</Text>
                </TouchableOpacity>
              ) : null}
              {showGameUpcAttribution ? (
                <TouchableOpacity onPress={() => void Linking.openURL(ATTRIBUTIONS.gameUpc.url)}>
                  <Text style={styles.attributionLabel}>{ATTRIBUTIONS.gameUpc.text}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {!editing ? (
              <TouchableOpacity onPress={startEditing} style={styles.editBtn} hitSlop={12}>
                <Ionicons name="pencil" size={16} color={theme.colors.primary} />
                <Text style={styles.editBtnText}>Editar</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.editActions}>
                <TouchableOpacity onPress={() => setEditing(false)} hitSlop={12}>
                  <Text style={styles.cancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={onSaveEdit}
                  style={[styles.saveBtn, saving && { opacity: 0.5 }]}
                  disabled={saving}
                  hitSlop={12}
                >
                  <Text style={styles.saveBtnText}>{saving ? '...' : 'Guardar'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {game.lastError ? <Text style={styles.errorText}>Error: {game.lastError}</Text> : null}

          {/* Campos */}
          <View style={styles.fieldGroup}>
            {editing ? (
              <>
                <EditField label="Titulo" value={form.title} onChange={(v) => setForm((f) => ({ ...f, title: v }))} />
                <EditField label="Plataforma" value={form.platform} onChange={(v) => setForm((f) => ({ ...f, platform: v }))} />
                <EditField label="Version" value={form.version} onChange={(v) => setForm((f) => ({ ...f, version: v }))} />
                <EditField label="Ano" value={form.releaseYear} keyboardType="numeric" onChange={(v) => setForm((f) => ({ ...f, releaseYear: v }))} />
                <EditField label="Genero" value={form.genre} onChange={(v) => setForm((f) => ({ ...f, genre: v }))} />
                <EditField label="Desarrollador" value={form.developer} onChange={(v) => setForm((f) => ({ ...f, developer: v }))} />
                <EditField label="Publisher" value={form.publisher ?? ''} onChange={(v) => setForm((f) => ({ ...f, publisher: v }))} />
                <EditField label="Barcode" value={form.barcode} keyboardType="numeric" onChange={(v) => setForm((f) => ({ ...f, barcode: v }))} />
                <EditField
                  label="URL portada (grid / vertical)"
                  value={form.coverUrl}
                  onChange={(v) => setForm((f) => ({ ...f, coverUrl: v }))}
                  multiline
                />
                <EditField
                  label="URL cabecera ficha (opcional, ancha)"
                  value={form.headerImageUrl}
                  onChange={(v) => setForm((f) => ({ ...f, headerImageUrl: v }))}
                  multiline
                />
                <EditField label="Descripcion" value={form.description ?? ''} onChange={(v) => setForm((f) => ({ ...f, description: v }))} multiline />
                <EditField
                  label="Valor estimado (opcional)"
                  value={form.valueAmount}
                  keyboardType="numeric"
                  onChange={(v) => setForm((f) => ({ ...f, valueAmount: v }))}
                />
                <Text style={styles.fieldLabel}>Moneda del valor manual</Text>
                <View style={styles.currencyRow}>
                  {(['EUR', 'USD'] as const).map((cur) => (
                    <TouchableOpacity
                      key={cur}
                      style={[styles.currencyChip, form.valueCurrency === cur && styles.currencyChipOn]}
                      onPress={() => setForm((f) => ({ ...f, valueCurrency: cur }))}
                    >
                      <Text style={[styles.currencyChipText, form.valueCurrency === cur && styles.currencyChipTextOn]}>
                        {cur}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : (
              <>
                <Field label="Ano" value={game.releaseYear?.toString()} />
                <Field label="Genero" value={game.genre} />
                <Field label="Desarrollador" value={game.developer} />
                <Field label="Publisher" value={game.publisher} />
                <Field label="Franquicia" value={game.franchise} />
                {game.rating != null && <Field label="Puntuacion" value={`${game.rating}/100`} />}
                <Field label="Barcode" value={game.barcode} />
                {game.description ? (
                  <View style={styles.descriptionBox}>
                    <Text style={styles.fieldLabel}>Descripcion</Text>
                    <Text style={styles.descriptionText}>{game.description}</Text>
                  </View>
                ) : null}
              </>
            )}
          </View>

          {!editing ? (
            <View style={styles.valueBox}>
              <Text style={styles.valueTitle}>Valor estimado</Text>
              <Text style={styles.valueBig}>
                {formatMoneyMinor(game.valueCents ?? null, game.valueCurrency ?? null) ?? '—'}
              </Text>
              {game.valueSource ? (
                <Text style={styles.valueHint}>
                  Fuente:{' '}
                  {game.valueSource === 'gameplaystores'
                    ? 'GameplayStores (precio en tienda, EUR)'
                    : game.valueSource === 'pricecharting'
                      ? 'PriceCharting (USD, guía)'
                      : game.valueSource === 'ebay'
                        ? 'eBay (anuncios activos)'
                        : 'Manual'}
                  {game.valueUpdatedAt ? ` · ${new Date(game.valueUpdatedAt).toLocaleDateString('es-ES')}` : ''}
                </Text>
              ) : (
                <Text style={styles.valueHint}>
                  Pulsa «Actualizar valor» usando el orden de Ajustes → Catálogo, o edita a mano.
                </Text>
              )}
              <TouchableOpacity
                style={[styles.valueBtn, styles.valueBtnWide, priceBusy && styles.valueBtnDisabled]}
                onPress={onPriceFromPreferencesChain}
                disabled={priceBusy}
                accessibilityRole="button"
                accessibilityLabel="Actualizar valor según preferencias"
              >
                <Text style={styles.valueBtnText}>{priceBusy ? 'Actualizando…' : 'Actualizar valor'}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Toggles */}
          <View style={styles.toggleRow}>
            <Pressable onPress={toggleFavorite} style={styles.toggleBtn}>
              <Ionicons
                name={game.favorite === 1 ? 'heart' : 'heart-outline'}
                size={20}
                color={game.favorite === 1 ? '#ff4268' : theme.colors.textDim}
              />
              <Text style={styles.toggleLabel}>Favorito</Text>
            </Pressable>
            <Pressable onPress={toggleDiscOnly} style={styles.toggleBtn}>
              <Ionicons
                name={game.discOnly === 1 ? 'disc' : 'disc-outline'}
                size={20}
                color={game.discOnly === 1 ? theme.colors.primary : theme.colors.textDim}
              />
              <Text style={styles.toggleLabel}>Solo disco</Text>
            </Pressable>
          </View>

          {/* Ficha (texto) / portadas (imágenes) */}
          {!editing && (
            <View style={styles.actionBtnRow}>
              <TouchableOpacity
                style={[styles.retryBtn, styles.retryBtnHalf, retrying && { opacity: 0.5 }]}
                onPress={onRetry}
                disabled={retrying || coverRefreshing}
              >
                <Ionicons name="library-outline" size={17} color="#fff" />
                <Text style={styles.retryBtnText} numberOfLines={2}>
                  {retrying ? 'Ficha…' : 'Actualizar ficha'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.retryBtn, styles.retryBtnHalf, styles.retryBtnAlt, coverRefreshing && { opacity: 0.5 }]}
                onPress={onRefreshCoverOnly}
                disabled={retrying || coverRefreshing}
              >
                <Ionicons name="image-outline" size={17} color="#fff" />
                <Text style={styles.retryBtnText} numberOfLines={2}>
                  {coverRefreshing ? 'Portadas…' : 'Actualizar portadas'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value || '—'}</Text>
    </View>
  );
}

function EditField({
  label, value, onChange, keyboardType = 'default', multiline = false,
}: {
  label: string; value: string; onChange: (v: string) => void;
  keyboardType?: 'default' | 'numeric'; multiline?: boolean;
}) {
  return (
    <View style={styles.editFieldWrapper}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        placeholderTextColor={theme.colors.textDim}
        placeholder={`Introduce ${label.toLowerCase()}...`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingBottom: 100 },
  loadingText: { color: theme.colors.textDim, marginTop: 100, textAlign: 'center' },

  // Cabecera con portada
  coverWrapper: {
    width: SCREEN_W,
    height: COVER_HEIGHT,
    backgroundColor: '#111',
    position: 'relative',
  },
  coverImage: { width: '100%', height: '100%' },
  /** Cabecera: posición absoluta para que cover rellene todo el banner. */
  coverImageFill: StyleSheet.absoluteFillObject,
  coverPlaceholder: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  coverPlaceholderText: { color: '#333', fontSize: 11, letterSpacing: 1, fontWeight: '700' },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  backBtn: {
    position: 'absolute',
    top: 52,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverMeta: {
    position: 'absolute',
    bottom: 14,
    left: 16,
    right: 16,
  },
  coverTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  coverPlatform: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // Cuerpo
  body: { paddingHorizontal: 16, paddingTop: 16 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 },
  statusBlock: { flex: 1, marginRight: 8, gap: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statusDot: { width: 9, height: 9, borderRadius: 5 },
  statusLabel: { color: theme.colors.textLight, fontWeight: '700', fontSize: 12 },
  sourceLabel: { color: theme.colors.textDim, fontSize: 11 },
  attributionLabel: {
    color: theme.colors.textDim,
    fontSize: 11,
    marginTop: 2,
    textDecorationLine: 'underline',
  },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8,
    borderWidth: 1, borderColor: theme.colors.primary,
  },
  editBtnText: { color: theme.colors.primary, fontSize: 13, fontWeight: '600' },
  editActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  cancelText: { color: theme.colors.textDim, fontSize: 13 },
  saveBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 5, paddingHorizontal: 12, borderRadius: 8,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  errorText: { color: '#ff6b6b', fontSize: 11, marginBottom: 8 },
  fieldGroup: { gap: 10, marginTop: 8 },
  field: {
    flexDirection: 'row', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: '#1e1e1e', paddingBottom: 8,
  },
  fieldLabel: { color: theme.colors.textDim, fontSize: 13, flex: 1 },
  fieldValue: { color: theme.colors.textLight, fontSize: 13, flex: 2, textAlign: 'right' },
  editFieldWrapper: { gap: 4 },
  input: {
    backgroundColor: '#1a1a1a', color: theme.colors.textLight,
    borderWidth: 1, borderColor: '#333', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 9, fontSize: 13,
  },
  inputMultiline: { height: 75, textAlignVertical: 'top' },
  toggleRow: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 16 },
  toggleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 9, paddingHorizontal: 13, borderRadius: 10,
    backgroundColor: '#111', borderWidth: 1, borderColor: '#2a2a2a',
  },
  toggleLabel: { color: theme.colors.textLight, fontSize: 13 },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#0044cc', borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 12,
  },
  retryBtnHalf: { flex: 1, minHeight: 52 },
  retryBtnAlt: { backgroundColor: '#1a4d7a' },
  retryBtnText: { color: '#fff', fontSize: 12, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
  descriptionBox: { paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#1e1e1e' },
  descriptionText: { color: theme.colors.textLight, fontSize: 13, lineHeight: 20, marginTop: 4 },
  currencyRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  currencyChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#141414',
  },
  currencyChipOn: { borderColor: theme.colors.primary, backgroundColor: 'rgba(0,127,255,0.12)' },
  currencyChipText: { color: theme.colors.textDim, fontWeight: '600', fontSize: 13 },
  currencyChipTextOn: { color: theme.colors.primary },
  valueBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#252525',
    gap: 8,
  },
  valueTitle: { color: theme.colors.textDim, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  valueBig: { color: '#9acd32', fontSize: 22, fontWeight: '800' },
  valueHint: { color: theme.colors.textDim, fontSize: 11, lineHeight: 16 },
  valueActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  valueBtn: {
    flex: 1,
    backgroundColor: '#1a3a1a',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2d5a2d',
  },
  valueBtnWide: { alignSelf: 'stretch', flex: 0, marginTop: 4 },
  valueBtnAlt: { backgroundColor: '#1a2740', borderColor: '#2d4466' },
  valueBtnDisabled: { opacity: 0.5 },
  valueBtnText: { color: theme.colors.textLight, fontSize: 13, fontWeight: '700' },
});
