/**
 * Portadas desde gameplaystores.es: búsqueda JSON de PrestaShop acotada por categoría «Juegos …».
 * Misma base que el escaneo por EAN (`barcodeToTitle`), sin API key; conviene no abusar (un GET por resolución).
 *
 * Importante: el buscador debe usar **order=product.position.desc** (Relevancia). Sin ello la tienda
 * devuelve orden «Random» y los primeros 100 resultados no coinciden con el widget Motive de la web.
 * La cadena de búsqueda sigue el mismo criterio que el listado GPS / Motive: «Título - PS2», etc.
 */

import { parseGamePlayStoresName } from '../utils/barcodeToTitle';
import { fetchWithTimeout } from '../utils/networkUtils';
import { canonicalizePlatform } from '../utils/platformUtils';
import { fetchGpsProductCoverUrlFromProductPage, resolveGpsProductAbsoluteUrl } from './gameplayStoresProductPage';

const GPS_SEARCH = 'https://www.gameplaystores.es/busqueda';

/** Sufijo de plataforma en el nombre del producto GPS (mismo criterio que `parseGamePlayStoresName`). */
const CANONICAL_PLATFORM_TO_GPS_LIST_SUFFIX: Partial<Record<string, string>> = {
  'PlayStation 5': 'PS5',
  'PlayStation 4': 'PS4',
  'PlayStation 3': 'PS3',
  'PlayStation 2': 'PS2',
  PlayStation: 'PSX',
  PSP: 'PSP',
  'PS Vita': 'PSVITA',
  'Xbox Series X': 'XBSX',
  'Xbox One': 'XBONE',
  'Xbox 360': 'X360',
  Xbox: 'XBOX',
  'Switch 2': 'SWI2',
  Switch: 'SWI',
  'Wii U': 'WIIU',
  Wii: 'WII',
  'Nintendo 3DS': '3DS',
  'Nintendo DS': 'NDS',
  'Game Boy Advance': 'GBA',
  'Game Boy Color': 'GBC',
  'Game Boy': 'GB',
  GameCube: 'GC',
  'Nintendo 64': 'N64',
  SNES: 'SNES',
  NES: 'NES',
  Dreamcast: 'DC',
  Saturn: 'SAT',
  'Mega Drive': 'MD',
  'Game Gear': 'GG',
  'Master System': 'SMS',
  PC: 'PC',
};

/** id_category de «Juegos …» en la web (menú, abril 2026). */
const CANONICAL_PLATFORM_TO_GPS_JUEGOS_CATEGORY: Record<string, number> = {
  'PlayStation 5': 1002,
  'PlayStation 4': 999,
  'PlayStation 3': 996,
  'PlayStation 2': 1246,
  PlayStation: 1128,
  PSP: 1249,
  'PS Vita': 1017,
  'Xbox Series X': 1008,
  'Xbox One': 1005,
  'Xbox 360': 1011,
  Xbox: 1133,
  'Switch 2': 1424,
  Switch: 967,
  'Wii U': 973,
  Wii: 970,
  'Nintendo 3DS': 976,
  'Nintendo DS': 1254,
  'Game Boy Advance': 1087,
  'Game Boy Color': 1083,
  'Game Boy': 1078,
  GameCube: 1074,
  'Nintendo 64': 1070,
  SNES: 1064,
  NES: 1058,
  Dreamcast: 1119,
  Saturn: 1115,
  'Mega Drive': 1102,
  'Game Gear': 1123,
  'Master System': 1098,
  PC: 990,
};

type GpsCover = {
  large?: { url?: string };
  medium?: { url?: string };
  small?: { url?: string };
  bySize?: Record<string, { url?: string } | undefined>;
};

export type GpsProduct = {
  name?: string;
  cover?: GpsCover;
  /** Precio mostrado en listado, p. ej. "7,95 €" o con NBSP + símbolo € */
  price?: string;
  /** Enlace a la ficha (PrestaShop: url, link o canonical_url). */
  url?: string;
  link?: string;
  canonical_url?: string;
  /** Si faltan las URLs, se puede abrir la ficha por id (PrestaShop). */
  id_product?: string | number;
};

