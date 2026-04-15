import { useRouter } from 'expo-router';
import React from 'react';
import { Alert } from 'react-native';
import { addGame, getGames, initDatabase } from '../database/dbConfig';
import { emitCatalogRefresh } from '../services/catalogRefreshBus';
import { advanceTourAfterBarcodeScan } from '../services/firstRunTour';
import { resolveMetadata } from '../services/metadataResolver';
import { enqueueCoverThumbCache } from '../services/storage/coverThumbCache';
import { getApiCredentials } from '../services/credentialsStore';
import { extractShelfGamesWithGemini, extractSingleLomoWithGemini } from '../services/geminiVisionShelf';
import { runOcrVisionOnImage, getOcrEngineAvailability } from '../services/ocrImagePipeline';
import {
  canonicalizePlatform,
  normalizeManualGameSearch,
  splitTitleAndPlatform,
} from '../services/utils/platformUtils';
import { extractBatchCandidatesFromOcr, extractGameInfoFromOcr } from '../services/utils/ocrParser';

export type OcrBatchItem = {
  id: string;
  title: string;
  platform: string;
  confidence: number;
  selected: boolean;
};

type Banner = { message: string; subtitle?: string } | null;

type SingleReview = {
  title: string;
  platform: string;
  rawText: string;
  favorite: 0 | 1;
  discOnly: 0 | 1;
};

type BatchReview = {
  items: OcrBatchItem[];
  favorite: 0 | 1;
  discOnly: 0 | 1;
};

type CatalogOcrFlowContextValue = {
  /** OCR en curso (banner) o guardando desde modales globales */
  ocrFlowBusy: boolean;
  banner: Banner;
  singleReview: SingleReview | null;
  batchReview: BatchReview | null;
  batchSaving: boolean;
  singleSaving: boolean;
  setSingleReview: React.Dispatch<React.SetStateAction<SingleReview | null>>;
  setBatchReview: React.Dispatch<React.SetStateAction<BatchReview | null>>;
  startSingleFromUri: (uri: string, opts: { favorite: boolean; discOnly: boolean }) => Promise<void>;
  startBatchFromUri: (uri: string, opts: { favorite: boolean; discOnly: boolean }) => Promise<void>;
  confirmSingleSave: () => Promise<void>;
  confirmBatchSave: () => Promise<void>;
  dismissSingleReview: () => void;
  dismissBatchReview: () => void;
};

const CatalogOcrFlowContext = React.createContext<CatalogOcrFlowContextValue | null>(null);

function isLikelyDuplicateError(error: unknown) {
  const msg = String(error).toLowerCase();
  return msg.includes('unique') || msg.includes('constraint') || msg.includes('idx_games_barcode_unique');
}

