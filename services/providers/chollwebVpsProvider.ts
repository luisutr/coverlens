/**
 * Proveedor VPS covers.cholloweb.es
 *
 * API estática + browse:
 *   GET /games/platforms.json              → listado de plataformas
 *   GET /api/browse.php?q=...&platform=... → búsqueda paginada
 *   GET /api/search.php?barcode=...        → búsqueda por EAN/UPC (O(1))
 *   GET /games/{platformSlug}/{slug}.json  → ficha completa
 *
 * Portadas propias en: https://covers.cholloweb.es/covers/{platform}/{slug}.jpg|webp
 * El endpoint browse devuelve coverUrl apuntando directamente al VPS.
 */

import { MetadataResult, ResolveInput } from './types';
import { logBarcodeScan } from '../debug/barcodeScanLog';
import { canonicalizePlatform } from '../utils/platformUtils';
import { getGtinLookupVariants } from '../utils/barcodeValidation';
import { barcodeToTitle, getBarcodeVariants } from '../utils/barcodeToTitle';

const BASE_URL = 'https://covers.cholloweb.es';

// ── Mapeo plataforma canónica → slug del VPS ──────────────────────────────────

const CANONICAL_TO_VPS_SLUG: Record<string, string> = {
  'PlayStation 5': 'ps5',
  'PlayStation 4': 'ps4',
  'PlayStation 3': 'ps3',
  'PlayStation 2': 'ps2',
  PlayStation: 'psx',
  PSP: 'psp',
  'PS Vita': 'psvita',
  Switch: 'switch',
  'Switch 2': 'switch2',
  'Wii U': 'wiiu',
  Wii: 'wii',
  'Nintendo 3DS': '3ds',
  'Nintendo DS': 'nds',
  'Game Boy Advance': 'gba',
  'Game Boy Color': 'gbc',
  'Game Boy': 'gb',
  GameCube: 'gc',
  'Nintendo 64': 'n64',
  SNES: 'snes',
  NES: 'nes',
  'Xbox Series X': 'xbsx',
  'Xbox One': 'xboxone',
  'Xbox 360': 'x360',
  Xbox: 'xbox',
  'Mega Drive': 'md',
  Saturn: 'saturn',
  Dreamcast: 'dc',
  'Master System': 'sms',
  'Game Gear': 'gg',
  PC: 'pc',
};

export function canonicalToVpsSlug(platform: string): string | null {
  const canonical = canonicalizePlatform(platform);
  return CANONICAL_TO_VPS_SLUG[canonical] ?? null;
}

// ── Tipos de respuesta del VPS ────────────────────────────────────────────────

export type VpsBrowseResult = {
  slug: string;
  title: string;
  platform: string;
  platformSlug: string;
  coverUrl: string | null;
  marketValueEUR: number | null;
  rating: number | null;
  castilianText: boolean;
  castilianVoice: boolean;
  physicalRelease: boolean | null;
};

export type VpsBrowseResponse = {
  query: string | null;
  platform: string | null;
  total: number;
  page: number;
  limit: number;
  pages: number;
  results: VpsBrowseResult[];
};

export type VpsGameDetail = {
  slug: string;
  title: string;
  platform: string;
  platformSlug: string;
  version: string | null;
  barcode: string | null;
  genre: string | null;
  developer: string | null;
  publisher: string | null;
  releaseYear: number | null;
  description: string | null;
  rating: number | null;
  coverPath: string | null;
  coverUrl: string | null;
  marketValue: number | null;
  igdbId: number | null;
};

// ── Tipos de respuesta de search.php ─────────────────────────────────────────

type VpsSearchResult = {
  score: number;
  slug: string;
  title: string;
  platform: string;
  platformSlug: string;
  coverPath: string | null;
  jsonUrl: string;
};

type VpsSearchResponse = {
  barcode?: string;
  count: number;
  results: VpsSearchResult[];
};

export function collectVpsBarcodeVariants(barcode: string): string[] {
  const seen = new Set<string>();
  for (const variant of [...getGtinLookupVariants(barcode), ...getBarcodeVariants(barcode)]) {
    const v = variant.trim();
    if (v && !seen.has(v)) seen.add(v);
  }
  return [...seen];
}

