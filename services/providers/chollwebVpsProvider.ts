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
import { canonicalizePlatform } from '../utils/platformUtils';

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

export async function searchChollwebVpsByBarcode(
  barcode: string
): Promise<VpsSearchResult | null> {
  try {
    const params = new URLSearchParams({ barcode });
    const res = await fetch(`${BASE_URL}/api/search.php?${params}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as VpsSearchResponse;
    return data.results?.[0] ?? null;
  } catch {
    return null;
  }
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

  let resolvedSlug: string;
  let resolvedPlatformSlug: string;
  let resolvedTitle: string;
  let resolvedCoverUrl: string | null;
  let resolvedRating: number | null;

  if (!titleHint) {
    // Ruta barcode-only: search.php?barcode=… (O(1) via barcodes_index.json)
    if (!barcode) return null;
    const hit = await searchChollwebVpsByBarcode(barcode);
    if (!hit) return null;
    resolvedSlug = hit.slug;
    resolvedPlatformSlug = hit.platformSlug;
    resolvedTitle = hit.title;
    resolvedCoverUrl = hit.coverPath ? `${BASE_URL}/${hit.coverPath}` : null;
    resolvedRating = null;
  } else {
    // Ruta título: browse.php?q=…
    const platformHint = input.platformHint?.trim() ?? null;
    const platformSlug = platformHint ? canonicalToVpsSlug(platformHint) : null;
    const data = await searchChollwebVps(titleHint, platformSlug, 5);
    if (!data?.results?.length) return null;
    const best = pickBestResult(data.results, titleHint);
    if (!best) return null;
    resolvedSlug = best.slug;
    resolvedPlatformSlug = best.platformSlug;
    resolvedTitle = best.title;
    resolvedCoverUrl = best.coverUrl ?? null;
    resolvedRating = best.rating;
  }

  // Ficha completa para género, developer, publisher, descripción
  const detail = await getChollwebVpsDetail(resolvedPlatformSlug, resolvedSlug);

  const coverUrl =
    resolvedCoverUrl ??
    (detail?.coverPath ? `${BASE_URL}/${detail.coverPath}` : null);

  const platform = canonicalizePlatform(detail?.platform ?? resolvedPlatformSlug);

  const isResolved = Boolean(
    (detail?.genre || resolvedRating != null) &&
      (detail?.developer || detail?.publisher)
  );

  return {
    title: detail?.title ?? resolvedTitle,
    platform,
    version: detail?.version ?? null,
    releaseYear: detail?.releaseYear ?? null,
    genre: detail?.genre ?? null,
    developer: detail?.developer ?? null,
    publisher: detail?.publisher ?? null,
    description: detail?.description ?? null,
    rating: detail?.rating ?? resolvedRating ?? null,
    franchise: null,
    coverUrl,
    headerImageUrl: coverUrl,
    status: isResolved ? 'resolved' : 'partial',
    source: 'cholloweb',
  };
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
