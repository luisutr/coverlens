import { Ionicons } from '@expo/vector-icons';
import { CameraView, scanFromURLAsync, useCameraPermissions, type BarcodeType } from 'expo-camera';
// expo-image-picker se carga dinámicamente en onBarcodeFromPhoto
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { theme } from '../../constants/theme';
import { addGame, getGameByBarcode, getGames, initDatabase } from '../../database/dbConfig';
import { resolveMetadata } from '../../services/metadataResolver';
import { newGameFieldsFromMetadata } from '../../services/utils/metadataToGameInput';
import { enqueueCoverThumbCache } from '../../services/storage/coverThumbCache';
import { assessBarcode } from '../../services/utils/barcodeValidation';
import { emitCatalogRefresh } from '../../services/catalogRefreshBus';
import {
  canonicalizePlatform,
  normalizeManualGameSearch,
  splitTitleAndPlatform,
} from '../../services/utils/platformUtils';
import { advanceTourAfterBarcodeScan } from '../../services/firstRunTour';
import { OCR_IMAGE_MEDIA_TYPES, pickImageForOcr } from '../../services/ocrImagePicker';

type Mode = 'barcode' | 'batch_prompt' | 'manual';
type BatchParsedItem = { title: string; platform: string | null };

const GEMINI_BATCH_PROMPT = [
  'Quiero catalogar juegos fisicos para la app CoverLens.',
  'Analiza la foto de mi estanteria y devuelve SOLO JSON valido (sin markdown, sin comentarios) con este formato exacto:',
  '{"games":[{"title":"TITULO EXACTO","platform":"PLATAFORMA"}]}',
  'Reglas:',
  '- Usa solo juegos que se lean con claridad.',
  '- Un elemento por juego.',
  '- "platform" siempre rellena (PS5, PS4, PS3, PS2, PS1, Xbox Series X, Xbox One, Xbox 360, Xbox, Switch, Wii U, Wii, GameCube, N64, DS, 3DS, PSP, PSVita, PC).',
  '- Si dudas entre dos titulos, NO inventes: omite ese juego.',
].join('\n');

const BARCODE_SCAN_FROM_IMAGE_TYPES: BarcodeType[] = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'];

