import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
// expo-image-picker se carga dinámicamente en onScanWithOcr
import { useFocusEffect, useRouter } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
  Linking,
  Image,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as MediaLibrary from 'expo-media-library';
import { theme } from '../../constants/theme';
import { addGame, getGameByBarcode, initDatabase, importCatalogRows, getGameById, updateGameMetadata } from '../../database/dbConfig';
import { resolveMetadata } from '../../services/metadataResolver';
import { clearBarcodeScanLog, formatBarcodeScanLogForDisplay, logBarcodeScan } from '../../services/debug/barcodeScanLog';
import { enqueueCoverThumbCache, scheduleCoverThumbCache } from '../../services/storage/coverThumbCache';
import { assessBarcode } from '../../services/utils/barcodeValidation';
import {
  canonicalizePlatform,
  normalizeManualGameSearch,
  splitTitleAndPlatform,
} from '../../services/utils/platformUtils';
import { advanceTourAfterBarcodeScan } from '../../services/firstRunTour';
import { SHELF_BATCH_GEMINI_PROMPT, SHELF_BATCH_GEMINI_URL } from '../../constants/shelfBatchPrompt';
import { deriveMetadataStatusFromGameFields } from '../../services/utils/metadataCompleteness';
import { parseCatalogImport } from '../../services/import/catalogImport';

type Mode = 'barcode' | 'shelf_batch' | 'manual';

