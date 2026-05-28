/**
 * Metadatos y portadas desde el servidor propio CoverLens Resource (VPS).
 * Consulta JSON estático por slug o búsqueda via /api/search.php.
 */
import { COVERLENS_RESOURCE_BASE_URL } from '../../constants/coverLensResource';
import { fetchWithTimeout } from '../utils/networkUtils';
import { canonicalizePlatform } from '../utils/platformUtils';
import { languagesFromCoverLensRecord } from '../utils/gameLanguages';
import { MetadataResult, ResolveInput } from './types';

export type CoverLensGameRecord = {
  slug: string;
  title: string;
  platform: string;
  platformSlug: string;
  version?: string | null;
  barcode?: string | null;
  genre?: string | null;
  developer?: string | null;
  publisher?: string | null;
  releaseYear?: number | null;
  releaseDate?: string | null;
  productCondition?: string | null;
  reference?: string | null;
  gpsProductId?: string | number | null;
  description?: string | null;
  rating?: number | null;
  coverPath?: string | null;
  marketValue?: { EUR?: number; source?: string; updatedAt?: string } | null;
  textLanguages?: string[] | string | null;
  voiceLanguages?: string[] | string | null;
  languages?: { text?: unknown; voice?: unknown; interface?: unknown; audio?: unknown } | null;
  sources?: Record<string, string>;
  updatedAt?: string;
};

type SearchResponse = {
  results?: Array<{
    score: number;
    slug: string;
    title: string;
    platform: string;
    platformSlug: string;
    coverPath?: string | null;
    jsonUrl?: string;
  }>;
};

/** Mapeo plataforma canónica → slug del recurso (alineado con coverlens_resource). */
const CANONICAL_TO_SLUG: Record<string, string> = {
  'PlayStation 5': 'ps5',
  'PlayStation 4': 'ps4',
  'PlayStation 3': 'ps3',
  'PlayStation 2': 'ps2',
  PlayStation: 'psx',
  PSP: 'psp',
  'PS Vita': 'psvita',
  'Xbox Series X': 'xbsx',
  'Xbox One': 'xboxone',
  'Xbox 360': 'x360',
  Xbox: 'xbox',
  'Switch 2': 'swi2',
  Switch: 'switch',
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
  Dreamcast: 'dc',
  Saturn: 'saturn',
  'Mega Drive': 'md',
  'Game Gear': 'gg',
  'Master System': 'sms',
  PC: 'pc',
};

function slugifyTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function platformSlugFor(canonical: string): string | null {
  return CANONICAL_TO_SLUG[canonical] ?? null;
}

function absoluteCoverUrl(coverPath: string | null | undefined): string | null {
  const p = coverPath?.trim();
  if (!p) return null;
  if (/^https?:\/\//i.test(p)) return p;
  const base = COVERLENS_RESOURCE_BASE_URL.replace(/\/$/, '');
  return p.startsWith('/') ? `${base}${p}` : `${base}/${p}`;
}

async function fetchJson<T>(url: string, timeoutMs = 10000): Promise<T | null> {
  try {
    const res = await fetchWithTimeout(
      url,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; CoverLens/1.0; +resource)',
        },
      },
      timeoutMs
    );
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function fetchGameBySlug(platformSlug: string, slug: string): Promise<CoverLensGameRecord | null> {
  const url = `${COVERLENS_RESOURCE_BASE_URL}/games/${platformSlug}/${slug}.json`;
  return fetchJson<CoverLensGameRecord>(url);
}

async function searchGame(title: string, platformSlug: string): Promise<CoverLensGameRecord | null> {
  const q = encodeURIComponent(title.trim());
  const url = `${COVERLENS_RESOURCE_BASE_URL}/api/search.php?q=${q}&platform=${encodeURIComponent(platformSlug)}`;
  const data = await fetchJson<SearchResponse>(url);
  const hit = data?.results?.[0];
  if (!hit?.slug) return null;
  return fetchGameBySlug(hit.platformSlug ?? platformSlug, hit.slug);
}