// ── Funciones de fetch ────────────────────────────────────────────────────────

export async function searchChollwebVps(
  query: string,
  platformSlug?: string | null,
  limit = 5
): Promise<VpsBrowseResponse | null> {
  try {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    if (platformSlug) params.set('platform', platformSlug);
    const res = await fetch(`${BASE_URL}/api/browse.php?${params}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as VpsBrowseResponse;
  } catch {
    return null;
  }
}

export async function getChollwebVpsDetail(
  platformSlug: string,
  slug: string
): Promise<VpsGameDetail | null> {
  try {
    const res = await fetch(`${BASE_URL}/games/${platformSlug}/${slug}.json`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as VpsGameDetail;
  } catch {
    return null;
  }
}

async function searchChollwebVpsByBarcodeOnce(
  barcode: string
): Promise<VpsSearchResult | null> {
  try {
    const params = new URLSearchParams({ barcode });
    const res = await fetch(`${BASE_URL}/api/search.php?${params}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      logBarcodeScan('vps.search.http_error', { barcode, status: res.status });
      return null;
    }
    const data = (await res.json()) as VpsSearchResponse;
    const hit = data.results?.[0] ?? null;
    logBarcodeScan(hit ? 'vps.search.hit' : 'vps.search.miss', {
      barcode,
      count: data.count ?? 0,
      slug: hit?.slug,
    });
    return hit;
  } catch (error) {
    logBarcodeScan('vps.search.exception', { barcode, error: String(error).slice(0, 80) });
    return null;
  }
}

export async function searchChollwebVpsByBarcode(
  barcode: string
): Promise<VpsSearchResult | null> {
  const variants = collectVpsBarcodeVariants(barcode);
  logBarcodeScan('vps.search.start', { barcode, variants });
  for (const variant of variants) {
    const hit = await searchChollwebVpsByBarcodeOnce(variant);
    if (hit) {
      if (variant !== barcode) {
        logBarcodeScan('vps.search.hit_variant', { scanned: barcode, matched: variant });
      }
      return hit;
    }
  }
  return null;
}

// ── Selección del mejor resultado ─────────────────────────────────────────────

function titleSimilarity(a: string, b: string): number {
  const na = a.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const nb = b.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  const wordsA = new Set(na.split(/\s+/));
  const wordsB = nb.split(/\s+/);
  const common = wordsB.filter((w) => wordsA.has(w)).length;
  return common / Math.max(wordsA.size, wordsB.length);
}

function pickBestResult(
  results: VpsBrowseResult[],
  titleHint: string
): VpsBrowseResult | null {
  if (!results.length) return null;
  const scored = results.map((r) => ({
    r,
    score: titleSimilarity(r.title, titleHint),
  }));
  scored.sort((a, b) => b.score - a.score);
  if (scored[0]!.score < 0.4) return null;
  return scored[0]!.r;
}

type ResolvedBrowseHit = {
  slug: string;
  platformSlug: string;
  title: string;
  coverUrl: string | null;
  rating: number | null;
};

async function resolveBrowseHit(
  titleHint: string,
  platformHint: string | null | undefined
): Promise<ResolvedBrowseHit | null> {
  const platformSlug = platformHint ? canonicalToVpsSlug(platformHint) : null;
  logBarcodeScan('vps.browse.start', { titleHint, platformHint, platformSlug });
  const data = await searchChollwebVps(titleHint, platformSlug, 5);
  if (!data?.results?.length) {
    logBarcodeScan('vps.browse.no_results', { titleHint, platformSlug });
    return null;
  }
  const best = pickBestResult(data.results, titleHint);
  if (!best) {
    logBarcodeScan('vps.browse.low_similarity', {
      titleHint,
      candidates: data.results.map((r) => r.title).slice(0, 3),
    });
    return null;
  }
  logBarcodeScan('vps.browse.hit', {
    titleHint,
    slug: best.slug,
    platformSlug: best.platformSlug,
    matchedTitle: best.title,
  });
  return {
    slug: best.slug,
    platformSlug: best.platformSlug,
    title: best.title,
    coverUrl: best.coverUrl ?? null,
    rating: best.rating,
  };
}

