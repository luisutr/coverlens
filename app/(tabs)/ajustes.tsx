import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFirstRunTour } from '../../contexts/FirstRunTourContext';
import { theme } from '../../constants/theme';
import {
  GameRecord,
  deleteAllGames,
  exportCatalogAsJson,
  getGames,
  importCatalogRows,
  initDatabase,
  removeDuplicatedBarcodes,
  updateGameMetadata,
} from '../../database/dbConfig';
import {
  ApiCredentials,
  clearApiCredentials,
  getApiCredentials,
  providerLinks,
  saveApiCredentials,
} from '../../services/credentialsStore';
import {
  buildEbaySearchQueries,
  ebayUsesSandbox,
  fetchEbayApplicationToken,
} from '../../services/ebayPriceProvider';
import { resolvePreferredCoverUrl } from '../../services/coverPreferenceResolver';
import {
  COVER_PROVIDER_LABELS,
  DEFAULT_COVER_SOURCE_PREFERENCES,
  loadCoverSourcePreferences,
  moveCoverProvider,
  saveCoverSourcePreferences,
  type CoverSourcePreferences,
} from '../../services/coverSourcePreferences';
import {
  DEFAULT_METADATA_SOURCE_PREFERENCES,
  METADATA_PROVIDER_LABELS,
  loadMetadataSourcePreferences,
  moveMetadataProvider,
  saveMetadataSourcePreferences,
  type MetadataSourcePreferences,
} from '../../services/metadataSourcePreferences';
import {
  DEFAULT_VALUE_SOURCE_PREFERENCES,
  VALUE_PROVIDER_LABELS,
  loadValueSourcePreferences,
  moveValueProvider,
  saveValueSourcePreferences,
  type ValueSourcePreferences,
} from '../../services/valueSourcePreferences';
import { deriveMetadataStatusFromGameFields } from '../../services/utils/metadataCompleteness';
import { resolveMetadata } from '../../services/metadataResolver';
import { parseCatalogImport } from '../../services/import/catalogImport';
import { invalidateIgdbImageCredentialsCache } from '../../services/igdbImageRequest';
import {
  enqueueCoverThumbCache,
  scheduleCoverThumbCache,
} from '../../services/storage/coverThumbCache';
import { fetchPriceChartingProduct } from '../../services/pricechartingProvider';
import { runCoverSourcesProbeLogLines } from '../../services/coverSourceProbe';
import { setOnboardingDone } from '../../services/onboardingState';

const IMPORT_HELP_INVALID_FILE =
  'CoverLens solo importa:\n\n' +
  '• JSON generado con «Exportar catálogo» en esta app (copia de seguridad o cambio de móvil).\n\n' +
  '• CSV creado en Playnite con la extensión «Library Exporter Advanced». En el CSV deben existir las columnas «Nombre» y «Plataformas» (el resto de columnas es opcional; no hace falta exportar todos los campos de Playnite).\n\n' +
  'No sirve el backup .zip de Playnite ni hojas de cálculo al azar. Si importaste CSV desde Playnite, después usa «Reintentar metadatos» para completar fichas según el orden de fuentes en Catálogo (GameplayStores, IGDB, etc.).';

// ─── Componentes auxiliares ───────────────────────────────────────────────────

function SectionHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon as any} size={18} color={theme.colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>
    </View>
  );
}