export default function EscanerScreen() {
  const router = useRouter();
  const [mode, setMode] = React.useState<Mode>('barcode');
  const [rawTitle, setRawTitle] = React.useState('');
  const [lastBarcode, setLastBarcode] = React.useState<string | null>(null);
  const [discOnly, setDiscOnly] = React.useState(false);
  const [favorite, setFavorite] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [scannerEnabled, setScannerEnabled] = React.useState(true);
  const [permission, requestPermission] = useCameraPermissions();
  const scanLockRef = React.useRef(false);

  // Lote IA — estados
  const [promptCopied, setPromptCopied] = React.useState(false);
  const [shelfBatchModal, setShelfBatchModal] = React.useState(false);
  const [pastedJson, setPastedJson] = React.useState('');
  const [parsedItems, setParsedItems] = React.useState<{ title: string; platform: string; selected: boolean }[]>([]);
  const [batchImporting, setBatchImporting] = React.useState(false);
  const [batchResults, setBatchResults] = React.useState<{ imported: number; skippedDuplicates: number; skippedInvalid: number } | null>(null);
  const [resolvingMetadata, setResolvingMetadata] = React.useState(false);
  const [resolveProgress, setResolveProgress] = React.useState({ done: 0, total: 0, currentTitle: '' });
  const [batchImportedIds, setBatchImportedIds] = React.useState<number[]>([]);
  const [batchFavorite, setBatchFavorite] = React.useState(false);
  const [batchDiscOnly, setBatchDiscOnly] = React.useState(false);
  const [batchSkipDuplicates, setBatchSkipDuplicates] = React.useState(true);

  // Estado para modal "juego no encontrado por barcode"
  const [notFoundModal, setNotFoundModal] = React.useState(false);
  const [notFoundBarcode, setNotFoundBarcode] = React.useState('');
  const [notFoundTitle, setNotFoundTitle] = React.useState('');
  const [notFoundPlatform, setNotFoundPlatform] = React.useState('');

  const [barcodeFixModal, setBarcodeFixModal] = React.useState(false);
  const [barcodeFixValue, setBarcodeFixValue] = React.useState('');
  const [scanDebugLog, setScanDebugLog] = React.useState('');

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
      clearBarcodeScanLog();
      logBarcodeScan('scan.flow.start', { barcode });
      try {
        await initDatabase();
        const existing = await getGameByBarcode(barcode);
        if (existing) {
          logBarcodeScan('scan.flow.duplicate', { barcode, gameId: existing.id ?? null });
          router.replace('/');
          return;
        }
        const resolved = await resolveMetadata({ barcode });
        logBarcodeScan('scan.flow.resolved', {
          barcode,
          status: resolved.status,
          source: resolved.source,
          title: resolved.title,
          platform: resolved.platform,
          error: resolved.error ?? null,
        });

        if (resolved.status === 'error') {
          setScanDebugLog(formatBarcodeScanLogForDisplay());
          setNotFoundBarcode(barcode);
          setNotFoundTitle('');
          setNotFoundPlatform('');
          setNotFoundModal(true);
          setSaving(false);
          return;
        }

        const newId = await addGame({
          title: resolved.title,
          barcode,
          platform: resolved.platform,
          version: resolved.version,
          releaseYear: resolved.releaseYear,
          genre: resolved.genre,
          developer: resolved.developer,
          publisher: resolved.publisher,
          description: resolved.description,
          rating: resolved.rating,
          franchise: resolved.franchise,
          coverUrl: resolved.coverUrl ?? null,
          headerImageUrl: resolved.headerImageUrl ?? null,
          metadataStatus: resolved.status,
          metadataSource: resolved.source,
          lastError: resolved.error ?? null,
          favorite: favorite ? 1 : 0,
          discOnly: discOnly ? 1 : 0,
          valueCents: resolved.valueCents ?? null,
          valueCurrency: resolved.valueCurrency ?? null,
          valueSource: resolved.valueSource ?? null,
        });
        enqueueCoverThumbCache(newId, resolved.coverUrl ?? null);
        void advanceTourAfterBarcodeScan();
        router.replace('/');
      } catch (error) {
        if (isLikelyDuplicateError(error)) {
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
  const onBarcodeScanned = React.useCallback(
    ({ data }: { data: string }) => {
      const barcode = data.replace(/\s/g, '').replace(/[^0-9A-Za-z]/g, '');
      if (!barcode || saving || mode !== 'barcode' || lastBarcode === barcode || scanLockRef.current) return;

      const assessment = assessBarcode(barcode);
      logBarcodeScan('scan.camera.read', {
        raw: data,
        normalized: barcode,
        assessmentOk: assessment.ok,
        assessmentReason: assessment.ok ? null : assessment.reason,
      });
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
    [lastBarcode, mode, resetBarcodeScanGate, runBarcodeInsertFlow, saving]
  );

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
      const newId = await addGame({
        title: resolved.title, barcode: notFoundBarcode, platform: resolved.platform,
        version: resolved.version, releaseYear: resolved.releaseYear,
        genre: resolved.genre, developer: resolved.developer,
        publisher: resolved.publisher, description: resolved.description,
        rating: resolved.rating, franchise: resolved.franchise,
        coverUrl: resolved.coverUrl ?? null,
        headerImageUrl: resolved.headerImageUrl ?? null,
        metadataStatus: resolved.status, metadataSource: resolved.source,
        lastError: resolved.error ?? null,
        favorite: favorite ? 1 : 0, discOnly: discOnly ? 1 : 0,
        valueCents: resolved.valueCents ?? null,
        valueCurrency: resolved.valueCurrency ?? null,
        valueSource: resolved.valueSource ?? null,
      });
      enqueueCoverThumbCache(newId, resolved.coverUrl ?? null);
      void advanceTourAfterBarcodeScan();
      router.replace('/');
    } catch (error) {
      if (isLikelyDuplicateError(error)) {
        router.replace('/');
        return;
      }
      Alert.alert('Error', 'No se pudo guardar el juego.');
    } finally {
      setSaving(false);
    }
  }, [discOnly, favorite, notFoundBarcode, notFoundPlatform, notFoundTitle, router]);

  // ─── LOTE IA ──────────────────────────────────────────────────────────────────
  const onPickShelfPhoto = React.useCallback(async () => {
    Alert.alert(
      'Capturar/Seleccionar Foto',
      'Elige cómo quieres obtener la foto de tus lomos para subirla a Gemini.',
      [
        {
          text: 'Cámara',
          onPress: async () => {
            try {
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const ImagePicker = require('expo-image-picker') as typeof import('expo-image-picker');
              const permission = await ImagePicker.requestCameraPermissionsAsync();
              if (!permission.granted) {
                Alert.alert('Permiso denegado', 'Se requiere acceso a la cámara para tomar fotos.');
                return;
              }
              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                quality: 0.9,
                allowsEditing: false,
              });
              if (!result.canceled && result.assets?.[0]?.uri) {
                const permissionMedia = await MediaLibrary.requestPermissionsAsync();
                if (permissionMedia.granted) {
                  await MediaLibrary.createAssetAsync(result.assets[0].uri);
                  Alert.alert('Foto guardada', 'La foto se ha guardado en tu carrete/galería. Ahora copia el prompt y abre Gemini para adjuntarla.');
                } else {
                  Alert.alert('Foto capturada', 'La foto se tomó correctamente pero no se pudo guardar en la galería porque denegaste el permiso de fotos.');
                }
              }
            } catch {
              Alert.alert('Error', 'No se pudo abrir la cámara o guardar la foto.');
            }
          }
        },
        {
          text: 'Galería',
          onPress: async () => {
            try {
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const ImagePicker = require('expo-image-picker') as typeof import('expo-image-picker');
              const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (!permission.granted) {
                Alert.alert('Permiso denegado', 'Se requiere acceso a la galería para seleccionar fotos.');
                return;
              }
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                quality: 0.9,
                allowsEditing: false,
              });
              if (!result.canceled && result.assets?.[0]?.uri) {
                Alert.alert('Foto seleccionada', 'Tu foto está en la galería. Copia el prompt y abre Gemini para adjuntarla.');
              }
            } catch {
              Alert.alert('Error', 'No se pudo abrir la galería o denegaste el permiso.');
            }
          }
        },
        { text: 'Cancelar', style: 'cancel' }
      ]
    );
  }, []);

  const onCopyPrompt = React.useCallback(async () => {
    try {
      await Clipboard.setStringAsync(SHELF_BATCH_GEMINI_PROMPT);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2500);
    } catch {
      Alert.alert('Error', 'No se pudo copiar el prompt al portapapeles.');
    }
  }, []);

  const onOpenGemini = React.useCallback(async () => {
    try {
      await Linking.openURL(SHELF_BATCH_GEMINI_URL);
    } catch {
      Alert.alert(
        'No se pudo abrir la web',
        'Copia el prompt y abre Gemini manualmente en tu navegador: https://gemini.google.com/app'
      );
    }
  }, []);

  const onProcessPastedJson = React.useCallback(() => {
    if (!pastedJson.trim()) {
      Alert.alert('Vacío', 'Por favor, pega el JSON de respuesta de Gemini.');
      return;
    }
    try {
      const parsed = parseCatalogImport(pastedJson.trim());
      if (!parsed.rows || parsed.rows.length === 0) {
        Alert.alert(
          'JSON no válido',
          'No se detectaron juegos en el formato correcto. Asegúrate de copiar el JSON tal y como lo devuelve Gemini.'
        );
        return;
      }
      
      const items = parsed.rows.map(row => ({
        title: row.title,
        platform: row.platform,
        selected: true,
      }));
      
      setParsedItems(items);
      setBatchResults(null);
      setBatchImportedIds([]);
      setShelfBatchModal(true);
    } catch (e) {
      Alert.alert(
        'Error de parseo',
        `No se pudo leer el JSON: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }, [pastedJson]);

  const onConfirmBatchImport = React.useCallback(async () => {
    const selectedItems = parsedItems.filter(item => item.selected);
    if (selectedItems.length === 0) {
      Alert.alert('Sin selección', 'Debes seleccionar al menos un juego para importar.');
      return;
    }
    
    setBatchImporting(true);
    
    try {
      await initDatabase();
      const rowsToImport = selectedItems.map(item => ({
        title: item.title,
        platform: item.platform,
        favorite: batchFavorite ? 1 as const : 0 as const,
        discOnly: batchDiscOnly ? 1 as const : 0 as const,
        metadataStatus: 'pending' as const,
        metadataSource: 'import:shelf_batch',
      }));
      
      const res = await importCatalogRows(rowsToImport, {
        skipDuplicates: batchSkipDuplicates,
      });
      
      const importedIds = res.newThumbnails.map(t => t.id);
      setBatchImportedIds(importedIds);
      setBatchResults({
        imported: res.imported,
        skippedDuplicates: res.skippedDuplicates,
        skippedInvalid: res.skippedInvalid,
      });
    } catch {
      Alert.alert('Error de importación', 'Ocurrió un error al guardar los juegos.');
    } finally {
      setBatchImporting(false);
    }
  }, [parsedItems, batchFavorite, batchDiscOnly, batchSkipDuplicates]);

  const onResolveBatchMetadata = React.useCallback(async () => {
    if (batchImportedIds.length === 0) return;
    
    setResolvingMetadata(true);
    setResolveProgress({ done: 0, total: batchImportedIds.length, currentTitle: '' });
    
    try {
      const statusRank = {
        error: 0,
        pending: 1,
        partial: 2,
        resolved: 3,
      };
      const isUnknown = (v: string | null | undefined) =>
        !v || v.trim() === '' || v.toLowerCase().includes('desconocida') || v.toLowerCase().startsWith('juego ');

      let done = 0;
      for (const gameId of batchImportedIds) {
        const game = await getGameById(gameId);
        if (!game) continue;
        
        done++;
        setResolveProgress({ done, total: batchImportedIds.length, currentTitle: game.title });
        
        try {
          const resolved = await resolveMetadata({
            titleHint: game.title,
            platformHint: game.platform,
            fetchCovers: true,
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
            coverUrl: resolved.coverUrl ?? game.coverUrl,
            headerImageUrl: resolved.headerImageUrl ?? game.headerImageUrl,
          };
          
          await updateGameMetadata(gameId, {
            ...merged,
            metadataStatus: deriveMetadataStatusFromGameFields(merged),
            metadataSource: upgrade ? resolved.source : game.metadataSource,
            lastError: resolved.status === 'error' ? (resolved.error ?? game.lastError) : null,
          });
          
          if (merged.coverUrl) {
            await scheduleCoverThumbCache(gameId, merged.coverUrl);
          }
        } catch (err) {
          console.warn(`Error resolviendo metadatos de ${game.title}:`, err);
        }
      }
      
      Alert.alert(
        'Resolución completa',
        `Se han resuelto los metadatos e imágenes para los juegos.`
      );
      setShelfBatchModal(false);
      setPastedJson('');
      router.replace('/');
    } catch {
      Alert.alert('Error', 'No se pudo completar la resolución de metadatos.');
    } finally {
      setResolvingMetadata(false);
      setResolveProgress({ done: 0, total: 0, currentTitle: '' });
    }
  }, [batchImportedIds, router]);

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
      const newId = await addGame({
        title: resolved.title, barcode: null, platform: resolved.platform,
        version: resolved.version, releaseYear: resolved.releaseYear,
        genre: resolved.genre, developer: resolved.developer,
        publisher: resolved.publisher, description: resolved.description,
        rating: resolved.rating, franchise: resolved.franchise,
        coverUrl: resolved.coverUrl ?? null,
        headerImageUrl: resolved.headerImageUrl ?? null,
        metadataStatus: resolved.status, metadataSource: resolved.source,
        lastError: resolved.error ?? null,
        favorite: favorite ? 1 : 0, discOnly: discOnly ? 1 : 0,
        valueCents: resolved.valueCents ?? null,
        valueCurrency: resolved.valueCurrency ?? null,
        valueSource: resolved.valueSource ?? null,
      });
      enqueueCoverThumbCache(newId, resolved.coverUrl ?? null);
      void advanceTourAfterBarcodeScan();
      setRawTitle('');
      router.replace('/');
    } catch (error) {
      if (isLikelyDuplicateError(error)) {
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
        {(['barcode', 'shelf_batch', 'manual'] as Mode[]).map((m) => (
          <Pressable
            key={m}
            onPress={() => setMode(m)}
            style={[styles.segmentBtn, mode === m && styles.segmentBtnActive]}
            accessibilityRole="button"
            accessibilityLabel={m === 'barcode' ? 'Modo barcode' : m === 'shelf_batch' ? 'Modo lote IA' : 'Modo manual'}
            accessibilityHint="Cambia la forma de añadir juegos"
          >
            <Ionicons
              name={m === 'barcode' ? 'barcode-outline' : m === 'shelf_batch' ? 'library-outline' : 'create-outline'}
              size={16}
              color={mode === m ? '#fff' : theme.colors.textDim}
            />
            <Text style={[styles.segmentText, mode === m && styles.segmentTextActive]}>
              {m === 'barcode' ? 'Barcode' : m === 'shelf_batch' ? 'Lote (IA)' : 'Manual'}
            </Text>
          </Pressable>
        ))}
      </View>

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
          <Text style={styles.helpText}>
            Acerca un código EAN/UPC (8, 12 o 13 dígitos). Validamos el código antes de guardar para evitar lecturas
            erróneas.
          </Text>
        </View>
      )}

      {/* Lote IA — Estantería + Gemini */}
      {mode === 'shelf_batch' && (
        <ScrollView contentContainerStyle={styles.shelfContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.shelfHintBox}>
            <Ionicons name="information-circle-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.shelfHint}>
              La imagen se procesa en Gemini, no en CoverLens. No enviamos tu foto a nuestros servidores.
            </Text>
          </View>

          <View style={styles.stepBox}>
            <Text style={styles.stepNum}>Paso 1: Organizar y fotografiar lomos</Text>
            <Text style={styles.stepDesc}>
              Alinea tus juegos en la estantería con los lomos apuntando al frente, bien iluminados.
            </Text>
            
            <Image
              source={require('../../assets/images/shelf-spine-guide.png')}
              style={styles.guideImage}
              resizeMode="contain"
            />
            
            <TouchableOpacity style={styles.stepBtn} onPress={onPickShelfPhoto}>
              <Ionicons name="camera-outline" size={18} color="#fff" />
              <Text style={styles.stepBtnText}>Hacer foto o elegir de la galería</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.stepBox}>
            <Text style={styles.stepNum}>Paso 2: Copiar prompt para Gemini</Text>
            <Text style={styles.stepDesc}>
              Copia la instrucción optimizada que guiará a Gemini para extraer tus juegos en el formato JSON correcto.
            </Text>
            <TouchableOpacity style={[styles.stepBtn, promptCopied && styles.stepBtnSuccess]} onPress={onCopyPrompt}>
              <Ionicons name={promptCopied ? "checkmark-circle-outline" : "copy-outline"} size={18} color="#fff" />
              <Text style={styles.stepBtnText}>{promptCopied ? "¡Prompt Copiado!" : "Copiar prompt al portapapeles"}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.stepBox}>
            <Text style={styles.stepNum}>Paso 3: Abrir Gemini y extraer lista</Text>
            <Text style={styles.stepDesc}>
              Abre Gemini, adjunta tu foto, pega el prompt que has copiado y envíalo. Te devolverá un bloque de texto JSON.
            </Text>
            <TouchableOpacity style={styles.stepBtn} onPress={onOpenGemini}>
              <Ionicons name="sparkles-outline" size={18} color="#fff" />
              <Text style={styles.stepBtnText}>Abrir Gemini (Web/App)</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.stepBox}>
            <Text style={styles.stepNum}>Paso 4: Importar JSON de Gemini</Text>
            <Text style={styles.stepDesc}>
              Copia el bloque JSON que te devuelva Gemini y pégalo aquí debajo para previsualizar e importar.
            </Text>
            <TextInput
              style={styles.jsonInput}
              value={pastedJson}
              onChangeText={setPastedJson}
              placeholder='Pega el JSON devuelto por Gemini aquí... {"app": "CoverLens", ...}'
              placeholderTextColor={theme.colors.textDim}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.jsonActionRow}>
              <TouchableOpacity
                style={[styles.stepBtn, { flex: 1, backgroundColor: '#181818', borderColor: '#333' }]}
                onPress={async () => {
                  try {
                    const text = await Clipboard.getStringAsync();
                    if (text) {
                      setPastedJson(text);
                    } else {
                      Alert.alert('Portapapeles vacío', 'No hay texto en el portapapeles.');
                    }
                  } catch {
                    Alert.alert('Error', 'No se pudo acceder al portapapeles.');
                  }
                }}
              >
                <Ionicons name="clipboard-outline" size={18} color="#fff" />
                <Text style={styles.stepBtnText}>Pegar texto</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.stepBtn, { flex: 1, backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]}
                onPress={onProcessPastedJson}
              >
                <Ionicons name="arrow-forward-outline" size={18} color="#fff" />
                <Text style={styles.stepBtnText}>Procesar JSON</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
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

                {__DEV__ && scanDebugLog ? (
                  <>
                    <Text style={styles.modalLabel}>Log de depuración (Metro)</Text>
                    <Text style={styles.debugLog} selectable>
                      {scanDebugLog}
                    </Text>
                  </>
                ) : null}

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



      {/* Modal de confirmación del lote */}
      <Modal visible={shelfBatchModal} transparent animationType="slide" onRequestClose={() => { if (!batchImporting && !resolvingMetadata) setShelfBatchModal(false); }}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            style={{ width: '100%' }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={[styles.modalBox, { maxHeight: '90%' }]}>
              <Text style={styles.modalTitle}>Importar Lote de Juegos</Text>
              <Text style={styles.modalSubtitle}>Hemos detectado {parsedItems.length} juegos. Selecciona cuáles quieres guardar:</Text>

              {batchResults === null ? (
                <>
                  <ScrollView style={styles.previewListScroll} showsVerticalScrollIndicator={true}>
                    {parsedItems.map((item, index) => (
                      <Pressable
                        key={index}
                        style={styles.previewListItem}
                        onPress={() => {
                          const updated = [...parsedItems];
                          updated[index].selected = !updated[index].selected;
                          setParsedItems(updated);
                        }}
                      >
                        <Ionicons
                          name={item.selected ? "checkbox" : "square-outline"}
                          size={20}
                          color={item.selected ? theme.colors.primary : theme.colors.textDim}
                        />
                        <View style={styles.previewTextCol}>
                          <Text style={styles.previewTitleText}>{item.title}</Text>
                          <Text style={styles.previewPlatformText}>{item.platform || 'Desconocida'}</Text>
                        </View>
                      </Pressable>
                    ))}
                  </ScrollView>

                  {/* Configuraciones del lote */}
                  <View style={styles.batchTogglesBox}>
                    <View style={styles.batchToggleRow}>
                      <Text style={styles.batchToggleLabel}>Solo disco</Text>
                      <Switch
                        value={batchDiscOnly}
                        onValueChange={setBatchDiscOnly}
                        trackColor={{ true: theme.colors.primary }}
                      />
                    </View>
                    <View style={styles.batchToggleRow}>
                      <Text style={styles.batchToggleLabel}>Favorito</Text>
                      <Switch
                        value={batchFavorite}
                        onValueChange={setBatchFavorite}
                        trackColor={{ true: '#ff4268' }}
                      />
                    </View>
                    <View style={styles.batchToggleRow}>
                      <Text style={styles.batchToggleLabel}>Omitir duplicados ya existentes</Text>
                      <Switch
                        value={batchSkipDuplicates}
                        onValueChange={setBatchSkipDuplicates}
                        trackColor={{ true: theme.colors.primary }}
                      />
                    </View>
                  </View>

                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={styles.modalCancelBtn}
                      onPress={() => setShelfBatchModal(false)}
                      disabled={batchImporting}
                    >
                      <Text style={styles.modalCancelText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalConfirmBtn, batchImporting && styles.actionBtnDisabled]}
                      onPress={onConfirmBatchImport}
                      disabled={batchImporting}
                    >
                      {batchImporting ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.modalConfirmText}>
                          Importar {parsedItems.filter(i => i.selected).length} juegos
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                /* Pantalla de Resultados y Resolución de Metadatos */
                <View style={styles.resultBox}>
                  <Ionicons name="checkmark-circle" size={54} color={theme.colors.success} style={{ alignSelf: 'center', marginBottom: 12 }} />
                  <Text style={styles.resultTitle}>¡Importación completada!</Text>
                  
                  <View style={styles.resultDetailsTable}>
                    <View style={styles.resultDetailRow}>
                      <Text style={styles.resultDetailLabel}>Importados correctamente:</Text>
                      <Text style={[styles.resultDetailVal, { color: theme.colors.success }]}>{batchResults.imported}</Text>
                    </View>
                    <View style={styles.resultDetailRow}>
                      <Text style={styles.resultDetailLabel}>Omitidos (duplicados):</Text>
                      <Text style={styles.resultDetailVal}>{batchResults.skippedDuplicates}</Text>
                    </View>
                    <View style={styles.resultDetailRow}>
                      <Text style={styles.resultDetailLabel}>Filas no válidas:</Text>
                      <Text style={styles.resultDetailVal}>{batchResults.skippedInvalid}</Text>
                    </View>
                  </View>

                  {resolvingMetadata ? (
                    <View style={styles.progressContainer}>
                      <Text style={styles.progressLabel}>
                        Resolviendo metadatos e imágenes...
                      </Text>
                      <Text style={styles.progressSubLabel}>
                        {resolveProgress.done} de {resolveProgress.total} - {resolveProgress.currentTitle}
                      </Text>
                      <View style={styles.progressBarBg}>
                        <View
                          style={[
                            styles.progressBarFill,
                            { width: `${(resolveProgress.done / resolveProgress.total) * 100}%` }
                          ]}
                        />
                      </View>
                      <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginTop: 12 }} />
                    </View>
                  ) : (
                    <>
                      <Text style={styles.metaPromptText}>
                        ¿Quieres buscar ahora mismo las carátulas, años de lanzamiento, desarrolladores y descripciones de estos juegos en IGDB/GameplayStores?
                      </Text>
                      <Text style={styles.metaPromptNote}>
                        Se ejecutará en segundo plano. Puede tardar unos momentos según el tamaño del lote.
                      </Text>

                      <View style={[styles.modalActions, { flexDirection: 'column', gap: 10 }]}>
                        <TouchableOpacity
                          style={[styles.actionBtn, { width: '100%' }]}
                          onPress={onResolveBatchMetadata}
                          disabled={batchImportedIds.length === 0}
                        >
                          <Ionicons name="cloud-download-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                          <Text style={styles.actionBtnText}>Resolver metadatos ahora</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                          style={[styles.modalCancelBtn, { width: '100%', borderColor: '#333' }]}
                          onPress={() => {
                            setShelfBatchModal(false);
                            setPastedJson('');
                            router.replace('/');
                          }}
                        >
                          <Text style={styles.modalCancelText}>Terminar (resolver más tarde)</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, paddingHorizontal: 16, paddingTop: 70 },
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
  actionBtn: { backgroundColor: theme.colors.primary, borderRadius: 12, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
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
  modalRaw: { color: '#555', fontSize: 11, fontFamily: 'monospace', marginTop: 4, lineHeight: 16 },
  debugLog: {
    color: '#8ab4ff',
    fontSize: 10,
    fontFamily: 'monospace',
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 10,
    lineHeight: 14,
    marginTop: 4,
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalCancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, borderWidth: 1, borderColor: '#444', alignItems: 'center' },
  modalCancelText: { color: theme.colors.textDim, fontWeight: '600' },
  modalConfirmBtn: { flex: 2, paddingVertical: 13, borderRadius: 10, backgroundColor: theme.colors.primary, alignItems: 'center' },
  modalConfirmText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  
  // Shelf Batch / Lote Styles
  shelfContainer: { gap: 16, paddingBottom: 40 },
  shelfHintBox: { flexDirection: 'row', gap: 8, backgroundColor: 'rgba(0,127,255,0.08)', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: 'rgba(0,127,255,0.2)' },
  shelfHint: { flex: 1, color: theme.colors.textDim, fontSize: 13, lineHeight: 19 },
  stepBox: { backgroundColor: '#0d0d0d', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#222', gap: 10 },
  stepNum: { color: theme.colors.primary, fontSize: 15, fontWeight: '700' },
  stepDesc: { color: theme.colors.textDim, fontSize: 13, lineHeight: 18 },
  stepBtn: { backgroundColor: '#181818', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#333' },
  stepBtnSuccess: { backgroundColor: theme.colors.success, borderColor: theme.colors.success },
  stepBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  guideImage: { width: '100%', height: 180, borderRadius: 8, backgroundColor: '#000', marginVertical: 6 },
  jsonInput: { backgroundColor: '#050505', color: '#fff', borderWidth: 1, borderColor: '#333', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 12, fontFamily: 'monospace', height: 100, textAlignVertical: 'top', marginTop: 6 },
  jsonActionRow: { flexDirection: 'row', gap: 10 },
  previewListScroll: { maxHeight: 220, borderWidth: 1, borderColor: '#222', borderRadius: 8, padding: 8, backgroundColor: '#050505', marginBottom: 14 },
  previewListItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  previewTextCol: { flex: 1 },
  previewTitleText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  previewPlatformText: { color: theme.colors.textDim, fontSize: 12 },
  batchTogglesBox: { gap: 8, marginBottom: 14, backgroundColor: '#0d0d0d', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#222' },
  batchToggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  batchToggleLabel: { color: '#fff', fontSize: 13 },
  resultBox: { paddingVertical: 10 },
  resultTitle: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  resultDetailsTable: { backgroundColor: '#050505', borderRadius: 8, padding: 12, gap: 10, marginBottom: 16, borderWidth: 1, borderColor: '#1c1c1c' },
  resultDetailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resultDetailLabel: { color: theme.colors.textDim, fontSize: 13 },
  resultDetailVal: { color: '#fff', fontSize: 14, fontWeight: '700' },
  metaPromptText: { color: '#fff', fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: 6 },
  metaPromptNote: { color: theme.colors.textDim, fontSize: 11, textAlign: 'center', marginBottom: 20 },
  progressContainer: { alignItems: 'center', marginVertical: 14 },
  progressLabel: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 6 },
  progressSubLabel: { color: theme.colors.textDim, fontSize: 12, marginBottom: 10, textAlign: 'center' },
  progressBarBg: { width: '100%', height: 8, backgroundColor: '#222', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: theme.colors.primary },
});
