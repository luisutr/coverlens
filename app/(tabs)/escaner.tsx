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
} from 'react-native';
import { theme } from '../../constants/theme';
import { addGame, getGameByBarcode, initDatabase } from '../../database/dbConfig';
import { resolveMetadata } from '../../services/metadataResolver';
import { enqueueCoverThumbCache } from '../../services/storage/coverThumbCache';
import { assessBarcode } from '../../services/utils/barcodeValidation';
import {
  canonicalizePlatform,
  normalizeManualGameSearch,
  splitTitleAndPlatform,
} from '../../services/utils/platformUtils';
import { advanceTourAfterBarcodeScan } from '../../services/firstRunTour';
import { extractGameInfoFromOcr } from '../../services/utils/ocrParser';

type Mode = 'barcode' | 'ocr' | 'manual';

// Importamos MLKit OCR de forma dinámica para no romper si aún no está instalado
let recognizeText: ((path: string) => Promise<{ text: string }>) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mlkit = require('@infinitered/react-native-mlkit-text-recognition');
  recognizeText = mlkit.recognizeText;
} catch {
  recognizeText = null;
}

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

  // OCR — estado del modal de confirmación
  const [ocrProcessing, setOcrProcessing] = React.useState(false);
  const [ocrModal, setOcrModal] = React.useState(false);
  const [ocrTitle, setOcrTitle] = React.useState('');
  const [ocrPlatform, setOcrPlatform] = React.useState('');
  const [ocrRawText, setOcrRawText] = React.useState('');

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

  // ─── OCR ─────────────────────────────────────────────────────────────────────
  const onScanWithOcr = React.useCallback(async () => {
    if (!recognizeText) {
      Alert.alert(
        'OCR no disponible',
        'Hace falta un build de desarrollo con el módulo nativo: en el PC ejecuta npx expo run:android (o run:ios). Expo Go no incluye ML Kit.'
      );
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ImagePicker = require('expo-image-picker') as typeof import('expo-image-picker');
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images' as const],
        quality: 0.85,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets[0]) return;

      setOcrProcessing(true);
      const { text } = await recognizeText(result.assets[0].uri);
      const parsed = extractGameInfoFromOcr(text);

      setOcrTitle(parsed.title);
      setOcrPlatform(parsed.platform ?? '');
      setOcrRawText(parsed.rawText);
      setOcrModal(true);
    } catch (e) {
      Alert.alert('Error OCR', `No se pudo procesar la imagen: ${String(e).slice(0, 100)}`);
    } finally {
      setOcrProcessing(false);
    }
  }, []);

  const onConfirmOcr = React.useCallback(async () => {
    if (!ocrTitle.trim()) {
      Alert.alert('Falta el titulo', 'Escribe o corrige el titulo antes de buscar.');
      return;
    }
    setOcrModal(false);
    setSaving(true);
    try {
      await initDatabase();
      const resolved = await resolveMetadata({
        titleHint: ocrTitle.trim(),
        platformHint: ocrPlatform.trim() || null,
      });
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
  }, [discOnly, favorite, ocrPlatform, ocrTitle, router]);

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
        {(['barcode', 'ocr', 'manual'] as Mode[]).map((m) => (
          <Pressable
            key={m}
            onPress={() => setMode(m)}
            style={[styles.segmentBtn, mode === m && styles.segmentBtnActive]}
            accessibilityRole="button"
            accessibilityLabel={m === 'barcode' ? 'Modo barcode' : m === 'ocr' ? 'Modo portada OCR' : 'Modo manual'}
            accessibilityHint="Cambia la forma de añadir juegos"
          >
            <Ionicons
              name={m === 'barcode' ? 'barcode-outline' : m === 'ocr' ? 'camera-outline' : 'create-outline'}
              size={16}
              color={mode === m ? '#fff' : theme.colors.textDim}
            />
            <Text style={[styles.segmentText, mode === m && styles.segmentTextActive]}>
              {m === 'barcode' ? 'Barcode' : m === 'ocr' ? 'Portada OCR' : 'Manual'}
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

      {/* OCR — Portada / Canto */}
      {mode === 'ocr' && (
        <View style={styles.ocrContainer}>
          <View style={styles.ocrHintBox}>
            <Ionicons name="information-circle-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.ocrHint}>
              Fotografía el{' '}
              <Text style={{ color: '#fff', fontWeight: '700' }}>canto del juego</Text>
              {' '}(el lateral estrecho) para mejores resultados. El título y la plataforma suelen estar limpios ahí.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.actionBtn, ocrProcessing && styles.actionBtnDisabled]}
            onPress={onScanWithOcr}
            disabled={ocrProcessing}
            accessibilityRole="button"
            accessibilityLabel="Hacer foto y reconocer texto"
            accessibilityHint="Abre la cámara para extraer título y plataforma por OCR"
          >
            {ocrProcessing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="camera" size={20} color="#fff" />
                <Text style={styles.actionBtnText}>Hacer foto y reconocer texto</Text>
              </>
            )}
          </TouchableOpacity>

          {!recognizeText && (
            <Text style={styles.ocrWarning}>
              ⚠ OCR requiere build nativo. Instala la librería y ejecuta{' '}
              <Text style={{ fontFamily: 'monospace' }}>npx expo run:ios</Text>.
            </Text>
          )}
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

      {/* Modal de confirmación OCR */}
      <Modal visible={ocrModal} transparent animationType="slide" onRequestClose={() => setOcrModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Confirmar datos OCR</Text>
            <Text style={styles.modalSubtitle}>Corrige si algo no está bien antes de buscar en IGDB.</Text>

            <Text style={styles.modalLabel}>Título detectado</Text>
            <TextInput
              style={styles.modalInput}
              value={ocrTitle}
              onChangeText={setOcrTitle}
              placeholderTextColor={theme.colors.textDim}
              placeholder="Título del juego"
            />

            <Text style={styles.modalLabel}>Plataforma detectada</Text>
            <TextInput
              style={styles.modalInput}
              value={ocrPlatform}
              onChangeText={setOcrPlatform}
              placeholderTextColor={theme.colors.textDim}
              placeholder="Ej: PlayStation 4, Xbox 360..."
            />

            {ocrRawText ? (
              <>
                <Text style={styles.modalLabel}>Texto crudo del OCR</Text>
                <Text style={styles.modalRaw} numberOfLines={4}>{ocrRawText}</Text>
              </>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setOcrModal(false)}
                accessibilityRole="button"
                accessibilityLabel="Cancelar OCR"
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={onConfirmOcr}
                accessibilityRole="button"
                accessibilityLabel="Confirmar OCR y buscar"
              >
                <Text style={styles.modalConfirmText}>Buscar en IGDB</Text>
              </TouchableOpacity>
            </View>
          </View>
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
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalCancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, borderWidth: 1, borderColor: '#444', alignItems: 'center' },
  modalCancelText: { color: theme.colors.textDim, fontWeight: '600' },
  modalConfirmBtn: { flex: 2, paddingVertical: 13, borderRadius: 10, backgroundColor: theme.colors.primary, alignItems: 'center' },
  modalConfirmText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