function ActionRow({
  icon,
  label,
  hint,
  onPress,
  loading,
  danger,
}: {
  icon: string;
  label: string;
  hint?: string;
  onPress: () => void;
  loading?: boolean;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionRow, danger && styles.actionRowDanger]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!loading, busy: !!loading }}
    >
      <View style={styles.actionRowLeft}>
        <Ionicons
          name={icon as any}
          size={20}
          color={danger ? '#e74c3c' : theme.colors.primary}
          style={{ width: 24 }}
        />
        <View>
          <Text style={[styles.actionLabel, danger && styles.actionLabelDanger]}>{label}</Text>
          {hint && <Text style={styles.actionHint}>{hint}</Text>}
        </View>
      </View>
      {loading ? (
        <ActivityIndicator color={theme.colors.primary} size="small" />
      ) : (
        <Ionicons name="chevron-forward" size={16} color={danger ? '#e74c3c' : theme.colors.textDim} />
      )}
    </TouchableOpacity>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function AjustesScreen() {
  const router = useRouter();
  const { restartTour } = useFirstRunTour();
  const [form, setForm] = React.useState<ApiCredentials>({
    screenScraperUsername: '',
    screenScraperPassword: '',
    screenScraperDevId: '',
    screenScraperDevPassword: '',
    steamGridDbApiKey: '',
    igdbClientId: '',
    igdbClientSecret: '',
    priceChartingToken: '',
    ebayClientId: '',
    ebayClientSecret: '',
    ebayMarketplaceId: 'EBAY_ES',
  });
  const [saving, setSaving] = React.useState(false);
  const [diagLog, setDiagLog] = React.useState<string[]>([]);
  const [diagRunning, setDiagRunning] = React.useState(false);
  const [coverProbeRunning, setCoverProbeRunning] = React.useState(false);
  const [coverDlRunning, setCoverDlRunning] = React.useState(false);
  const [coverDlProgress, setCoverDlProgress] = React.useState('');
  const [retryRunning, setRetryRunning] = React.useState(false);
  const [retryProgress, setRetryProgress] = React.useState('');
  const [importRunning, setImportRunning] = React.useState(false);
  const [importProgress, setImportProgress] = React.useState('');
  const [catalogGuideOpen, setCatalogGuideOpen] = React.useState(false);
  const [apisMetadataOpen, setApisMetadataOpen] = React.useState(false);
  const [gameCount, setGameCount] = React.useState(0);
  const [coverPrefs, setCoverPrefs] = React.useState<CoverSourcePreferences>(() => ({
    order: [...DEFAULT_COVER_SOURCE_PREFERENCES.order],
    enabled: { ...DEFAULT_COVER_SOURCE_PREFERENCES.enabled },
  }));
  const [valuePrefs, setValuePrefs] = React.useState<ValueSourcePreferences>(() => ({
    order: [...DEFAULT_VALUE_SOURCE_PREFERENCES.order],
    enabled: { ...DEFAULT_VALUE_SOURCE_PREFERENCES.enabled },
  }));
  const [metadataPrefs, setMetadataPrefs] = React.useState<MetadataSourcePreferences>(() => ({
    order: [...DEFAULT_METADATA_SOURCE_PREFERENCES.order],
    enabled: { ...DEFAULT_METADATA_SOURCE_PREFERENCES.enabled },
  }));

  const persistCoverPrefs = React.useCallback(async (next: CoverSourcePreferences) => {
    setCoverPrefs(next);
    await saveCoverSourcePreferences(next);
  }, []);

  const persistValuePrefs = React.useCallback(async (next: ValueSourcePreferences) => {
    setValuePrefs(next);
    await saveValueSourcePreferences(next);
  }, []);

  const persistMetadataPrefs = React.useCallback(async (next: MetadataSourcePreferences) => {
    setMetadataPrefs(next);
    await saveMetadataSourcePreferences(next);
  }, []);

  React.useEffect(() => {
    getApiCredentials().then(setForm).catch(() => {});
    initDatabase()
      .then(() => getGames())
      .then((gs) => setGameCount(gs.length))
      .catch(() => {});
    loadCoverSourcePreferences().then(setCoverPrefs).catch(() => {});
    loadMetadataSourcePreferences().then(setMetadataPrefs).catch(() => {});
    loadValueSourcePreferences().then(setValuePrefs).catch(() => {});
  }, []);

  // ── Catálogo ────────────────────────────────────────────────────────────────

  const onRetryMetadata = React.useCallback(async () => {
    Alert.alert(
      'Reintentar metadatos',
      'Se intentará completar solo datos de texto (género, año, etc.) en juegos no resueltos. No cambia portadas ni cabeceras. ¿Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reintentar',
          onPress: async () => {
            setRetryRunning(true);
            setRetryProgress('Cargando catálogo...');
            try {
              await initDatabase();
              const games: GameRecord[] = await getGames();
              const pending = games.filter((g) => g.metadataStatus !== 'resolved');
              if (pending.length === 0) {
                Alert.alert('Sin pendientes', 'Todos los juegos tienen metadatos completos.');
                return;
              }

              const statusRank: Record<GameRecord['metadataStatus'], number> = {
                error: 0,
                pending: 1,
                partial: 2,
                resolved: 3,
              };
              const isUnknown = (v: string | null | undefined) =>
                !v || v.trim() === '' || v.toLowerCase().includes('desconocida') || v.toLowerCase().startsWith('juego ');

              let done = 0;
              for (const game of pending) {
                done++;
                setRetryProgress(`Procesando ${done}/${pending.length}: ${game.title}`);
                const resolved = await resolveMetadata({
                  barcode: game.barcode ?? undefined,
                  titleHint: game.title,
                  platformHint: game.platform,
                  yearHint: game.releaseYear ?? undefined,
                  fetchCovers: false,
                });
                const upgrade = statusRank[resolved.status] >= statusRank[game.metadataStatus];

                const merged = {
                  title: game.title,
                  platform: upgrade && !isUnknown(resolved.platform) ? resolved.platform : game.platform,
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
                  metadataStatus: deriveMetadataStatusFromGameFields(merged),
                  metadataSource: upgrade ? resolved.source : game.metadataSource,
                  lastError: resolved.status === 'error' ? (resolved.error ?? game.lastError) : null,
                });
                enqueueCoverThumbCache(game.id, game.coverUrl ?? null);
              }
              setRetryProgress('');
              Alert.alert(
                'Listo',
                `Se procesaron ${pending.length} juego(s). Los nombres guardados no se han modificado.`
              );
            } catch {
              Alert.alert('Error', 'No se pudo completar el reintento.');
            } finally {
              setRetryRunning(false);
              setRetryProgress('');
              getGames().then((gs) => setGameCount(gs.length)).catch(() => {});
            }
          },
        },
      ]
    );
  }, []);

  const COVER_BATCH_DELAY_MS = 120;

  const onDownloadCoverBatch = React.useCallback(() => {
    Alert.alert(
      'Descargar portadas en lote',
      'Para cada juego: si ya tiene URL de carátula, descarga la miniatura; si no, intenta obtenerla con el orden de fuentes que configuraste abajo (igual que «Actualizar portadas» en la ficha). Colecciones grandes tardan. ¿Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Descargar',
          onPress: () => {
            void (async () => {
              setCoverDlRunning(true);
              setCoverDlProgress('Preparando…');
              try {
                await initDatabase();
                const coverPrefsBatch = await loadCoverSourcePreferences();
                const all = await getGames();
                const targets = all.filter((g) => {
                  const http = g.coverUrl?.trim().match(/^https?:\/\//i);
                  return http || (g.title?.trim().length ?? 0) > 0;
                });
                if (targets.length === 0) {
                  Alert.alert(
                    'Nada que procesar',
                    'No hay juegos con título ni URL de carátula. Añade al menos el nombre del juego.'
                  );
                  return;
                }
                let i = 0;
                for (const g of targets) {
                  i++;
                  setCoverDlProgress(`${i}/${targets.length}: ${g.title}`);
                  let url: string | null = g.coverUrl?.trim().match(/^https?:\/\//i) ? g.coverUrl!.trim() : null;
                  if (!url && g.title?.trim()) {
                    url = await resolvePreferredCoverUrl(g.title, g.platform, null, coverPrefsBatch);
                  }
                  const coverToStore = (url ?? g.coverUrl)?.trim() || null;
                  await updateGameMetadata(g.id, {
                    title: g.title,
                    platform: g.platform,
                    version: g.version,
                    releaseYear: g.releaseYear,
                    genre: g.genre,
                    developer: g.developer,
                    publisher: g.publisher,
                    description: g.description,
                    rating: g.rating,
                    franchise: g.franchise,
                    coverUrl: coverToStore,
                    headerImageUrl: g.headerImageUrl,
                    metadataStatus: deriveMetadataStatusFromGameFields({
                      title: g.title,
                      platform: g.platform,
                      coverUrl: coverToStore,
                      releaseYear: g.releaseYear,
                      genre: g.genre,
                      developer: g.developer,
                      publisher: g.publisher,
                      description: g.description,
                    }),
                    metadataSource: g.metadataSource,
                    lastError: g.lastError,
                  });
                  if (coverToStore) {
                    await scheduleCoverThumbCache(g.id, coverToStore);
                  }
                  if (i < targets.length) {
                    await new Promise((r) => setTimeout(r, COVER_BATCH_DELAY_MS));
                  }
                }
                Alert.alert('Hecho', `Procesados ${targets.length} juego(s) (búsqueda de URL si faltaba + miniatura en disco).`);
              } catch {
                Alert.alert('Error', 'No se completó la descarga en lote.');
              } finally {
                setCoverDlRunning(false);
                setCoverDlProgress('');
              }
            })();
          },
        },
      ]
    );
  }, []);

  const onCleanDuplicates = React.useCallback(() => {
    Alert.alert(
      'Limpiar duplicados',
      '¿Eliminar juegos duplicados por código de barras? Se conservará el primero de cada barcode.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpiar',
          style: 'destructive',
          onPress: () => {
            removeDuplicatedBarcodes()
              .then(() => getGames())
              .then((gs) => {
                setGameCount(gs.length);
                Alert.alert('Hecho', 'Duplicados eliminados.');
              })
              .catch(() => Alert.alert('Error', 'No se pudieron eliminar duplicados.'));
          },
        },
      ]
    );
  }, []);

  const onExport = React.useCallback(async () => {
    try {
      const result = await exportCatalogAsJson();
      if (!result.shared) {
        Alert.alert('Exportado', `Archivo generado en:\n${result.fileUri}`);
      }
    } catch {
      Alert.alert('Error', 'No se pudo exportar el catálogo.');
    }
  }, []);

  const onImportCatalog = React.useCallback(() => {
    void (async () => {
      try {
        const pick = await DocumentPicker.getDocumentAsync({
          type: ['application/json', 'text/plain', 'text/csv', 'text/comma-separated-values', '*/*'],
          copyToCacheDirectory: true,
        });
        if (pick.canceled || !pick.assets?.[0]?.uri) return;

        setImportRunning(true);
        setImportProgress('Leyendo archivo…');

        const text = await FileSystem.readAsStringAsync(pick.assets[0].uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        setImportProgress('Analizando contenido…');
        const parsed = parseCatalogImport(text);

        if (parsed.rows.length === 0) {
          setImportProgress('');
          setImportRunning(false);
          const head =
            parsed.notes.length > 0
              ? `${parsed.notes.join('\n')}\n\n`
              : 'No se encontraron juegos válidos en el archivo (revisa cabeceras y contenido).\n\n';
          Alert.alert('Archivo no importable', head + IMPORT_HELP_INVALID_FILE);
          return;
        }

        const originLabel =
          parsed.source === 'coverlens'
            ? 'JSON CoverLens'
            : parsed.source === 'playnite_csv'
              ? 'CSV Playnite (Library Exporter Advanced)'
              : parsed.source === 'playnite'
                ? 'JSON tipo Playnite'
                : 'JSON genérico';
        const noteExtra = parsed.notes.length > 0 ? `\n\n${parsed.notes.join('\n')}` : '';

        setImportProgress('');
        setImportRunning(false);

        Alert.alert(
          'Importar catálogo',
          `Origen detectado: ${originLabel}\nJuegos a importar: ${parsed.rows.length}.${noteExtra}\n\n` +
            'Se omitirán duplicados (mismo título y plataforma, o mismo código de barras). ¿Continuar?',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Importar',
              onPress: () => {
                void (async () => {
                  setImportRunning(true);
                  setImportProgress(`Importando 0 / ${parsed.rows.length}…`);
                  try {
                    await initDatabase();
                    const res = await importCatalogRows(parsed.rows, {
                      skipDuplicates: true,
                      onProgress: (done, total) => {
                        setImportProgress(`Importando ${done} / ${total}…`);
                      },
                    });
                    for (const t of res.newThumbnails) {
                      enqueueCoverThumbCache(t.id, t.coverUrl);
                    }
                    const gs = await getGames();
                    setGameCount(gs.length);
                    Alert.alert(
                      'Importación terminada',
                      `Importados: ${res.imported}\nOmitidos (duplicado): ${res.skippedDuplicates}\nFilas inválidas: ${res.skippedInvalid}`
                    );
                  } catch {
                    Alert.alert('Error', 'No se pudo completar la importación.');
                  } finally {
                    setImportProgress('');
                    setImportRunning(false);
                  }
                })();
              },
            },
          ]
        );
      } catch (e) {
        setImportProgress('');
        setImportRunning(false);
        const msg = e instanceof Error ? e.message : String(e);
        const isJsonErr = msg.toLowerCase().includes('json');
        Alert.alert(
          'No se pudo leer el archivo',
          (isJsonErr ? `${msg}\n\n` : 'Comprueba que sea un .json de CoverLens o un .csv de Playnite.\n\n') +
            IMPORT_HELP_INVALID_FILE
        );
      }
    })();
  }, []);

  // ── APIs ────────────────────────────────────────────────────────────────────

  const onSave = React.useCallback(async () => {
    setSaving(true);
    try {
      await saveApiCredentials(form);
      invalidateIgdbImageCredentialsCache();
      Alert.alert('Guardado', 'Credenciales guardadas correctamente.');
    } catch {
      Alert.alert('Error', 'No se pudo guardar la configuración.');
    } finally {
      setSaving(false);
    }
  }, [form]);

  const onEmptyCatalog = React.useCallback(() => {
    Alert.alert(
      'Vaciar catálogo',
      'Se borrarán todos los juegos de este dispositivo (títulos, metadatos y miniaturas guardadas). Las credenciales de Ajustes no se tocan. No hay vuelta atrás.\n\n¿Quieres continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Última confirmación',
              '¿Eliminar por completo el catálogo? Exporta una copia antes si la necesitas.',
              [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Vaciar catálogo',
                  style: 'destructive',
                  onPress: () => {
                    void (async () => {
                      try {
                        await initDatabase();
                        const n = await deleteAllGames();
                        setGameCount(0);
                        Alert.alert('Hecho', n > 0 ? `Se eliminaron ${n} juego(s).` : 'El catálogo ya estaba vacío.');
                      } catch {
                        Alert.alert('Error', 'No se pudo vaciar el catálogo.');
                      }
                    })();
                  },
                },
              ]
            );
          },
        },
      ]
    );
  }, []);

  const onClear = React.useCallback(() => {
    Alert.alert('Limpiar credenciales', '¿Eliminar todas las credenciales guardadas?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Limpiar',
        style: 'destructive',
        onPress: async () => {
          await clearApiCredentials();
          invalidateIgdbImageCredentialsCache();
          setForm({
            screenScraperUsername: '',
            screenScraperPassword: '',
            screenScraperDevId: '',
            screenScraperDevPassword: '',
            steamGridDbApiKey: '',
            igdbClientId: '',
            igdbClientSecret: '',
            priceChartingToken: '',
            ebayClientId: '',
            ebayClientSecret: '',
            ebayMarketplaceId: 'EBAY_ES',
          });
          Alert.alert('Listo', 'Credenciales eliminadas.');
        },
      },
    ]);
  }, []);

  const onReplayOnboarding = React.useCallback(() => {
    Alert.alert(
      'Repetir configuración inicial',
      'Se abrirá la guía inicial para volver a rellenar los campos importantes. Puedes ajustar cualquier dato allí y se guardará en Ajustes.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Abrir guía',
          onPress: async () => {
            await setOnboardingDone(false);
            router.replace('/onboarding');
          },
        },
      ]
    );
  }, [router]);

  const onReplayFirstRunTour = React.useCallback(() => {
    Alert.alert(
      'Guía práctica (escáner)',
      'Te mostraremos de nuevo los pasos: Escaner → código de barras → abrir juego → actualizar portadas.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Empezar',
          onPress: async () => {
            await restartTour();
            router.replace('/(tabs)/escaner');
          },
        },
      ]
    );
  }, [restartTour, router]);

  const appendLog = React.useCallback((msg: string) => {
    setDiagLog((prev) => [...prev, msg]);
  }, []);

  const onDiagnostic = React.useCallback(async () => {
    setDiagLog([]);
    setDiagRunning(true);
    try {
      await saveApiCredentials(form);
      invalidateIgdbImageCredentialsCache();
      appendLog('── Diagnóstico ──');
      appendLog(`IGDB Client ID: ${form.igdbClientId || '(vacío)'}`);
      appendLog(`IGDB Secret: ${form.igdbClientSecret ? '***' : '(vacío)'}`);
      appendLog(`ScreenScraper: ${form.screenScraperUsername || '(vacío)'}`);
      appendLog('');

      if (form.igdbClientId && form.igdbClientSecret) {
        appendLog('TEST IGDB — obteniendo token...');
        try {
          const tokenRes = await fetch(
            `https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(form.igdbClientId)}&client_secret=${encodeURIComponent(form.igdbClientSecret)}&grant_type=client_credentials`,
            { method: 'POST' }
          );
          appendLog(`  Token HTTP ${tokenRes.status}`);
          if (tokenRes.ok) {
            const tokenData = (await tokenRes.json()) as { access_token: string };
            appendLog('  Token OK. Buscando "Gears of War"...');
            const searchRes = await fetch('https://api.igdb.com/v4/games', {
              method: 'POST',
              headers: {
                'Client-ID': form.igdbClientId,
                Authorization: `Bearer ${tokenData.access_token}`,
                'Content-Type': 'text/plain',
              },
              body: 'search "gears of war"; fields name,platforms.name; limit 5;',
            });
            appendLog(`  Búsqueda HTTP ${searchRes.status}`);
            const games = (await searchRes.json()) as { name?: string }[];
            if (Array.isArray(games) && games.length > 0) {
              appendLog(`  Resultados: ${games.map((g) => g.name).join(', ')}`);
              appendLog('  ✓ IGDB funciona correctamente');
            } else {
              appendLog(`  Respuesta: ${JSON.stringify(games).slice(0, 200)}`);
            }
          } else {
            appendLog(`  Error: ${(await tokenRes.text()).slice(0, 200)}`);
          }
        } catch (e) {
          appendLog(`  Error de red: ${String(e).slice(0, 100)}`);
        }
      } else {
        appendLog('IGDB: sin credenciales configuradas.');
      }

      appendLog('');
      if (form.priceChartingToken.trim()) {
        appendLog('TEST PriceCharting (búsqueda "mario 64")...');
        try {
          const pc = await fetchPriceChartingProduct(form.priceChartingToken, { query: 'mario 64' });
          if (pc && (pc.cibCents != null || pc.looseCents != null)) {
            appendLog(`  OK — ${pc.productName ?? '?'} / ${pc.consoleName ?? '?'}`);
          } else {
            appendLog('  Sin datos o token inválido');
          }
        } catch (e) {
          appendLog(`  Error: ${String(e).slice(0, 120)}`);
        }
      } else {
        appendLog('PriceCharting: sin token.');
      }

      appendLog('');
      if (form.ebayClientId.trim() && form.ebayClientSecret.trim()) {
        appendLog('TEST eBay — token de aplicación...');
        appendLog(
          ebayUsesSandbox(form.ebayClientId)
            ? '  Entorno: sandbox → api.sandbox.ebay.com'
            : '  Entorno: producción → api.ebay.com'
        );
        try {
          const ebayTok = await fetchEbayApplicationToken(form.ebayClientId, form.ebayClientSecret);
          if (ebayTok) {
            appendLog('  Token OK (Browse API)');
            const demo = buildEbaySearchQueries('The Legend of Zelda', 'Switch');
            appendLog(`  Ejemplo variantes de búsqueda: ${demo.slice(0, 5).join(' · ')}`);
          } else {
            appendLog('  No se pudo obtener token (revisa ID/Secret del mismo keyset)');
          }
        } catch (e) {
          appendLog(`  Error: ${String(e).slice(0, 120)}`);
        }
      } else {
        appendLog('eBay: sin Client ID / Secret.');
      }

      appendLog('');
      if (form.screenScraperUsername && form.screenScraperPassword) {
        appendLog('TEST ScreenScraper...');
        const params = new URLSearchParams({
          output: 'json', softname: 'CoverLens',
          ssid: form.screenScraperUsername, sspassword: form.screenScraperPassword,
        });
        if (form.screenScraperDevId) params.set('devid', form.screenScraperDevId);
        if (form.screenScraperDevPassword) params.set('devpassword', form.screenScraperDevPassword);
        try {
          const r = await fetch(`https://www.screenscraper.fr/api2/jeuRecherche.php?${params.toString()}&recherche=gears+of+war`);
          appendLog(`  HTTP ${r.status}: ${(await r.text()).slice(0, 150)}`);
        } catch (e) {
          appendLog(`  Error: ${String(e).slice(0, 100)}`);
        }
      }

      appendLog('');
      appendLog('── Fin del diagnóstico ──');
    } finally {
      setDiagRunning(false);
    }
  }, [form, appendLog]);

  const onCoverSourcesProbe = React.useCallback(async () => {
    setDiagLog([]);
    setCoverProbeRunning(true);
    try {
      await saveApiCredentials(form);
      invalidateIgdbImageCredentialsCache();
      const lines = await runCoverSourcesProbeLogLines();
      setDiagLog(lines);
    } catch (e) {
      setDiagLog([`Error: ${String(e).slice(0, 200)}`]);
    } finally {
      setCoverProbeRunning(false);
    }
  }, [form]);

  // ── Campo de formulario ─────────────────────────────────────────────────────

  const field = (label: string, key: keyof ApiCredentials, placeholder: string, secure = false) => (
    <View key={key}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={form[key]}
        onChangeText={(v) => setForm((p) => ({ ...p, [key]: v }))}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry={secure}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textDim}
      />
    </View>
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>Ajustes</Text>

      {/* ── Sección 1: Catálogo ─────────────────────────────────────────────── */}
      <View style={styles.section}>
        <SectionHeader
          icon="library-outline"
          title="Catálogo"
          subtitle={`${gameCount} juego${gameCount !== 1 ? 's' : ''} en la colección`}
        />
        <View style={styles.divider} />

        <View style={styles.coverPrefSection}>
          <Text style={styles.coverPrefSectionTitle}>Orden de fuentes (portadas)</Text>
          <Text style={styles.coverPrefSectionHint}>
            Misma cadena que «Actualizar portadas» en la ficha y «Descargar portadas en lote». Arriba se prueba antes;
            desactiva fuentes que no quieras usar.
          </Text>
          {coverPrefs.order.map((id, index) => (
            <View key={id} style={styles.coverPrefRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.coverPrefLabel}>{COVER_PROVIDER_LABELS[id]}</Text>
              </View>
              <View style={styles.coverPrefControls}>
                <TouchableOpacity
                  onPress={() => void persistCoverPrefs(moveCoverProvider(coverPrefs, id, 'up'))}
                  disabled={index === 0}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Subir ${COVER_PROVIDER_LABELS[id]}`}
                >
                  <Ionicons
                    name="chevron-up"
                    size={22}
                    color={index === 0 ? '#333' : theme.colors.primary}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => void persistCoverPrefs(moveCoverProvider(coverPrefs, id, 'down'))}
                  disabled={index === coverPrefs.order.length - 1}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Bajar ${COVER_PROVIDER_LABELS[id]}`}
                >
                  <Ionicons
                    name="chevron-down"
                    size={22}
                    color={index === coverPrefs.order.length - 1 ? '#333' : theme.colors.primary}
                  />
                </TouchableOpacity>
                <Switch
                  value={coverPrefs.enabled[id]}
                  onValueChange={(v) =>
                    void persistCoverPrefs({
                      ...coverPrefs,
                      enabled: { ...coverPrefs.enabled, [id]: v },
                    })
                  }
                  trackColor={{ false: '#333', true: 'rgba(0,127,255,0.35)' }}
                  thumbColor={coverPrefs.enabled[id] ? theme.colors.primary : '#888'}
                  accessibilityLabel={`Fuente ${COVER_PROVIDER_LABELS[id]}`}
                />
              </View>
            </View>
          ))}
        </View>

        <View style={styles.coverPrefSection}>
          <Text style={styles.coverPrefSectionTitle}>Orden de fuentes (metadatos de ficha)</Text>
          <Text style={styles.coverPrefSectionHint}>
            Escáner, búsqueda manual y «Completar metadatos» prueban cada fuente activa en este orden. Las primeras tienen
            prioridad si hay conflicto (p. ej. título y plataforma); las siguientes solo rellenan datos que falten.
            GameplayStores no requiere clave. IGDB y ScreenScraper son opcionales: puedes desactivarlos si no quieres
            usarlos o no tienes credenciales.
          </Text>
          {metadataPrefs.order.map((id, index) => (
            <View key={id} style={styles.coverPrefRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.coverPrefLabel}>{METADATA_PROVIDER_LABELS[id]}</Text>
              </View>
              <View style={styles.coverPrefControls}>
                <TouchableOpacity
                  onPress={() => void persistMetadataPrefs(moveMetadataProvider(metadataPrefs, id, 'up'))}
                  disabled={index === 0}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Subir ${METADATA_PROVIDER_LABELS[id]}`}
                >
                  <Ionicons
                    name="chevron-up"
                    size={22}
                    color={index === 0 ? '#333' : theme.colors.primary}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => void persistMetadataPrefs(moveMetadataProvider(metadataPrefs, id, 'down'))}
                  disabled={index === metadataPrefs.order.length - 1}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Bajar ${METADATA_PROVIDER_LABELS[id]}`}
                >
                  <Ionicons
                    name="chevron-down"
                    size={22}
                    color={index === metadataPrefs.order.length - 1 ? '#333' : theme.colors.primary}
                  />
                </TouchableOpacity>
                <Switch
                  value={metadataPrefs.enabled[id]}
                  onValueChange={(v) =>
                    void persistMetadataPrefs({
                      ...metadataPrefs,
                      enabled: { ...metadataPrefs.enabled, [id]: v },
                    })
                  }
                  trackColor={{ false: '#333', true: 'rgba(0,127,255,0.35)' }}
                  thumbColor={metadataPrefs.enabled[id] ? theme.colors.primary : '#888'}
                  accessibilityLabel={`Metadatos: ${METADATA_PROVIDER_LABELS[id]}`}
                />
              </View>
            </View>
          ))}
        </View>

        <View style={styles.coverPrefSection}>
          <Text style={styles.coverPrefSectionTitle}>Orden de fuentes (valor en ficha)</Text>
          <Text style={styles.coverPrefSectionHint}>
            «Actualizar valor» en la ficha del juego prueba cada fuente activa en este orden. GameplayStores no requiere
            clave (precio en tienda, EUR). PriceCharting y eBay usan las credenciales de abajo si están activas y
            configuradas.
          </Text>
          {valuePrefs.order.map((id, index) => (
            <View key={id} style={styles.coverPrefRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.coverPrefLabel}>{VALUE_PROVIDER_LABELS[id]}</Text>
              </View>
              <View style={styles.coverPrefControls}>
                <TouchableOpacity
                  onPress={() => void persistValuePrefs(moveValueProvider(valuePrefs, id, 'up'))}
                  disabled={index === 0}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Subir ${VALUE_PROVIDER_LABELS[id]}`}
                >
                  <Ionicons
                    name="chevron-up"
                    size={22}
                    color={index === 0 ? '#333' : theme.colors.primary}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => void persistValuePrefs(moveValueProvider(valuePrefs, id, 'down'))}
                  disabled={index === valuePrefs.order.length - 1}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Bajar ${VALUE_PROVIDER_LABELS[id]}`}
                >
                  <Ionicons
                    name="chevron-down"
                    size={22}
                    color={index === valuePrefs.order.length - 1 ? '#333' : theme.colors.primary}
                  />
                </TouchableOpacity>
                <Switch
                  value={valuePrefs.enabled[id]}
                  onValueChange={(v) =>
                    void persistValuePrefs({
                      ...valuePrefs,
                      enabled: { ...valuePrefs.enabled, [id]: v },
                    })
                  }
                  trackColor={{ false: '#333', true: 'rgba(0,127,255,0.35)' }}
                  thumbColor={valuePrefs.enabled[id] ? theme.colors.primary : '#888'}
                  accessibilityLabel={`Fuente valor ${VALUE_PROVIDER_LABELS[id]}`}
                />
              </View>
            </View>
          ))}
        </View>

        {retryRunning && retryProgress ? (
          <View style={styles.progressBox}>
            <ActivityIndicator color={theme.colors.primary} size="small" />
            <Text style={styles.progressText} numberOfLines={2}>{retryProgress}</Text>
          </View>
        ) : null}

        {coverDlRunning && coverDlProgress ? (
          <View style={styles.progressBox}>
            <ActivityIndicator color={theme.colors.primary} size="small" />
            <Text style={styles.progressText} numberOfLines={2}>{coverDlProgress}</Text>
          </View>
        ) : null}

        <ActionRow
          icon="refresh-circle-outline"
          label="Reintentar metadatos"
          hint="Solo texto (género, año…); no toca portadas. El nombre guardado no cambia"
          onPress={onRetryMetadata}
          loading={retryRunning}
        />
        <ActionRow
          icon="cloud-download-outline"
          label="Descargar portadas en lote"
          hint="Miniaturas en disco para el catálogo; lento en colecciones grandes"
          onPress={onDownloadCoverBatch}
          loading={coverDlRunning || retryRunning || importRunning}
        />
        <ActionRow
          icon="duplicate-outline"
          label="Limpiar duplicados"
          hint="Elimina entradas duplicadas por código de barras"
          onPress={onCleanDuplicates}
        />
        <ActionRow
          icon="share-outline"
          label="Exportar catálogo (JSON)"
          hint="Copia de seguridad CoverLens; no es el mismo formato que Playnite"
          onPress={onExport}
        />

        <Pressable
          style={styles.guideToggle}
          onPress={() => setCatalogGuideOpen((o) => !o)}
          accessibilityRole="button"
          accessibilityLabel={
            catalogGuideOpen ? 'Ocultar ayuda de exportar e importar' : 'Mostrar ayuda de exportar e importar'
          }
        >
          <Ionicons
            name={catalogGuideOpen ? 'chevron-down' : 'chevron-forward'}
            size={18}
            color={theme.colors.primary}
          />
          <Text style={styles.guideToggleText}>Ayuda: exportar, importar y Playnite</Text>
        </Pressable>
        {catalogGuideOpen ? (
          <View style={styles.guideBox}>
            <Text style={[styles.guideTitle, styles.guideTitleFirst]}>Exportar</Text>
            <Text style={styles.guideBody}>
              Genera un JSON propio de CoverLens para copia de seguridad o para pasar la colección a otro móvil.
            </Text>
            <Text style={styles.guideTitle}>Importar</Text>
            <Text style={styles.guideBody}>
              Puedes elegir ese mismo JSON, o un CSV exportado desde Playnite (ver abajo). No uses otros formatos ni
              el .zip de backup de Playnite.
            </Text>
            <Text style={styles.guideTitle}>Desde Playnite (CSV)</Text>
            <Text style={styles.guideBody}>
              1) En Playnite, instala la extensión «Library Exporter Advanced» (menú de complementos).{'\n'}
              2) Exporta la biblioteca a CSV (coma o punto y coma). No necesitas marcar todos los campos: como mínimo
              «Nombre» y «Plataformas»; el resto es opcional y CoverLens usará lo que reconozca.{'\n'}
              3) Pasa el archivo al teléfono (nube, correo, AirDrop…).{'\n'}
              4) Pulsa «Importar catálogo» debajo y elige el .csv.{'\n'}
              5) Después, «Reintentar metadatos» para completar datos de texto y «Descargar portadas en lote» (o en cada
              ficha «Actualizar portadas») para imágenes. El CSV casi nunca trae URLs de imagen válidas en el móvil.
            </Text>
          </View>
        ) : null}

        {importRunning && importProgress ? (
          <View style={styles.progressBox}>
            <ActivityIndicator color={theme.colors.primary} size="small" />
            <Text style={styles.progressText} numberOfLines={3}>
              {importProgress}
            </Text>
          </View>
        ) : null}

        <ActionRow
          icon="download-outline"
          label="Importar catálogo"
          hint="JSON de esta app o CSV de Playnite (Library Exporter Advanced)"
          onPress={onImportCatalog}
          loading={importRunning}
        />
        <ActionRow
          icon="document-text-outline"
          label="Documentación: portadas y fuentes"
          hint="Portadas, metadatos (GameplayStores, IGDB…), valor y credenciales opcionales"
          onPress={() => router.push('/documentacion-fuentes')}
        />
      </View>

      {/* ── Sección 2: APIs de metadatos (colapsable) ───────────────────────── */}
      <View style={styles.section}>
        <Pressable
          style={styles.apisMetadataToggle}
          onPress={() => setApisMetadataOpen((o) => !o)}
          accessibilityRole="button"
          accessibilityLabel={
            apisMetadataOpen ? 'Ocultar APIs de metadatos' : 'Mostrar APIs de metadatos para rellenar credenciales'
          }
        >
          <Ionicons
            name={apisMetadataOpen ? 'chevron-down' : 'chevron-forward'}
            size={18}
            color={theme.colors.primary}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.guideToggleText}>APIs de metadatos</Text>
            <Text style={styles.apisCollapseSubtitle}>
              IGDB, SteamGridDB, ScreenScraper, cotización… Toca para {apisMetadataOpen ? 'ocultar' : 'mostrar'}.
            </Text>
          </View>
        </Pressable>

        {apisMetadataOpen ? (
          <>
            <View style={styles.divider} />

            {/* IGDB */}
            <View style={styles.subsection}>
          <View style={styles.subsectionHeader}>
            <Text style={styles.subsectionTitle}>IGDB — datos extra de ficha</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Recomendado</Text>
            </View>
          </View>
          <Text style={styles.sectionHint}>
            Opcional: sin IGDB puedes catalogar con GameplayStores (título, plataforma, a veces portada en el JSON). Con
            Client ID y Secret de Twitch rellenas año, género, descripción, valoración, etc. El orden de metadatos y de
            portadas lo configuras arriba en Catálogo. «Reintentar metadatos» no cambia imágenes.
          </Text>
          {field('Client ID *', 'igdbClientId', 'xxxxxxxxxxxxxxxx')}
          {field('Client Secret *', 'igdbClientSecret', 'xxxxxxxxxxxxxxxx', true)}
          <TouchableOpacity onPress={() => void Linking.openURL(providerLinks.igdb)}>
            <Text style={styles.link}>Crear app en Twitch Dev Console →</Text>
          </TouchableOpacity>
        </View>

        {/* SteamGridDB */}
        <View style={styles.subsection}>
          <View style={styles.subsectionHeader}>
            <Text style={styles.subsectionTitle}>SteamGridDB — carátulas</Text>
            <View style={styles.badgeRecommended}>
              <Text style={styles.badgeRecommendedText}>Recomendado</Text>
            </View>
          </View>
          <Text style={styles.sectionHint}>
            Tras GameplayStores cuando aplica. Grids en tamaño reducido (467×600) para menos datos; prueba título
            original y limpio.
          </Text>
          {field('API Key', 'steamGridDbApiKey', 'tu-api-key')}
          <TouchableOpacity onPress={() => void Linking.openURL(providerLinks.steamGridDb)}>
            <Text style={styles.link}>Obtener API key →</Text>
          </TouchableOpacity>
        </View>

        {/* ScreenScraper */}
        <View style={styles.subsection}>
          <View style={styles.subsectionHeader}>
            <Text style={styles.subsectionTitle}>ScreenScraper — metadatos y portadas de respaldo</Text>
            <View style={styles.badgeOptional}>
              <Text style={styles.badgeOptionalText}>Opcional</Text>
            </View>
          </View>
          <Text style={styles.sectionHint}>
            Si lo activas en «Orden de fuentes (metadatos)» o en portadas, se usa como capa extra. Usuario y contraseña
            de screenscraper.fr; Dev ID / Dev password del foro mejoran límites.
          </Text>
          {field('Usuario', 'screenScraperUsername', 'tu-usuario')}
          {field('Password', 'screenScraperPassword', 'tu-password', true)}
          {field('Dev ID (opcional)', 'screenScraperDevId', 'dev-id')}
          {field('Dev Password (opcional)', 'screenScraperDevPassword', 'dev-password', true)}
          <TouchableOpacity onPress={() => void Linking.openURL(providerLinks.screenScraper)}>
            <Text style={styles.link}>Crear cuenta ScreenScraper →</Text>
          </TouchableOpacity>
        </View>

        {/* Cotización */}
        <View style={styles.subsection}>
          <View style={styles.subsectionHeader}>
            <Text style={styles.subsectionTitle}>Cotización — valor orientativo</Text>
            <View style={styles.badgeOptional}>
              <Text style={styles.badgeOptionalText}>Opcional</Text>
            </View>
          </View>
          <Text style={styles.sectionHint}>
            No hace falta para catalogar ni para portadas. PriceCharting Pro: precios guía en USD (CIB o suelto según
            “solo disco” en la ficha). eBay: mediana de
            anuncios activos en el marketplace indicado (orientativo, no precio de subasta cerrada). Puedes usar solo
            eBay, solo PriceCharting, o ambos.
          </Text>
          {field('PriceCharting token', 'priceChartingToken', 'token de la suscripción Pro', true)}
          <TouchableOpacity onPress={() => void Linking.openURL(providerLinks.priceCharting)}>
            <Text style={styles.link}>PriceCharting Pro / API →</Text>
          </TouchableOpacity>
          <Text style={[styles.sectionHint, { marginTop: 10 }]}>
            eBay no usa tu usuario y contraseña de compras. Crea una aplicación gratuita en eBay Developers y copia aquí
            el Client ID (App ID) y el Client Secret: son las credenciales OAuth de la app, no la cuenta de eBay.
          </Text>
          {field('eBay Client ID', 'ebayClientId', 'App Client ID (Developer Portal)')}
          {field('eBay Client Secret', 'ebayClientSecret', 'Client Secret de la app', true)}
          {field('eBay Marketplace', 'ebayMarketplaceId', 'EBAY_ES o EBAY_US')}
          <Text style={[styles.sectionHint, { marginTop: 6 }]}>
            Keyset Sandbox: si el Client ID contiene «-SBX-», usamos{' '}
            <Text style={{ fontFamily: 'monospace' }}>api.sandbox.ebay.com</Text>. Los datos de prueba suelen ir mejor con{' '}
            <Text style={{ fontFamily: 'monospace' }}>EBAY_US</Text> y títulos en inglés. Producción: keyset sin SBX en{' '}
            <Text style={{ fontFamily: 'monospace' }}>developer.ebay.com/my/keys</Text>.
          </Text>
          <TouchableOpacity onPress={() => void Linking.openURL('https://developer.ebay.com/my/keys')}>
            <Text style={styles.link}>Application Keys (eBay Developers) →</Text>
          </TouchableOpacity>
          <Text style={[styles.sectionHint, { marginTop: 8 }]}>
            Prueba: guarda credenciales, «Ejecutar diagnóstico» (token OK) y en la ficha el botón eBay.
          </Text>
        </View>

            <TouchableOpacity
              style={[styles.btnPrimary, saving && styles.btnDisabled]}
              onPress={onSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={18} color="#fff" />
                  <Text style={styles.btnPrimaryText}>Guardar credenciales</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : null}
      </View>

      {/* ── Sección 3: Herramientas ─────────────────────────────────────────── */}
      <View style={styles.section}>
        <SectionHeader
          icon="construct-outline"
          title="Herramientas"
          subtitle="Diagnóstico y mantenimiento"
        />
        <View style={styles.divider} />

        <ActionRow
          icon="pulse-outline"
          label="Ejecutar diagnóstico"
          hint="IGDB, ScreenScraper, PriceCharting y eBay"
          onPress={onDiagnostic}
          loading={diagRunning || coverProbeRunning}
        />
        <ActionRow
          icon="images-outline"
          label="Probar portadas (Gears / Xbox 360)"
          hint="SteamGridDB y ScreenScraper con tus credenciales guardadas"
          onPress={onCoverSourcesProbe}
          loading={coverProbeRunning || diagRunning}
        />
        <ActionRow
          icon="school-outline"
          label="Repetir guía inicial"
          hint="Vuelve al onboarding para completar o corregir credenciales clave"
          onPress={onReplayOnboarding}
        />
        <ActionRow
          icon="hand-left-outline"
          label="Repetir guía práctica (escáner)"
          hint="Indicaciones en pantalla: escanear, abrir ficha y actualizar portadas"
          onPress={onReplayFirstRunTour}
        />
        <ActionRow
          icon="folder-open-outline"
          label="Vaciar catálogo"
          hint="Borra todos los juegos; pide confirmación dos veces"
          onPress={onEmptyCatalog}
          danger
        />
        <ActionRow
          icon="trash-outline"
          label="Limpiar credenciales"
          hint="Elimina todas las API keys guardadas"
          onPress={onClear}
          danger
        />

        {diagLog.length > 0 && (
          <View style={styles.logBox}>
            {diagLog.map((line, i) => (
              <Text key={i} style={styles.logLine} selectable>
                {line}
              </Text>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 120 },
  screenTitle: {
    color: theme.colors.primary,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 20,
  },
  // Secciones
  section: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1e1e1e',
    borderRadius: 16,
    backgroundColor: '#0d0d0d',
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
  },
  sectionTitle: {
    color: theme.colors.textLight,
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 1,
  },
  sectionSubtitle: {
    color: theme.colors.textDim,
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#1e1e1e',
    marginHorizontal: 0,
  },
  // Sub-secciones dentro de APIs
  subsection: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  subsectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  subsectionTitle: {
    color: theme.colors.textLight,
    fontWeight: '600',
    fontSize: 14,
  },
  badge: {
    backgroundColor: 'rgba(0,127,255,0.15)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,127,255,0.3)',
  },
  badgeText: {
    color: theme.colors.primary,
    fontSize: 10,
    fontWeight: '700',
  },
  badgeRecommended: {
    backgroundColor: 'rgba(46,204,113,0.12)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.35)',
  },
  badgeRecommendedText: {
    color: '#2ecc71',
    fontSize: 10,
    fontWeight: '700',
  },
  badgeOptional: {
    backgroundColor: 'rgba(149,165,166,0.12)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(149,165,166,0.35)',
  },
  badgeOptionalText: {
    color: theme.colors.textDim,
    fontSize: 10,
    fontWeight: '700',
  },
  sectionHint: {
    color: theme.colors.textDim,
    fontSize: 12,
    marginBottom: 2,
    lineHeight: 17,
  },
  // Filas de acción
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  actionRowDanger: {
    borderBottomColor: 'rgba(231,76,60,0.1)',
  },
  actionRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  actionLabel: {
    color: theme.colors.textLight,
    fontSize: 14,
    fontWeight: '600',
  },
  actionLabelDanger: { color: '#e74c3c' },
  actionHint: {
    color: theme.colors.textDim,
    fontSize: 11,
    marginTop: 1,
  },
  // Formulario
  label: {
    color: theme.colors.textDim,
    marginBottom: 4,
    marginTop: 10,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 8,
    color: theme.colors.textLight,
    backgroundColor: '#111',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  link: {
    marginTop: 10,
    color: theme.colors.primary,
    textDecorationLine: 'underline',
    fontSize: 12,
  },
  // Botón guardar
  btnPrimary: {
    margin: 14,
    borderRadius: 10,
    paddingVertical: 13,
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.5 },
  // Progreso reintento
  progressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,127,255,0.06)',
  },
  progressText: {
    color: theme.colors.textDim,
    fontSize: 12,
    flex: 1,
  },
  // Log diagnóstico
  guideToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  apisMetadataToggle: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  guideToggleText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  apisCollapseSubtitle: {
    color: theme.colors.textDim,
    fontSize: 11,
    marginTop: 4,
    lineHeight: 15,
  },
  guideBox: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    backgroundColor: '#080808',
  },
  guideTitle: {
    color: theme.colors.textLight,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 4,
  },
  guideTitleFirst: { marginTop: 0 },
  guideBody: {
    color: theme.colors.textDim,
    fontSize: 12,
    lineHeight: 18,
  },
  logBox: {
    margin: 14,
    marginTop: 10,
    backgroundColor: '#050505',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e3a5f',
    padding: 12,
  },
  logLine: {
    color: '#7fc4e8',
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  coverPrefSection: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    backgroundColor: '#080808',
  },
  coverPrefSectionTitle: {
    color: theme.colors.textLight,
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 6,
  },
  coverPrefSectionHint: {
    color: theme.colors.textDim,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 10,
  },
  coverPrefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#151515',
  },
  coverPrefLabel: {
    color: theme.colors.textLight,
    fontSize: 13,
    fontWeight: '600',
  },
  coverPrefControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