type GpsSearchJson = {
  products?: GpsProduct[];
};

function normalizeTitleTokens(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/-/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length >= 2 || /^\d+$/.test(w));
}

function titleMatchScore(queryTitle: string, candidateTitle: string): number {
  const a = normalizeTitleTokens(queryTitle);
  const b = normalizeTitleTokens(candidateTitle);
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  let hits = 0;
  for (const t of a) {
    if (setB.has(t)) hits++;
  }
  return hits / Math.max(a.length, b.length);
}

/** Listados que no son el juego en formato caja/cartucho típico. */
const BAD_GPS_LISTING_RE =
  /\b(enciclopedia|guía\s+oficial|guia\s+oficial|figura(s)?|amiibo|libro|artbook|steelbook\s+vac[ií]o|soundtrack|banda\s+sonora)\b/i;

/** Ligero bonus si el nombre sugiere producto de juego físico (como en GPS). */
const RETAIL_PACKAGING_HINT_RE =
  /\((?:cartucho|caja\s+pequeña|complete\s+in\s+box)\b/i;

function numberEditionPenalty(queryTitle: string, candidateTitle: string): number {
  const q = normalizeTitleTokens(queryTitle);
  const p = normalizeTitleTokens(candidateTitle);
  const qNums = new Set(q.filter((t) => /^\d+$/.test(t)));
  const pNums = p.filter((t) => /^\d+$/.test(t));
  if (qNums.size === 0 && pNums.length > 0) {
    return -0.2 * Math.min(pNums.length, 2);
  }
  if (qNums.size > 0 && pNums.length > 0) {
    const pSet = new Set(pNums);
    for (const n of qNums) {
      if (pSet.has(n)) return 0;
    }
    return -0.28;
  }
  return 0;
}

/**
 * Puntúa un listado GPS «Título (notas de caja) - PLAT» frente a la búsqueda del usuario.
 * Exportado para tests.
 */
export function scoreGpsListingForCatalog(
  queryTitle: string,
  productName: string,
  parsed: { title: string; platformHint: string | null }
): number {
  let s = titleMatchScore(queryTitle, parsed.title);
  const qTok = normalizeTitleTokens(queryTitle);
  const pSet = new Set(normalizeTitleTokens(parsed.title));
  if (qTok.length > 0 && qTok.every((t) => pSet.has(t))) {
    s += 0.16;
  }
  if (BAD_GPS_LISTING_RE.test(productName)) {
    s -= 0.62;
  }
  if (RETAIL_PACKAGING_HINT_RE.test(productName)) {
    s += 0.07;
  }
  s += numberEditionPenalty(queryTitle, parsed.title);
  return Math.max(0, s);
}

function compareGpsPick(
  a: { score: number; titleLen: number; hasCover: boolean },
  b: { score: number; titleLen: number; hasCover: boolean }
): number {
  if (a.score !== b.score) return a.score > b.score ? 1 : -1;
  if (a.titleLen !== b.titleLen) return a.titleLen < b.titleLen ? 1 : -1;
  if (a.hasCover !== b.hasCover) return a.hasCover ? 1 : -1;
  return 0;
}

export type FindBestGpsOptions = {
  /** Por defecto true (portada / precio). En metadatos manuales se usa false para aceptar filas sin imagen en JSON. */
  requireCover?: boolean;
  /** Umbral mínimo de `scoreGpsListingForCatalog`. */
  minListingScore?: number;
};

/**
 * PrestaShop suele poner en `large` la variante thickbox (muy grande) y en `medium` la large_default.
 * En la ficha web de GPS el `<img>` principal usa **large_default** (~381×492); thickbox a veces trae más
 * “lienzo” blanco alrededor. Priorizamos large_default / medium como en la tienda.
 */
export function pickCoverUrl(cover: GpsCover | undefined): string | null {
  const u =
    cover?.bySize?.large_default?.url ??
    cover?.medium?.url ??
    cover?.bySize?.medium_default?.url ??
    cover?.large?.url ??
    cover?.bySize?.thickbox_default?.url ??
    cover?.bySize?.home_default?.url ??
    cover?.small?.url;
  return u?.startsWith('http') ? u : null;
}

/**
 * Texto de búsqueda alineado con el listado GPS / caja Motive: «Nombre - PS2» cuando hay sufijo conocido.
 */
function buildGpsSearchQuery(title: string, canonicalPlatform: string): string {
  const t = title.trim();
  const suffix = CANONICAL_PLATFORM_TO_GPS_LIST_SUFFIX[canonicalPlatform];
  if (!suffix) return t;
  const escaped = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`\\s-\\s${escaped}$`, 'i').test(t)) return t;
  return `${t} - ${suffix}`;
}

