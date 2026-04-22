import { loadCoverSourcePreferences } from './coverSourcePreferences';
import { loadMetadataSourcePreferences } from './metadataSourcePreferences';
import { mergeMetadataLayers, isUsableMetadataLayer } from './metadataLayerMerge';
import { resolvePreferredCoverWithSource } from './coverPreferenceResolver';
import { resolveFromGameplayStoresMetadata } from './providers/gameplayStoresMetadataProvider';
import { resolveFromIgdb } from './providers/igdbProvider';
import { resolveFromScreenScraper } from './providers/screenScraperProvider';
import { finalizeMetadataResult } from './utils/metadataCompleteness';
import { canonicalizePlatform } from './utils/platformUtils';
import { MetadataResult, ResolveInput } from './providers/types';
import type { CoverSourcePreferences } from './coverSourcePreferences';

function headerPatchFromProviderCover(coverUrl: string | null | undefined): Pick<MetadataResult, 'headerImageUrl'> | object {
  const u = coverUrl?.trim() ?? '';
  if (/^https?:\/\//i.test(u)) return { headerImageUrl: u };
  return {};
}

function omitImageFields(r: MetadataResult): Omit<MetadataResult, 'coverUrl' | 'headerImageUrl'> & {
  coverUrl?: undefined;
  headerImageUrl?: undefined;
} {
  const { coverUrl: _c, headerImageUrl: _h, ...rest } = r;
  return rest;
}

function emptyRichMetadata(): Pick<
  MetadataResult,
  'version' | 'releaseYear' | 'genre' | 'developer' | 'publisher' | 'description' | 'rating' | 'franchise'
> {
  return {
    version: null,
    releaseYear: null,
    genre: null,
    developer: null,
    publisher: null,
    description: null,
    rating: null,
    franchise: null,
  };
}

export async function resolveMetadata(input: ResolveInput): Promise<MetadataResult> {
  const fetchCovers = input.fetchCovers !== false;
  const [coverPrefs, metaPrefs] = await Promise.all([
    fetchCovers ? loadCoverSourcePreferences() : Promise.resolve(undefined as CoverSourcePreferences | undefined),
    loadMetadataSourcePreferences(),
  ]);

  let working: ResolveInput = { ...input };
  let merged: MetadataResult | null = null;
  let lastScreenScraperCover: string | null = null;

  for (const id of metaPrefs.order) {
    if (!metaPrefs.enabled[id]) continue;

    let layer: MetadataResult | null = null;
    if (id === 'gameplaystores') {
      layer = await resolveFromGameplayStoresMetadata(working);
    } else if (id === 'igdb') {
      layer = await resolveFromIgdb(working);
    } else if (id === 'screenscraper') {
      layer = await resolveFromScreenScraper(working);
      if (layer?.coverUrl?.trim()) lastScreenScraperCover = layer.coverUrl.trim();
    }

    if (!isUsableMetadataLayer(layer) || !layer) continue;

    merged = mergeMetadataLayers(merged, layer);
    working = {
      ...working,
      titleHint: merged.title,
      platformHint: merged.platform,
    };
  }

  if (!merged) {
    const userTitle = (input.titleHint ?? '').trim();
    const userPlatform = input.platformHint ?? null;
    const fallbackTitle = userTitle || (input.barcode ? `Juego ${input.barcode}` : 'Juego desconocido');

    if (fetchCovers && coverPrefs && userTitle) {
      const { url } = await resolvePreferredCoverWithSource(userTitle, userPlatform, null, coverPrefs);
      if (url) {
        return finalizeMetadataResult({
          title: fallbackTitle,
          platform: userPlatform?.trim() || 'Plataforma desconocida',
          ...emptyRichMetadata(),
          status: 'partial',
          source: 'cover_fallback',
          coverUrl: url,
          headerImageUrl: url,
          error: undefined,
        });
      }
    }

    /** Título + plataforma escritos pero ninguna fuente devolvió capa (p. ej. GPS sin coincidencia): al menos ficha mínima. */
    if (userTitle && userPlatform?.trim()) {
      return finalizeMetadataResult({
        title: userTitle,
        platform: canonicalizePlatform(userPlatform.trim()),
        ...emptyRichMetadata(),
        status: 'partial',
        source: 'local',
        coverUrl: null,
        headerImageUrl: null,
        error: undefined,
      });
    }

    return {
      title: fallbackTitle,
      platform: userPlatform?.trim() || 'Plataforma desconocida',
      ...emptyRichMetadata(),
      status: 'error',
      source: 'local',
      error: 'no_metadata_sources',
    };
  }

  let withImages: MetadataResult = { ...merged };
  if (lastScreenScraperCover && !/^https?:\/\//i.test(withImages.headerImageUrl?.trim() ?? '')) {
    withImages = { ...withImages, ...headerPatchFromProviderCover(lastScreenScraperCover) };
  }

  if (!fetchCovers) {
    const finalized = finalizeMetadataResult(withImages);
    return {
      ...omitImageFields(finalized),
      status: finalized.status,
      source: finalized.source,
      error: finalized.error,
    } as unknown as MetadataResult;
  }

  if (coverPrefs) {
    const { url } = await resolvePreferredCoverWithSource(
      withImages.title,
      withImages.platform,
      withImages.coverUrl,
      coverPrefs
    );
    withImages = {
      ...withImages,
      coverUrl: url ?? withImages.coverUrl ?? null,
    };
  }

  return finalizeMetadataResult(withImages);
}