async function buildMetadataFromResolvedHit(hit: ResolvedBrowseHit): Promise<MetadataResult> {
  const detail = await getChollwebVpsDetail(hit.platformSlug, hit.slug);
  const coverUrl =
    hit.coverUrl ?? (detail?.coverPath ? `${BASE_URL}/${detail.coverPath}` : null);
  const platform = canonicalizePlatform(detail?.platform ?? hit.platformSlug);
  const isResolved = Boolean(
    (detail?.genre || hit.rating != null) && (detail?.developer || detail?.publisher)
  );

  return {
    title: detail?.title ?? hit.title,
    platform,
    version: detail?.version ?? null,
    releaseYear: detail?.releaseYear ?? null,
    genre: detail?.genre ?? null,
    developer: detail?.developer ?? null,
    publisher: detail?.publisher ?? null,
    description: detail?.description ?? null,
    rating: detail?.rating ?? hit.rating ?? null,
    franchise: null,
    coverUrl,
    headerImageUrl: coverUrl,
    status: isResolved ? 'resolved' : 'partial',
    source: 'cholloweb',
  };
}

// ── Portada: URL directa del VPS (browse) ────────────────────────────────────

export async function resolveCoverFromChollwebVps(
  title: string,
  platformHint: string | null | undefined
): Promise<string | null> {
  const t = title.trim();
  if (!t) return null;

  const slug = platformHint ? canonicalToVpsSlug(platformHint) : null;
  const data = await searchChollwebVps(t, slug, 5);
  if (!data?.results?.length) return null;

  const best = pickBestResult(data.results, t);
  return best?.coverUrl ?? null;
}

// ── Metadatos completos ───────────────────────────────────────────────────────

export async function resolveFromChollwebVps(
  input: ResolveInput
): Promise<MetadataResult | null> {
  const titleHint = input.titleHint?.trim();
  const barcode = input.barcode?.trim();

  if (titleHint) {
    const browseHit = await resolveBrowseHit(titleHint, input.platformHint?.trim() ?? null);
    if (!browseHit) return null;
    return buildMetadataFromResolvedHit(browseHit);
  }

  if (!barcode) return null;

  logBarcodeScan('vps.barcode_route.start', { barcode });
  const searchHit = await searchChollwebVpsByBarcode(barcode);
  if (searchHit) {
    return buildMetadataFromResolvedHit({
      slug: searchHit.slug,
      platformSlug: searchHit.platformSlug,
      title: searchHit.title,
      coverUrl: searchHit.coverPath ? `${BASE_URL}/${searchHit.coverPath}` : null,
      rating: null,
    });
  }

  logBarcodeScan('vps.barcode_route.search_miss', { barcode });
  const fromTitle = await barcodeToTitle(barcode);
  if (fromTitle?.title) {
    logBarcodeScan('vps.barcode_route.title_fallback', {
      barcode,
      title: fromTitle.title,
      platformHint: fromTitle.platformHint,
      source: 'barcodeToTitle',
    });
    const browseHit = await resolveBrowseHit(
      fromTitle.title,
      fromTitle.platformHint ?? input.platformHint?.trim() ?? null
    );
    if (browseHit) return buildMetadataFromResolvedHit(browseHit);
  }

  logBarcodeScan('vps.barcode_route.failed', { barcode });
  return null;
}

// ── Precio ────────────────────────────────────────────────────────────────────

export async function resolveValueFromChollwebVps(
  title: string,
  platformHint: string | null | undefined
): Promise<{ cents: number; currency: string } | null> {
  const t = title.trim();
  if (!t) return null;

  const slug = platformHint ? canonicalToVpsSlug(platformHint) : null;
  const data = await searchChollwebVps(t, slug, 5);
  if (!data?.results?.length) return null;

  const best = pickBestResult(data.results, t);
  if (!best || best.marketValueEUR == null) return null;

  return {
    cents: Math.round(best.marketValueEUR * 100),
    currency: 'EUR',
  };
}