function trimOrNull(value: string | null | undefined): string | null {
  const t = value?.trim() ?? '';
  return t.length > 0 ? t : null;
}

function releaseYearFromRecord(record: CoverLensGameRecord): number | null {
  if (record.releaseYear != null && !Number.isNaN(Number(record.releaseYear))) {
    return record.releaseYear;
  }
  const d = record.releaseDate?.trim();
  if (!d) return null;
  const year = Number.parseInt(d.slice(0, 4), 10);
  return Number.isFinite(year) && year > 1970 ? year : null;
}

/** Exportado para tests unitarios del mapeo VPS → MetadataResult. */
export function mapCoverLensRecordToMetadata(record: CoverLensGameRecord): MetadataResult {
  const coverUrl = absoluteCoverUrl(record.coverPath);
  const eur = record.marketValue?.EUR;
  const langs = languagesFromCoverLensRecord(record as unknown as Record<string, unknown>);
  const valueBlock =
    eur != null
      ? {
          valueCents: Math.round(eur * 100),
          valueCurrency: 'EUR' as const,
          valueSource: 'coverlens' as const,
        }
      : {};

  return {
    title: record.title,
    platform: record.platform,
    barcode: trimOrNull(record.barcode),
    version: trimOrNull(record.version),
    releaseYear: releaseYearFromRecord(record),
    genre: trimOrNull(record.genre),
    developer: trimOrNull(record.developer),
    publisher: trimOrNull(record.publisher),
    description: trimOrNull(record.description),
    rating: record.rating ?? null,
    franchise: null,
    textLanguages: langs.textLanguages,
    voiceLanguages: langs.voiceLanguages,
    coverUrl,
    headerImageUrl: coverUrl,
    status: 'partial',
    source: 'coverlens',
    ...valueBlock,
  };
}

/**
 * Resuelve metadatos desde el recurso propio (título + plataforma o barcode vía búsqueda).
 */
export async function resolveFromCoverLensResource(input: ResolveInput): Promise<MetadataResult | null> {
  const title = input.titleHint?.trim();
  const platformRaw = input.platformHint?.trim();
  if (!title || !platformRaw) return null;

  const platform = canonicalizePlatform(platformRaw);
  const platformSlug = platformSlugFor(platform);
  if (!platformSlug) return null;

  const slug = slugifyTitle(title);
  let record = await fetchGameBySlug(platformSlug, slug);
  if (!record) {
    record = await searchGame(title, platformSlug);
  }
  if (!record) return null;

  return mapCoverLensRecordToMetadata(record);
}

/**
 * Resuelve URL de portada desde el recurso propio.
 */
/**
 * Valor de mercado desde el recurso propio (EUR en catálogo VPS).
 */
export async function resolveValueFromCoverLensResource(
  title: string,
  platformHint: string | null | undefined
): Promise<{ cents: number; currency: string } | null> {
  const meta = await resolveFromCoverLensResource({ titleHint: title, platformHint });
  if (meta?.valueCents == null || meta.valueCents <= 0) return null;
  return { cents: meta.valueCents, currency: meta.valueCurrency ?? 'EUR' };
}

export async function resolveCoverFromCoverLensResource(
  title: string,
  platformHint: string | null | undefined
): Promise<string | null> {
  const t = title.trim();
  const ph = platformHint?.trim();
  if (!t || !ph) return null;

  const platform = canonicalizePlatform(ph);
  const platformSlug = platformSlugFor(platform);
  if (!platformSlug) return null;

  const slug = slugifyTitle(t);
  let record = await fetchGameBySlug(platformSlug, slug);
  if (!record) {
    record = await searchGame(t, platformSlug);
  }
  if (!record?.coverPath) return null;

  return absoluteCoverUrl(record.coverPath);
}