export function CatalogOcrFlowProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [banner, setBanner] = React.useState<Banner>(null);
  const [singleReview, setSingleReview] = React.useState<SingleReview | null>(null);
  const [batchReview, setBatchReview] = React.useState<BatchReview | null>(null);
  const [batchSaving, setBatchSaving] = React.useState(false);
  const [singleSaving, setSingleSaving] = React.useState(false);

  const dismissSingleReview = React.useCallback(() => setSingleReview(null), []);
  const dismissBatchReview = React.useCallback(() => setBatchReview(null), []);

  const startSingleFromUri = React.useCallback(
    async (uri: string, opts: { favorite: boolean; discOnly: boolean }) => {
      const { canNative, canCloud, canGemini } = await getOcrEngineAvailability();
      if (!canNative && !canCloud && !canGemini) {
        Alert.alert(
          'Configura visión en Ajustes',
          'Para «OCR lomo» sin ML Kit: añade una API key de Gemini (Google AI Studio, capa gratuita Flash) o de OCR.space en Ajustes → APIs de metadatos.'
        );
        return;
      }
      setBanner({
        message: 'Procesando imagen del lomo',
        subtitle: canGemini
          ? 'Volviendo al catálogo. Usando Gemini (visión); en unos segundos podrás revisar.'
          : 'Volviendo al catálogo. En unos segundos podrás revisar el texto detectado.',
      });
      router.replace('/');
      try {
        const creds = await getApiCredentials();
        if (creds.geminiApiKey.trim()) {
          const r = await extractSingleLomoWithGemini(uri, creds.geminiApiKey);
          setBanner(null);
          setSingleReview({
            title: r.title,
            platform: r.platform,
            rawText: r.rawText,
            favorite: opts.favorite ? 1 : 0,
            discOnly: opts.discOnly ? 1 : 0,
          });
          return;
        }
        const text = await runOcrVisionOnImage(uri);
        const parsed = extractGameInfoFromOcr(text);
        setBanner(null);
        setSingleReview({
          title: parsed.title,
          platform: parsed.platform ?? '',
          rawText: parsed.rawText,
          favorite: opts.favorite ? 1 : 0,
          discOnly: opts.discOnly ? 1 : 0,
        });
      } catch (e) {
        setBanner(null);
        const msg = String(e);
        if (msg.includes('ocr_no_engine')) {
          Alert.alert(
            'Configura OCR en Ajustes',
            'Añade tu API key de OCR.space en Ajustes → APIs de metadatos o usa un build con ML Kit.'
          );
        } else if (msg.includes('ocr_space_file_too_large')) {
          Alert.alert(
            'Imagen demasiado grande',
            'La foto supera el límite recomendado para OCR free incluso tras comprimir. Acércate más o haz una foto más cerrada.'
          );
        } else if (msg.includes('gemini_')) {
          Alert.alert('Error Gemini', `${msg.slice(0, 220)}`);
        } else {
          Alert.alert('Error OCR', `No se pudo procesar la imagen: ${msg.slice(0, 100)}`);
        }
      }
    },
    [router]
  );

  const startBatchFromUri = React.useCallback(
    async (uri: string, opts: { favorite: boolean; discOnly: boolean }) => {
      const { canNative, canCloud, canGemini } = await getOcrEngineAvailability();
      if (!canNative && !canCloud && !canGemini) {
        Alert.alert(
          'Configura visión en Ajustes',
          'Para lote de estantería sin ML Kit: añade una API key de Gemini (Google AI Studio, Flash gratuito) u OCR.space en Ajustes → APIs de metadatos.'
        );
        return;
      }
      setBanner({
        message: 'Analizando lomos en la imagen',
        subtitle: canGemini
          ? 'Volviendo al catálogo. Con Gemini (visión) suele ir mejor en estanterías; puede tardar un poco.'
          : 'Volviendo al catálogo. Puede tardar un poco si usas OCR en la nube.',
      });
      router.replace('/');
      try {
        const creds = await getApiCredentials();
        let parsed: { title: string; platform: string | null; confidence: number }[];
        if (creds.geminiApiKey.trim()) {
          const games = await extractShelfGamesWithGemini(uri, creds.geminiApiKey);
          parsed = games.map((g) => ({
            title: g.title,
            platform: g.platform || null,
            confidence: g.confidence,
          }));
        } else {
          const text = await runOcrVisionOnImage(uri);
          parsed = extractBatchCandidatesFromOcr(text, 24);
        }
        setBanner(null);
        if (parsed.length === 0) {
          Alert.alert('Sin candidatos', 'No se detectaron juegos claros. Prueba con más luz o una foto más cercana.');
          return;
        }
        setBatchReview({
          items: parsed.map((entry, idx) => {
            const title = (entry.title ?? '').trim();
            const platform = (entry.platform ?? '').trim();
            return {
              id: `${Date.now()}-${idx}`,
              title,
              platform,
              confidence: entry.confidence,
              selected: Boolean(title.length >= 2 && platform.length >= 1),
            };
          }),
          favorite: opts.favorite ? 1 : 0,
          discOnly: opts.discOnly ? 1 : 0,
        });
      } catch (e) {
        setBanner(null);
        const msg = String(e);
        if (msg.includes('ocr_space_file_too_large')) {
          Alert.alert(
            'Imagen demasiado grande',
            'La foto de estantería supera el límite recomendado para OCR free incluso tras comprimir. Haz una foto más cerrada.'
          );
        } else if (msg.includes('gemini_')) {
          Alert.alert('Error Gemini (lote)', `${msg.slice(0, 220)}`);
        } else {
          Alert.alert('Error OCR lote', `No se pudo procesar la imagen: ${msg.slice(0, 120)}`);
        }
      }
    },
    [router]
  );

  const confirmSingleSave = React.useCallback(async () => {
    if (!singleReview?.title.trim()) {
      Alert.alert('Falta el titulo', 'Escribe o corrige el titulo antes de buscar.');
      return;
    }
    setSingleSaving(true);
    try {
      await initDatabase();
      const resolved = await resolveMetadata({
        titleHint: singleReview.title.trim(),
        platformHint: singleReview.platform.trim() || null,
      });
      const newId = await addGame({
        title: resolved.title,
        barcode: null,
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
        favorite: singleReview.favorite,
        discOnly: singleReview.discOnly,
        valueCents: resolved.valueCents ?? null,
        valueCurrency: resolved.valueCurrency ?? null,
        valueSource: resolved.valueSource ?? null,
      });
      enqueueCoverThumbCache(newId, resolved.coverUrl ?? null);
      void advanceTourAfterBarcodeScan();
      setSingleReview(null);
      emitCatalogRefresh();
    } catch (error) {
      if (isLikelyDuplicateError(error)) {
        setSingleReview(null);
        emitCatalogRefresh();
        return;
      }
      Alert.alert('Error', 'No se pudo guardar el juego.');
    } finally {
      setSingleSaving(false);
    }
  }, [singleReview]);

  const confirmBatchSave = React.useCallback(async () => {
    if (!batchReview) return;
    const snapshot = batchReview.items.map((item) => ({
      ...item,
      title: item.title.trim(),
      platform: item.platform.trim(),
    }));
    const selected = snapshot.filter((item) => item.selected && item.title.length >= 2);
    if (selected.length === 0) {
      Alert.alert('Sin juegos seleccionados', 'Marca al menos un candidato con título (2+ caracteres) para guardar.');
      return;
    }

    setBatchSaving(true);
    const failureNotes: string[] = [];
    const { favorite, discOnly } = batchReview;
    try {
      await initDatabase();
      const current = await getGames();
      const existing = new Set(
        current.map((g) => `${g.title.trim().toLowerCase()}|${canonicalizePlatform(g.platform).toLowerCase()}`)
      );

      let added = 0;
      let skipped = 0;
      let failed = 0;

      const catalogDuplicateKey = (title: string, platform: string) =>
        `${title.trim().toLowerCase()}|${canonicalizePlatform(platform).toLowerCase()}`;

      for (const candidate of selected) {
        let titleHint = candidate.title;
        let platformHint: string | null = candidate.platform ? canonicalizePlatform(candidate.platform) : null;

        if (!platformHint && titleHint) {
          const combined = normalizeManualGameSearch(titleHint) || titleHint;
          const split = splitTitleAndPlatform(combined);
          if (split.platformHint) {
            titleHint = split.titleHint;
            platformHint = canonicalizePlatform(split.platformHint);
          }
        }

        if (platformHint?.trim()) {
          const preKey = catalogDuplicateKey(titleHint, platformHint);
          if (existing.has(preKey)) {
            skipped++;
            continue;
          }
        }

        try {
          const resolved = await resolveMetadata({
            titleHint,
            platformHint,
          });
          const safeTitle = (resolved.title?.trim() || titleHint || 'Juego').trim();
          const safePlatform = (resolved.platform?.trim() || platformHint?.trim() || 'Plataforma desconocida').trim();
          const postKey = catalogDuplicateKey(safeTitle, safePlatform);
          if (existing.has(postKey)) {
            skipped++;
            continue;
          }
          const newId = await addGame({
            title: safeTitle,
            barcode: null,
            platform: safePlatform,
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
            favorite,
            discOnly,
            valueCents: resolved.valueCents ?? null,
            valueCurrency: resolved.valueCurrency ?? null,
            valueSource: resolved.valueSource ?? null,
          });
          enqueueCoverThumbCache(newId, resolved.coverUrl ?? null);
          existing.add(postKey);
          added++;
        } catch (err) {
          failed++;
          const msg = String(err).slice(0, 120);
          failureNotes.push(`• ${candidate.title.slice(0, 28)}: ${msg}`);
          if (__DEV__) console.warn('[OCR lote] addGame', candidate.title, err);
        }
      }

      let body = `Añadidos: ${added}\nOmitidos por duplicado: ${skipped}\nFallidos: ${failed}`;
      if (failureNotes.length > 0) {
        body += `\n\nDetalle (máx. 4):\n${failureNotes.slice(0, 4).join('\n')}`;
      }
      if (added === 0 && skipped > 0 && failed === 0) {
        body += '\n\nSi ya estaban en la colección, no se vuelven a crear (mismo título + plataforma).';
      }
      setBatchReview(null);
      Alert.alert('Lote OCR completado', body);
      emitCatalogRefresh();
    } finally {
      setBatchSaving(false);
    }
  }, [batchReview]);

  const ocrFlowBusy = Boolean(
    banner || singleSaving || batchSaving || singleReview !== null || batchReview !== null
  );

  const value = React.useMemo(
    () => ({
      ocrFlowBusy,
      banner,
      singleReview,
      batchReview,
      batchSaving,
      singleSaving,
      setSingleReview,
      setBatchReview,
      startSingleFromUri,
      startBatchFromUri,
      confirmSingleSave,
      confirmBatchSave,
      dismissSingleReview,
      dismissBatchReview,
    }),
    [
      ocrFlowBusy,
      banner,
      singleReview,
      batchReview,
      batchSaving,
      singleSaving,
      startSingleFromUri,
      startBatchFromUri,
      confirmSingleSave,
      confirmBatchSave,
      dismissSingleReview,
      dismissBatchReview,
    ]
  );

  return <CatalogOcrFlowContext.Provider value={value}>{children}</CatalogOcrFlowContext.Provider>;
}

export function useCatalogOcrFlow(): CatalogOcrFlowContextValue {
  const ctx = React.useContext(CatalogOcrFlowContext);
  if (!ctx) throw new Error('useCatalogOcrFlow debe usarse dentro de CatalogOcrFlowProvider');
  return ctx;
}
