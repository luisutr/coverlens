/**
 * Metadatos desde GameplayStores (búsqueda JSON + ficha HTML de producto).
 * El JSON solo trae nombre, portada y precio de listado; descripción, género y año suelen estar en la ficha.
 */
import { barcodeToTitle, fetchFirstGpsProductForBarcode, parseGamePlayStoresName } from '../utils/barcodeToTitle';
import { canonicalizePlatform } from '../utils/platformUtils';
import { MetadataResult, ResolveInput } from './types';
import { findBestGameplayStoresProduct, GpsProduct, pickCoverUrl } from './gameplayStoresCoverProvider';
import { parseGpsEuroPriceString } from './gameplayStoresPriceProvider';
import {
  fetchGameplayStoresProductPageHtml,
  parseGameplayStoresProductPageHtml,
  resolveGpsProductAbsoluteUrl,
} from './gameplayStoresProductPage';

function basePartial(): Pick<MetadataResult, 'status' | 'developer' | 'publisher' | 'rating' | 'franchise'> {
  return {
    status: 'partial',
    developer: null,
    publisher: null,
    rating: null,
    franchise: null,
  };
}

type Enrichment = {
  genre: string | null;
  description: string | null;
  releaseYear: number | null;
  valueCents: number | null;
  valueCurrency: string | null;
};

async function enrichFromGpsProductPage(product: GpsProduct): Promise<Enrichment> {
  const list = parseGpsEuroPriceString(product.price);
  let valueCents = list?.cents ?? null;
  let valueCurrency: string | null = list ? 'EUR' : null;

  const url = resolveGpsProductAbsoluteUrl(product);
  if (!url) {
    return { genre: null, description: null, releaseYear: null, valueCents, valueCurrency };
  }

  const html = await fetchGameplayStoresProductPageHtml(url);
  if (!html) {
    return { genre: null, description: null, releaseYear: null, valueCents, valueCurrency };
  }

  const page = parseGameplayStoresProductPageHtml(html);
  if (page.priceCents != null) {
    valueCents = page.priceCents;
    valueCurrency = page.priceCurrency ?? 'EUR';
  }

  return {
    genre: page.genre,
    description: page.description,
    releaseYear: page.releaseYear,
    valueCents,
    valueCurrency,
  };
}

function buildGpsResult(
  parsed: { title: string; platformHint: string | null; editionHint: string | null },
  platform: string,
  coverUrl: string | null,
  enrichment: Enrichment,
  sourceLabel: string
): MetadataResult {
  const valueBlock =
    enrichment.valueCents != null && enrichment.valueCurrency
      ? {
          valueCents: enrichment.valueCents,
          valueCurrency: enrichment.valueCurrency,
          valueSource: 'gameplaystores' as const,
        }
      : {};

  return {
    title: parsed.title,
    platform,
    version: parsed.editionHint,
    releaseYear: enrichment.releaseYear,
    genre: enrichment.genre,
    description: enrichment.description,
    coverUrl: coverUrl ?? null,
    headerImageUrl: coverUrl ?? null,
    source: sourceLabel,
    ...basePartial(),
    ...valueBlock,
  };
}

export async function resolveFromGameplayStoresMetadata(input: ResolveInput): Promise<MetadataResult | null> {
  const barcode = input.barcode?.trim();
  const hasTitleHint = Boolean(input.titleHint?.trim());

  if (barcode && !hasTitleHint) {
    const product = await fetchFirstGpsProductForBarcode(barcode);
    if (product?.name) {
      const parsed = parseGamePlayStoresName(product.name);
      if (!parsed.title) return null;
      const platform = parsed.platformHint
        ? canonicalizePlatform(parsed.platformHint)
        : 'Plataforma desconocida';
      const coverUrl = pickCoverUrl(product.cover);
      const enrichment = await enrichFromGpsProductPage(product);
      return buildGpsResult(parsed, platform, coverUrl, enrichment, 'gameplaystores');
    }

    const bt = await barcodeToTitle(barcode);
    if (!bt) return null;
    const platform = bt.platformHint ? canonicalizePlatform(bt.platformHint) : 'Plataforma desconocida';
    return {
      title: bt.title,
      platform,
      version: bt.editionHint,
      coverUrl: null,
      headerImageUrl: null,
      releaseYear: null,
      genre: null,
      description: null,
      source: 'gameupc',
      ...basePartial(),
    };
  }

  if (input.titleHint?.trim()) {
    const th = input.titleHint.trim();
    const ph = input.platformHint?.trim();
    if (!ph) return null;

    const product = await findBestGameplayStoresProduct(th, ph, { requireCover: false });
    if (!product?.name) return null;
    const parsed = parseGamePlayStoresName(product.name);
    if (!parsed.title) return null;
    const platform = parsed.platformHint ? canonicalizePlatform(parsed.platformHint) : canonicalizePlatform(ph);
    const coverUrl = pickCoverUrl(product.cover);
    const enrichment = await enrichFromGpsProductPage(product);
    return buildGpsResult(parsed, platform, coverUrl, enrichment, 'gameplaystores');
  }

  return null;
}