export default function EscanerScreen() {
  const router = useRouter();
  const [mode, setMode] = React.useState<Mode>('barcode');
  const [rawTitle, setRawTitle] = React.useState('');
  const [batchRaw, setBatchRaw] = React.useState('');
  const [batchImporting, setBatchImporting] = React.useState(false);
  const [promptCopied, setPromptCopied] = React.useState(false);
  const [lastBarcode, setLastBarcode] = React.useState<string | null>(null);
  const [discOnly, setDiscOnly] = React.useState(false);
  const [favorite, setFavorite] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [scannerEnabled, setScannerEnabled] = React.useState(true);
  const [permission, requestPermission] = useCameraPermissions();
  const scanLockRef = React.useRef(false);

  // Estado para modal "juego no encontrado por barcode"
  const [notFoundModal, setNotFoundModal] = React.useState(false);
  const [notFoundBarcode, setNotFoundBarcode] = React.useState('');
  const [notFoundTitle, setNotFoundTitle] = React.useState('');
  const [notFoundPlatform, setNotFoundPlatform] = React.useState('');

  const [barcodeFixModal, setBarcodeFixModal] = React.useState(false);
  const [barcodeFixValue, setBarcodeFixValue] = React.useState('');

  const isLikelyDuplicateError = (error: unknown) => {
    const msg = String(error).toLowerCase();
    return msg.includes('unique') || msg.includes('constraint') || msg.includes('idx_games_barcode_unique');
  };

  useFocusEffect(
    React.useCallback(() => {
      setScannerEnabled(true);
      setLastBarcode(null);
      setSaving(false);
      scanLockRef.current = false;
      return () => { setScannerEnabled(false); };
    }, [])
  );

  React.useEffect(() => {
    if (mode === 'barcode') {
      setScannerEnabled(true);
      scanLockRef.current = false;
      setLastBarcode(null);
    }
  }, [mode]);

  const resetBarcodeScanGate = React.useCallback(() => {
    scanLockRef.current = false;
    setScannerEnabled(true);
    setLastBarcode(null);
  }, []);

  const runBarcodeInsertFlow = React.useCallback(
    async (barcode: string) => {
      setScannerEnabled(false);
      scanLockRef.current = true;
      setSaving(true);
      setLastBarcode(barcode);
      try {
        await initDatabase();
        const existing = await getGameByBarcode(barcode);
        if (existing) {
          emitCatalogRefresh();
          router.replace('/');
          return;
        }
        const resolved = await resolveMetadata({ barcode });

        if (resolved.status === 'error') {
          setNotFoundBarcode(barcode);
          setNotFoundTitle('');
          setNotFoundPlatform('');
          setNotFoundModal(true);
          setSaving(false);
          return;
        }

        const newId = await addGame(
          newGameFieldsFromMetadata(resolved, {
            scannedBarcode: barcode,
            favorite: favorite ? 1 : 0,
            discOnly: discOnly ? 1 : 0,
          })
        );
        enqueueCoverThumbCache(newId, resolved.coverUrl ?? null);
        void advanceTourAfterBarcodeScan();
        emitCatalogRefresh();
        router.replace('/');
      } catch (error) {
        if (isLikelyDuplicateError(error)) {
          emitCatalogRefresh();
          router.replace('/');
          return;
        }
        Alert.alert('Error', 'No se pudo guardar el juego escaneado.');
        scanLockRef.current = false;
        setScannerEnabled(true);
      } finally {
        setSaving(false);
      }
    },
    [discOnly, favorite, router]
  );

  const onConfirmBarcodeFix = React.useCallback(() => {
    const fixed = barcodeFixValue.replace(/\s/g, '').replace(/[^0-9A-Za-z]/g, '');
    if (!fixed) {
      Alert.alert('Vacío', 'Escribe el código o cancela.');
      return;
    }
    setBarcodeFixModal(false);
    const a = assessBarcode(fixed);
    if (!a.ok) {
      Alert.alert('Código aún dudoso', a.message, [
        {
          text: 'Volver a editar',
          style: 'cancel',
          onPress: () => {
            setBarcodeFixValue(fixed);
            setBarcodeFixModal(true);
          },
        },
        { text: 'Reescanear', onPress: resetBarcodeScanGate },
        { text: 'Buscar así', style: 'destructive', onPress: () => void runBarcodeInsertFlow(fixed) },
      ]);
      return;
    }
    void runBarcodeInsertFlow(fixed);
  }, [barcodeFixValue, resetBarcodeScanGate, runBarcodeInsertFlow]);

  // ─── BARCODE ────────────────────────────────────────────────────────────────
  const handleBarcodeCandidate = React.useCallback(
    (barcode: string) => {
      const assessment = assessBarcode(barcode);
      if (!assessment.ok) {
        scanLockRef.current = true;
        setScannerEnabled(false);
        Alert.alert('Revisa el código de barras', assessment.message, [
          { text: 'Reescanear', style: 'cancel', onPress: resetBarcodeScanGate },
          {
            text: 'Corregir',
            onPress: () => {
              setBarcodeFixValue(barcode);
              setBarcodeFixModal(true);
            },
          },
          { text: 'Usar igualmente', style: 'destructive', onPress: () => void runBarcodeInsertFlow(barcode) },
        ]);
        return;
      }

      void runBarcodeInsertFlow(barcode);
    },
    [resetBarcodeScanGate, runBarcodeInsertFlow]
  );

  const onBarcodeScanned = React.useCallback(
    ({ data }: { data: string }) => {
      const barcode = data.replace(/\s/g, '').replace(/[^0-9A-Za-z]/g, '');
      if (!barcode || saving || mode !== 'barcode' || lastBarcode === barcode || scanLockRef.current) return;
      handleBarcodeCandidate(barcode);
    },
    [handleBarcodeCandidate, lastBarcode, mode, saving]
  );

  const onBarcodeFromPhoto = React.useCallback(async () => {
    if (saving || mode !== 'barcode' || scanLockRef.current) return;
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
      Alert.alert('No disponible', 'Leer un código desde una foto solo está soportado en la app para móvil.');
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ImagePicker = require('expo-image-picker') as typeof import('expo-image-picker');
      const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!lib.granted) {
        Alert.alert('Fototeca', 'Activa el acceso a Fotos para elegir una imagen con el código de barras.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: OCR_IMAGE_MEDIA_TYPES,
        quality: 0.92,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets[0]?.uri) return;

      let codes: { data: string }[];
      try {
        codes = await scanFromURLAsync(result.assets[0].uri, BARCODE_SCAN_FROM_IMAGE_TYPES);
      } catch (e) {
        Alert.alert('Error', `No se pudo analizar la imagen: ${String(e).slice(0, 120)}`);
        return;
      }

      if (!codes.length) {
        const iosNote =
          Platform.OS === 'ios'
            ? '\n\nEn iOS la lectura desde fototeca suele limitarse (a menudo solo QR); para códigos EAN/UPC de juegos conviene la cámara en vivo.'
            : '\n\nPrueba una foto más nítida con el código grande y centrado.';
        Alert.alert('Sin código detectado', `No se encontró un código de barras legible en la imagen.${iosNote}`);
        return;
      }

      const candidates = Array.from(
        new Set(
          codes
            .map((c) => c.data.replace(/\s/g, '').replace(/[^0-9A-Za-z]/g, ''))
            .filter(Boolean)
        )
      );
      const preferred =
        candidates.find((c) => assessBarcode(c).ok) ?? candidates[0] ?? '';
      if (!preferred) {
        Alert.alert('Sin código', 'No se pudo interpretar el contenido del código detectado.');
        return;
      }
      handleBarcodeCandidate(preferred);
    } catch (e) {
      Alert.alert('Error', `No se pudo abrir la fototeca: ${String(e).slice(0, 100)}`);
    }
  }, [handleBarcodeCandidate, mode, saving]);

  // ─── BARCODE NOT FOUND — guardar con título manual ────────────────────────
  const onConfirmNotFound = React.useCallback(async () => {
    if (!notFoundTitle.trim()) {
      Alert.alert('Falta el título', 'Escribe el nombre del juego para buscarlo.');
      return;
    }
    setNotFoundModal(false);
    setSaving(true);
    try {
      const resolved = await resolveMetadata({
        barcode: notFoundBarcode,
        titleHint: notFoundTitle.trim(),
        platformHint: notFoundPlatform.trim() ? canonicalizePlatform(notFoundPlatform.trim()) : null,
      });
      const newId = await addGame(
        newGameFieldsFromMetadata(resolved, {
          scannedBarcode: notFoundBarcode,
          favorite: favorite ? 1 : 0,
          discOnly: discOnly ? 1 : 0,
        })
      );
      enqueueCoverThumbCache(newId, resolved.coverUrl ?? null);
      void advanceTourAfterBarcodeScan();
      emitCatalogRefresh();
      router.replace('/');
    } catch (error) {
      if (isLikelyDuplicateError(error)) {
        emitCatalogRefresh();
        router.replace('/');
        return;
      }
      Alert.alert('Error', 'No se pudo guardar el juego.');
    } finally {
      setSaving(false);
    }
  }, [discOnly, favorite, notFoundBarcode, notFoundPlatform, notFoundTitle, router]);

  const parseBatchInput = React.useCallback((raw: string): BatchParsedItem[] => {
    const trimmed = raw.trim();
    if (!trimmed) return [];

    const withoutFences = trimmed
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    const maybeJson = withoutFences.match(/\{[\s\S]*\}/)?.[0] ?? withoutFences;

    try {
      const parsed = JSON.parse(maybeJson) as { games?: { title?: unknown; platform?: unknown }[] };
      if (Array.isArray(parsed.games)) {
        return parsed.games
          .map((g) => ({
            title: String(g?.title ?? '').trim(),
            platform: String(g?.platform ?? '').trim() || null,
          }))
          .filter((g) => g.title.length >= 2);
      }
    } catch {
      // Fallback a parseo por lineas.
    }

    return withoutFences
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.replace(/^[-*•\d.)\s]+/, '').trim())
      .map((line) => {
        const pipe = line.split('|').map((x) => x.trim()).filter(Boolean);
        if (pipe.length >= 2) {
          return { title: pipe[0], platform: pipe[1] };
        }
        const dash = line.split(/\s[-–—]\s/).map((x) => x.trim()).filter(Boolean);
        if (dash.length >= 2) {
          return { title: dash[0], platform: dash[1] };
        }
        const split = splitTitleAndPlatform(normalizeManualGameSearch(line) || line);
        return { title: split.titleHint, platform: split.platformHint };
      })
      .filter((g) => g.title.length >= 2);
  }, []);

  const onOpenGemini = React.useCallback(async () => {
    try {
      await Linking.openURL('https://gemini.google.com/app');
    } catch {
      Alert.alert('No se pudo abrir', 'Abre manualmente https://gemini.google.com/app en tu navegador.');
    }
  }, []);

  const onCopyPrompt = React.useCallback(async () => {
    try {
      await Clipboard.setStringAsync(GEMINI_BATCH_PROMPT);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 1800);
    } catch {
      Alert.alert('No se pudo copiar', 'Selecciona el texto del prompt y cópialo manualmente.');
    }
  }, []);

  const onCaptureShelfPhoto = React.useCallback(async () => {
    const uri = await pickImageForOcr('Foto para Gemini', '¿Cámara o fototeca?');
    if (!uri) return;
    Alert.alert(
      'Foto lista',
      'La imagen se ha tomado/seleccionado. Ahora súbela en Gemini (app o web) con el prompt y pega aquí el JSON.'
    );
  }, []);

  const onImportGeminiBatch = React.useCallback(async () => {
    const parsed = parseBatchInput(batchRaw);
    if (parsed.length === 0) {
      Alert.alert(
        'Formato no valido',
        'Pega un JSON como {"games":[{"title":"...","platform":"..."}]} o lineas tipo "Titulo | Plataforma".'
      );
      return;
    }

    setBatchImporting(true);
    const failureNotes: string[] = [];
    try {
      await initDatabase();
      const current = await getGames();
      const existing = new Set(
        current.map((g) => `${g.title.trim().toLowerCase()}|${canonicalizePlatform(g.platform).toLowerCase()}`)
      );

      let added = 0;
      let skipped = 0;
      let failed = 0;
      const seenInput = new Set<string>();

      const catalogDuplicateKey = (title: string, platform: string) =>
        `${title.trim().toLowerCase()}|${canonicalizePlatform(platform).toLowerCase()}`;

      for (const candidate of parsed) {
        let titleHint = candidate.title.trim();
        let platformHint = candidate.platform?.trim() ? canonicalizePlatform(candidate.platform.trim()) : null;
        if (!titleHint) continue;

        if (!platformHint) {
          const split = splitTitleAndPlatform(normalizeManualGameSearch(titleHint) || titleHint);
          titleHint = split.titleHint.trim();
          platformHint = split.platformHint ? canonicalizePlatform(split.platformHint) : null;
        }
        if (!titleHint) continue;

        const safeTitle = titleHint || 'Juego';
        const safePlatform = platformHint?.trim() || 'Plataforma desconocida';
        const inputDedupKey = `${safeTitle.toLowerCase()}|${safePlatform.toLowerCase()}`;
        if (seenInput.has(inputDedupKey)) {
          skipped++;
          continue;
        }
        seenInput.add(inputDedupKey);

        try {
          const postKey = catalogDuplicateKey(safeTitle, safePlatform);
          if (existing.has(postKey)) {
            skipped++;
            continue;
          }
          await addGame({
            title: safeTitle,
            barcode: null,
            platform: safePlatform,
            version: null,
            releaseYear: null,
            genre: null,
            developer: null,
            publisher: null,
            description: null,
            rating: null,
            franchise: null,
            coverUrl: null,
            headerImageUrl: null,
            metadataStatus: 'pending',
            metadataSource: 'gemini_batch',
            lastError: null,
            favorite: favorite ? 1 : 0,
            discOnly: discOnly ? 1 : 0,
            valueCents: null,
            valueCurrency: null,
            valueSource: null,
          });
          existing.add(postKey);
          added++;
        } catch (error) {
          if (isLikelyDuplicateError(error)) {
            skipped++;
            continue;
          }
          failed++;
          failureNotes.push(`- ${titleHint.slice(0, 30)}: ${String(error).slice(0, 90)}`);
        }
      }

      let body = `Añadidos: ${added}\nOmitidos: ${skipped}\nFallidos: ${failed}`;
      if (failureNotes.length > 0) {
        body += `\n\nDetalle (max 4):\n${failureNotes.slice(0, 4).join('\n')}`;
      }
      body += '\n\nPuedes usar "Reintentar metadatos" en Ajustes cuando quieras completar fichas en lote.';
      Alert.alert('Importacion por lote completada', body);
      if (added > 0) {
        setBatchRaw('');
        emitCatalogRefresh();
      }
    } finally {
      setBatchImporting(false);
    }
  }, [batchRaw, discOnly, favorite, parseBatchInput]);

  // ─── MANUAL ──────────────────────────────────────────────────────────────────
  const onSaveManual = React.useCallback(async () => {
    const combined = normalizeManualGameSearch(rawTitle.trim());
    if (!combined) {
      Alert.alert('Falta título', 'Escribe el título del juego (y la plataforma si puedes).');
      return;
    }
    const { titleHint, platformHint } = splitTitleAndPlatform(combined);
    if (!titleHint) {
      Alert.alert('Falta título', 'Indica al menos el nombre del juego.');
      return;
    }
    setSaving(true);
    try {
      await initDatabase();
      const resolved = await resolveMetadata({ titleHint, platformHint });
      const newId = await addGame(
        newGameFieldsFromMetadata(resolved, {
          favorite: favorite ? 1 : 0,
          discOnly: discOnly ? 1 : 0,
        })
      );
      enqueueCoverThumbCache(newId, resolved.coverUrl ?? null);
      void advanceTourAfterBarcodeScan();
      setRawTitle('');
      emitCatalogRefresh();
      router.replace('/');
    } catch (error) {
      if (isLikelyDuplicateError(error)) {
        emitCatalogRefresh();
        router.replace('/');
        return;
      }
      Alert.alert('Error', 'No se pudo guardar el juego.');
    } finally {
      setSaving(false);
    }
  }, [discOnly, favorite, rawTitle, router]);

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>ESCÁNER</Text>

      {/* Selector de modo */}
      <View style={styles.segment}>
        {(['barcode', 'batch_prompt', 'manual'] as Mode[]).map((m) => (
          <Pressable
            key={m}
            onPress={() => setMode(m)}
            style={[styles.segmentBtn, mode === m && styles.segmentBtnActive]}
            accessibilityRole="button"
            accessibilityLabel={
              m === 'barcode'
                ? 'Modo barcode'
                : m === 'batch_prompt'
                  ? 'Modo lote con Gemini externo'
                    : 'Modo manual'
            }
            accessibilityHint="Cambia la forma de añadir juegos"
          >
            <Ionicons
              name={
                m === 'barcode'
                  ? 'barcode-outline'
                  : m === 'batch_prompt'
                    ? 'chatbubbles-outline'
                      : 'create-outline'
              }
              size={16}
              color={mode === m ? '#fff' : theme.colors.textDim}
            />
            <Text style={[styles.segmentText, mode === m && styles.segmentTextActive]}>
              {m === 'barcode'
                ? 'Barcode'
                : m === 'batch_prompt'
                  ? 'Lote IA'
                    : 'Manual'}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.mainScrollContent}
        showsVerticalScrollIndicator={false}
      >
      {/* Barcode */}
      {mode === 'barcode' && (
        <View>
          {!permission?.granted ? (
            <View style={styles.permissionBox}>
              <Text style={styles.helpText}>Necesitamos permiso de cámara para escanear.</Text>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => void requestPermission()}
                accessibilityRole="button"
                accessibilityLabel="Dar permiso de cámara"
              >
                <Text style={styles.actionBtnText}>Dar permiso de cámara</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.cameraWrap}>
              <CameraView
                style={styles.camera}
                barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'] }}
                onBarcodeScanned={scannerEnabled ? onBarcodeScanned : undefined}
              />
              {saving && (
                <View style={styles.cameraOverlay}>
                  <ActivityIndicator color={theme.colors.primary} size="large" />
                  <Text style={styles.cameraOverlayText}>Buscando juego...</Text>
                </View>
              )}
            </View>
          )}
          {(Platform.OS === 'ios' || Platform.OS === 'android') && (
            <TouchableOpacity
              style={[styles.outlineBtn, (saving || !scannerEnabled) && styles.actionBtnDisabled]}
              onPress={() => void onBarcodeFromPhoto()}
              disabled={saving || !scannerEnabled}
              accessibilityRole="button"
              accessibilityLabel="Elegir foto de la galería con código de barras"
            >
              <Ionicons name="images-outline" size={20} color={theme.colors.primary} />
              <Text style={styles.outlineBtnText}>Elegir foto con el código</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.helpText}>
            Acerca un código EAN/UPC (8, 12 o 13 dígitos) con la cámara, o usa una foto de la galería donde se vea bien el
            código. Validamos el código antes de guardar para evitar lecturas erróneas.
          </Text>
        </View>
      )}

      {/* Lote IA (Gemini externo) */}
      {mode === 'batch_prompt' && (
        <View style={styles.ocrContainer}>
          <View style={styles.ocrHintBox}>
            <Ionicons name="chatbubbles-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.ocrHint}>
              Flujo recomendado: foto de varios lomos en Gemini, respuesta en JSON y pegado en CoverLens para añadir en lote.
            </Text>
          </View>

          <View style={styles.batchStepsCard}>
            <Text style={styles.batchStepsTitle}>Cómo hacer una buena foto</Text>
            <Text style={styles.batchStepItem}>1) Coloca la estantería en horizontal o vertical, lo más recta posible.</Text>
            <Text style={styles.batchStepItem}>2) Encaja los lomos dentro del marco, sin cortar títulos.</Text>
            <Text style={styles.batchStepItem}>3) Evita reflejos y desenfoque; mejor luz frontal uniforme.</Text>
            <Text style={styles.batchStepItem}>4) Intenta no superar 12-18 juegos por foto para mejor precisión.</Text>
          </View>

          <View style={styles.shelfPreviewCard}>
            <Text style={styles.shelfPreviewTitle}>Ejemplo visual (referencia)</Text>
            <View style={styles.shelfPreviewFrame}>
              {[
                ['#f2f2f2', '#111'],
                ['#e7f4ff', '#1d7bbd'],
                ['#f8ffe7', '#4b8d2a'],
                ['#1d1d1d', '#cfd8dc'],
                ['#6a1b9a', '#f1d1ff'],
                ['#ff8f00', '#2e1c00'],
                ['#ffffff', '#0f0f0f'],
                ['#263238', '#d1e9f5'],
              ].map((spine, idx) => (
                <View key={idx} style={[styles.shelfSpine, { backgroundColor: spine[0] }]}>
                  <View style={[styles.shelfSpineBand, { backgroundColor: spine[1] }]} />
                </View>
              ))}
            </View>
            <Text style={styles.shelfPreviewCaption}>Mete todos los lomos en el encuadre y evita inclinación fuerte.</Text>
          </View>

          <TouchableOpacity
            style={styles.outlineBtn}
            onPress={() => void onCaptureShelfPhoto()}
            accessibilityRole="button"
            accessibilityLabel="Hacer o elegir foto para subir a Gemini"
          >
            <Ionicons name="camera-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.outlineBtnText}>1) Capturar foto del lote</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => void onOpenGemini()}
            accessibilityRole="button"
            accessibilityLabel="Abrir Gemini web para analizar la foto"
          >
            <Ionicons name="open-outline" size={20} color="#fff" />
            <Text style={styles.actionBtnText}>2) Abrir Gemini (web/app)</Text>
          </TouchableOpacity>
          <View style={styles.promptHeader}>
            <Text style={styles.modalLabel}>3) Prompt para Gemini</Text>
            <TouchableOpacity
              onPress={() => void onCopyPrompt()}
              style={styles.copyBtn}
              accessibilityRole="button"
              accessibilityLabel="Copiar prompt de Gemini"
            >
              <Ionicons name={promptCopied ? 'checkmark' : 'copy-outline'} size={15} color={theme.colors.primary} />
              <Text style={styles.copyBtnText}>{promptCopied ? 'Copiado' : 'Copiar'}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.promptBox}>
            <Text selectable style={styles.promptText}>
              {GEMINI_BATCH_PROMPT}
            </Text>
          </View>
          <Text style={styles.modalLabel}>4) Pega la respuesta JSON</Text>
          <TextInput
            style={styles.batchInput}
            value={batchRaw}
            onChangeText={setBatchRaw}
            placeholder='Ejemplo: {"games":[{"title":"Halo 3","platform":"Xbox 360"}]}'
            placeholderTextColor={theme.colors.textDim}
            multiline
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[styles.actionBtn, (batchImporting || !batchRaw.trim()) && styles.actionBtnDisabled]}
            onPress={() => void onImportGeminiBatch()}
            disabled={batchImporting || !batchRaw.trim()}
            accessibilityRole="button"
            accessibilityLabel="Agregar juegos del lote a la colección"
          >
            {batchImporting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="download-outline" size={20} color="#fff" />
                <Text style={styles.actionBtnText}>5) Agregar a la colección</Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={styles.ocrWarning}>
            Consejo: pide solo JSON en la respuesta. CoverLens importa rápido (título/plataforma) y deja metadatos en
            pendiente para completarlos luego desde Ajustes.
          </Text>
        </View>
      )}

      {/* Manual */}
      {mode === 'manual' && (
        <View>
          <TextInput
            style={styles.input}
            value={rawTitle}
            onChangeText={setRawTitle}
            placeholder="Título y plataforma (ej: Gears of War Xbox 360)"
            placeholderTextColor={theme.colors.textDim}
            returnKeyType="search"
            onSubmitEditing={onSaveManual}
          />
          <TouchableOpacity
            style={[styles.actionBtn, (saving || !rawTitle.trim()) && styles.actionBtnDisabled]}
            onPress={onSaveManual}
            disabled={saving || !rawTitle.trim()}
            accessibilityRole="button"
            accessibilityLabel="Buscar por título y plataforma y guardar"
          >
            {saving ? <ActivityIndicator color="#fff" size="small" /> : (
              <>
                <Ionicons name="search" size={18} color="#fff" />
                <Text style={styles.actionBtnText}>Buscar y guardar</Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={styles.helpText}>
            Escribe título y plataforma en la misma línea (GameplayStores / IGDB). Detectamos la plataforma al final del
            texto cuando coincide con un nombre conocido (PS5, Xbox 360, etc.).
          </Text>
        </View>
      )}

      {/* Toggles */}
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Solo disco</Text>
        <Switch
          value={discOnly}
          onValueChange={setDiscOnly}
          trackColor={{ true: theme.colors.primary }}
          accessibilityLabel="Marcar solo disco"
        />
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Favorito</Text>
        <Switch
          value={favorite}
          onValueChange={setFavorite}
          trackColor={{ true: '#ff4268' }}
          accessibilityLabel="Marcar como favorito"
        />
      </View>
      </ScrollView>

      {/* Modal — juego no encontrado por barcode */}
      <Modal visible={notFoundModal} transparent animationType="slide" onRequestClose={() => { setNotFoundModal(false); scanLockRef.current = false; setScannerEnabled(true); }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={styles.modalTitle}>Juego no encontrado</Text>
                <Text style={styles.modalSubtitle}>
                  {'Código '}
                  <Text style={{ color: theme.colors.primary, fontFamily: 'monospace' }}>{notFoundBarcode}</Text>
                  {
                    ' escaneado pero no está en el catálogo.\nIndica título y, si puedes, plataforma (como en la tienda: «Juego - PS4»).'
                  }
                </Text>

                <Text style={styles.modalLabel}>Título del juego</Text>
                <TextInput
                  style={styles.modalInput}
                  value={notFoundTitle}
                  onChangeText={setNotFoundTitle}
                  placeholder="Ej: Metroid Prime"
                  placeholderTextColor={theme.colors.textDim}
                  autoFocus
                  returnKeyType="next"
                />

                <Text style={styles.modalLabel}>Plataforma (opcional)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={notFoundPlatform}
                  onChangeText={setNotFoundPlatform}
                  placeholder="Ej: GameCube, Xbox 360, PS2…"
                  placeholderTextColor={theme.colors.textDim}
                  returnKeyType="search"
                  onSubmitEditing={onConfirmNotFound}
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => { setNotFoundModal(false); scanLockRef.current = false; setScannerEnabled(true); }}
                    accessibilityRole="button"
                    accessibilityLabel="Cancelar búsqueda manual"
                  >
                    <Text style={styles.modalCancelText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalConfirmBtn}
                    onPress={onConfirmNotFound}
                    accessibilityRole="button"
                    accessibilityLabel="Buscar con título y plataforma"
                  >
                    <Text style={styles.modalConfirmText}>Buscar y guardar</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Corregir código de barras (validación GTIN) */}
      <Modal
        visible={barcodeFixModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setBarcodeFixModal(false);
          resetBarcodeScanGate();
        }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Corregir código</Text>
              <Text style={styles.modalSubtitle}>
                EAN/UPC suele tener 8, 12 o 13 dígitos. Ajusta el número si la cámara leyó mal un dígito.
              </Text>
              <Text style={styles.modalLabel}>Código</Text>
              <TextInput
                style={styles.modalInput}
                value={barcodeFixValue}
                onChangeText={setBarcodeFixValue}
                placeholder="Solo números o código alfanumérico"
                placeholderTextColor={theme.colors.textDim}
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="default"
                returnKeyType="done"
                onSubmitEditing={onConfirmBarcodeFix}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => {
                    setBarcodeFixModal(false);
                    resetBarcodeScanGate();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Cancelar corrección de código"
                >
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalConfirmBtn}
                  onPress={onConfirmBarcodeFix}
                  accessibilityRole="button"
                  accessibilityLabel="Confirmar código corregido"
                >
                  <Text style={styles.modalConfirmText}>Continuar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, paddingHorizontal: 16, paddingTop: 70 },
  mainScroll: { flex: 1 },
  mainScrollContent: { paddingBottom: 28 },
  titulo: { color: theme.colors.primary, fontSize: 22, fontWeight: '800', letterSpacing: 2, marginBottom: 16 },
  segment: { flexDirection: 'row', backgroundColor: '#0e0e0e', borderRadius: 12, padding: 4, marginBottom: 18, gap: 3 },
  segmentBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 9, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  segmentBtnActive: { backgroundColor: theme.colors.primary },
  segmentText: { color: theme.colors.textDim, fontWeight: '600', fontSize: 12 },
  segmentTextActive: { color: '#fff' },
  permissionBox: { gap: 12, marginBottom: 12 },
  cameraWrap: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#2b2b2b', marginBottom: 8, position: 'relative' },
  camera: { width: '100%', height: 240 },
  cameraOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', gap: 10 },
  cameraOverlayText: { color: '#fff', fontWeight: '600' },
  helpText: { color: theme.colors.textDim, fontSize: 12, marginBottom: 10, lineHeight: 18 },
  ocrContainer: { gap: 14 },
  ocrHintBox: { flexDirection: 'row', gap: 8, backgroundColor: 'rgba(0,100,255,0.08)', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: 'rgba(0,100,255,0.2)' },
  ocrHint: { flex: 1, color: theme.colors.textDim, fontSize: 13, lineHeight: 19 },
  ocrWarning: { color: '#f1c40f', fontSize: 12, lineHeight: 18 },
  batchStepsCard: {
    borderWidth: 1,
    borderColor: 'rgba(0,127,255,0.25)',
    borderRadius: 12,
    backgroundColor: 'rgba(0,127,255,0.07)',
    padding: 12,
    gap: 6,
  },
  batchStepsTitle: { color: '#fff', fontWeight: '700', fontSize: 14, marginBottom: 2 },
  batchStepItem: { color: theme.colors.textDim, fontSize: 12, lineHeight: 18 },
  shelfPreviewCard: {
    borderWidth: 1,
    borderColor: '#2d2d2d',
    borderRadius: 12,
    backgroundColor: '#101010',
    padding: 12,
    gap: 8,
  },
  shelfPreviewTitle: { color: theme.colors.textLight, fontWeight: '700', fontSize: 13 },
  shelfPreviewFrame: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#0b0b0b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2b2b2b',
    padding: 8,
    minHeight: 94,
    alignItems: 'stretch',
  },
  shelfSpine: {
    flex: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  shelfSpineBand: {
    height: 18,
    width: '100%',
    opacity: 0.92,
  },
  shelfPreviewCaption: { color: theme.colors.textDim, fontSize: 12, lineHeight: 17 },
  promptHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0,127,255,0.35)',
    backgroundColor: 'rgba(0,127,255,0.09)',
  },
  copyBtnText: { color: theme.colors.primary, fontSize: 12, fontWeight: '700' },
  promptBox: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 10,
    backgroundColor: '#101010',
    padding: 10,
    maxHeight: 220,
  },
  promptText: { color: theme.colors.textDim, fontSize: 12, lineHeight: 18 },
  batchInput: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 10,
    color: theme.colors.textLight,
    backgroundColor: '#111',
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 150,
    fontSize: 14,
    marginBottom: 10,
  },
  actionBtn: { backgroundColor: theme.colors.primary, borderRadius: 12, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  outlineBtn: {
    marginTop: 10,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,127,255,0.45)',
    backgroundColor: 'rgba(0,127,255,0.08)',
  },
  outlineBtnText: { color: theme.colors.primary, fontWeight: '700', fontSize: 14 },
  input: { borderWidth: 1, borderColor: '#333', borderRadius: 10, color: theme.colors.textLight, backgroundColor: '#111', paddingHorizontal: 12, paddingVertical: 12, marginBottom: 12, fontSize: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  rowLabel: { color: theme.colors.textLight, fontSize: 15 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#121212', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, borderTopWidth: 1, borderColor: '#222' },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 4 },
  modalSubtitle: { color: theme.colors.textDim, fontSize: 13, marginBottom: 16 },
  modalLabel: { color: theme.colors.textDim, fontSize: 12, fontWeight: '600', marginBottom: 5, marginTop: 10 },
  modalInput: { backgroundColor: '#1a1a1a', color: '#fff', borderWidth: 1, borderColor: '#333', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalCancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, borderWidth: 1, borderColor: '#444', alignItems: 'center' },
  modalCancelText: { color: theme.colors.textDim, fontWeight: '600' },
  modalConfirmBtn: { flex: 2, paddingVertical: 13, borderRadius: 10, backgroundColor: theme.colors.primary, alignItems: 'center' },
  modalConfirmText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