/**
 * Producto GPS que mejor encaja con título + plataforma (misma heurística que la portada).
 * Sirve para portada y para precio de tienda en EUR si viene en el JSON de búsqueda.
 */
export async function findBestGameplayStoresProduct(
  title: string,
  platformHint: string | null | undefined,
  options?: FindBestGpsOptions
): Promise<GpsProduct | null> {
  const t = title.trim();
  const rawPlat = platformHint?.trim();
  if (!t || !rawPlat) return null;

  const requireCover = options?.requireCover !== false;
  const minListingScore =
    options?.minListingScore ?? (requireCover ? 0.48 : 0.38);

  const platform = canonicalizePlatform(rawPlat);
  const idCategory = CANONICAL_PLATFORM_TO_GPS_JUEGOS_CATEGORY[platform];
  if (idCategory == null) return null;

  const searchQuery = buildGpsSearchQuery(t, platform);
  const url = `${GPS_SEARCH}?controller=search&s=${encodeURIComponent(searchQuery)}&id_category=${idCategory}&order=product.position.desc`;
  let res: Response;
  try {
    res = await fetchWithTimeout(
      url,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; PokedexGamer/1.0; +cover resolver)',
        },
      },
      12000
    );
  } catch {
    return null;
  }

  if (!res.ok) return null;

  let text: string;
  try {
    text = await res.text();
  } catch {
    return null;
  }

  if (!text.trim().startsWith('{')) return null;

  let data: GpsSearchJson;
  try {
    data = JSON.parse(text) as GpsSearchJson;
  } catch {
    return null;
  }

  const products = data.products;
  if (!Array.isArray(products) || products.length === 0) return null;

  const wantPlat = platform;
  let best: { score: number; product: GpsProduct; titleLen: number; hasCover: boolean } | null = null;

  for (const p of products) {
    const name = p.name?.trim();
    if (!name) continue;

    const parsed = parseGamePlayStoresName(name);
    if (!parsed.platformHint) continue;
    const productPlat = canonicalizePlatform(parsed.platformHint);
    if (productPlat !== wantPlat) continue;

    const score = scoreGpsListingForCatalog(t, name, parsed);
    if (score < minListingScore) continue;

    const coverUrl = pickCoverUrl(p.cover);
    if (requireCover && !coverUrl) continue;

    const titleLen = parsed.title.length;
    const hasCover = !!coverUrl;
    const cand = { score, product: p, titleLen, hasCover };
    if (!best || compareGpsPick(cand, best) > 0) {
      best = cand;
    }
  }

  return best?.product ?? null;
}

/**
 * Resuelve URL de portada si hay un producto bastante alineado con el título y la plataforma en la categoría de juegos GPS.
 */
export async function resolveCoverFromGameplayStoresSearch(
  title: string,
  platformHint: string | null | undefined
): Promise<string | null> {
  /** Misma heurística que metadatos/precio: no exigir `cover` en JSON (a veces falta y sí hay precio/ficha). */
  const p = await findBestGameplayStoresProduct(title, platformHint, { requireCover: false });
  if (!p) return null;
  const fromJson = pickCoverUrl(p.cover);
  if (fromJson) return fromJson;
  const pageUrl = resolveGpsProductAbsoluteUrl(p);
  if (!pageUrl) return null;
  return fetchGpsProductCoverUrlFromProductPage(pageUrl);
}
