/**
 * Proveedor IGDB (Twitch) — proveedor principal, igual que Playnite.
 * Documentación: https://api-docs.igdb.com
 *
 * Credenciales (gratuitas): https://dev.twitch.tv/console
 */
import { getApiCredentials } from '../credentialsStore';
import { bestMatchIndex, cleanGameTitle } from '../utils/titleUtils';
import { fetchWithTimeout } from '../utils/networkUtils';
import { canonicalizePlatform } from '../utils/platformUtils';
import { MetadataResult, ResolveInput } from './types';

const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const IGDB_GAMES_URL = 'https://api.igdb.com/v4/games';
const IGDB_EXTERNAL_URL = 'https://api.igdb.com/v4/external_games';

type TokenCache = { token: string; expiresAt: number } | null;
let tokenCache: TokenCache = null;

async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60_000) return tokenCache.token;
  const res = await fetchWithTimeout(
    `${TOKEN_URL}?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&grant_type=client_credentials`,
    { method: 'POST' }, 10000
  );
  if (!res.ok) {
    tokenCache = null;
    if (res.status === 403 || res.status === 401) {
      throw new Error(
        `IGDB: Twitch rechazó las credenciales (HTTP ${res.status}). Revisa Client ID y Client Secret en Ajustes (dev.twitch.tv).`
      );
    }
    throw new Error(`IGDB: no se pudo obtener token (HTTP ${res.status}).`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = { token: data.access_token, expiresAt: now + data.expires_in * 1000 };
  return tokenCache.token;
}

type IgdbGame = {
  id: number;
  name?: string;
  first_release_date?: number;
  summary?: string;
  total_rating?: number;
  genres?: Array<{ name?: string }>;
  platforms?: Array<{ id?: number; name?: string }>;
  involved_companies?: Array<{ developer?: boolean; publisher?: boolean; company?: { name?: string } }>;
  franchises?: Array<{ name?: string }>;
  cover?: { url?: string };
  screenshots?: Array<{ url?: string; image_id?: string }>;
};

type IgdbExternalGame = {
  uid?: string;
  game?: IgdbGame;
};

function buildCoverUrl(raw?: string): string | null {
  if (!raw) return null;
  return raw.replace(/^\/\//, 'https://').replace('/t_thumb/', '/t_cover_big/');
}

/** Captura apaisada para cabecera de ficha (mejor que carátula vertical en banner ancho). */
function buildScreenshotHeroUrl(raw?: string): string | null {
  if (!raw) return null;
  let u = raw.replace(/^\/\//, 'https://');
  u = u.replace('/t_thumb/', '/t_screenshot_big/');
  u = u.replace('/t_screenshot_med/', '/t_screenshot_big/');
  u = u.replace('/t_original/', '/t_screenshot_big/');
  return u;
}

function screenshotHeroFromGame(game: IgdbGame): string | null {
  const s = game.screenshots?.[0];
  if (!s) return null;
  const fromUrl = buildScreenshotHeroUrl(s.url);
  if (fromUrl) return fromUrl;
  const id = s.image_id?.trim();
  if (id) return `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${id}.jpg`;
  return null;
}

const PLATFORM_MAP: Array<{ keywords: string[]; id: number }> = [
  { keywords: ['ps1', 'psx', 'playstation 1', 'playstation one', 'playstation'], id: 7 },
  { keywords: ['ps2', 'playstation 2'], id: 8 },
  { keywords: ['ps3', 'playstation 3'], id: 9 },
  { keywords: ['ps4', 'playstation 4'], id: 48 },
  { keywords: ['ps5', 'playstation 5'], id: 167 },
  { keywords: ['psp'], id: 38 },
  { keywords: ['ps vita', 'vita'], id: 46 },
  { keywords: ['xbox one'], id: 49 },
  { keywords: ['xbox 360', 'x360'], id: 12 },
  { keywords: ['xbox series', 'series x', 'series s'], id: 169 },
  { keywords: ['xbox'], id: 11 },
  { keywords: ['nintendo switch 2'], id: 471 },
  { keywords: ['switch', 'nintendo switch'], id: 130 },
  { keywords: ['wii u'], id: 41 },
  { keywords: ['wii'], id: 5 },
  { keywords: ['gamecube', 'game cube', 'ngc'], id: 21 },
  { keywords: ['n64', 'nintendo 64'], id: 4 },
  { keywords: ['snes', 'super nintendo'], id: 19 },
  { keywords: ['nes', 'nintendo entertainment'], id: 18 },
  { keywords: ['nintendo 3ds', '3ds'], id: 37 },
  { keywords: ['nintendo ds', 'nds'], id: 20 },
  { keywords: ['game boy advance', 'gba'], id: 24 },
  { keywords: ['game boy color', 'gbc'], id: 22 },
  { keywords: ['game boy', 'gameboy'], id: 33 },
  { keywords: ['dreamcast'], id: 23 },
  { keywords: ['saturn', 'sega saturn'], id: 32 },
  { keywords: ['mega drive', 'genesis', 'sega genesis'], id: 29 },
  { keywords: ['pc', 'windows', 'steam'], id: 6 },
];

function resolvePlatformId(platformText: string): number | null {
  const lower = platformText.toLowerCase().trim();
  for (const entry of PLATFORM_MAP) {
    if (entry.keywords.some((k) => lower.includes(k))) return entry.id;
  }
  return null;
}

/**
 * Selecciona la plataforma del juego IGDB que mejor coincide con el platformHint.
 * Luego normaliza el nombre con canonicalizePlatform para consistencia en BD.
 */
function selectPlatform(
  platforms: Array<{ id?: number; name?: string }> | undefined,
  platformHint: string | null | undefined
): string {
  if (!platforms || platforms.length === 0) return 'Plataforma desconocida';

  let chosen = platforms[0];

  if (platformHint && platforms.length > 1) {
    const hintLower = platformHint.toLowerCase();
    const match = platforms.find((p) => {
      if (!p.name) return false;
      const nameLower = p.name.toLowerCase();
      // Buscar coincidencia bidireccional: hint incluye keyword del nombre o viceversa
      const hintKeywords = hintLower.split(/\s+/);
      return hintKeywords.some((kw) => kw.length > 2 && nameLower.includes(kw));
    });
    if (match) chosen = match;
  }

  return canonicalizePlatform(chosen.name ?? 'Plataforma desconocida');
}

function normalizeIgdbGame(game: IgdbGame, fallbackTitle: string, platformHint?: string | null): MetadataResult {
  const title = game.name ?? fallbackTitle;
  const platform = selectPlatform(game.platforms, platformHint);
  const releaseYear = game.first_release_date
    ? new Date(game.first_release_date * 1000).getFullYear()
    : null;
  const developer = game.involved_companies?.find((c) => c.developer)?.company?.name ?? null;
  const publisher = game.involved_companies?.find((c) => c.publisher)?.company?.name ?? null;
  // La distinción resolved/partial la unifica deriveMetadataStatusFromGameFields (portada + datos de ficha).
  const isPartial = platform === 'Plataforma desconocida';
  const portraitCover = buildCoverUrl(game.cover?.url);
  const wideShot = screenshotHeroFromGame(game);
  return {
    title,
    platform,
    version: null,
    releaseYear,
    genre: game.genres?.[0]?.name ?? null,
    developer,
    publisher,
    description: game.summary ?? null,
    rating: game.total_rating != null ? Math.round(game.total_rating) : null,
    franchise: game.franchises?.[0]?.name ?? null,
    coverUrl: portraitCover,
    headerImageUrl: wideShot ?? portraitCover ?? null,
    status: isPartial ? 'partial' : 'resolved',
    source: 'igdb',
  };
}

async function fetchGameById(
  gameId: number,
  clientId: string,
  token: string,
  fallbackTitle: string
): Promise<MetadataResult | null> {
  const body =
    `fields id,name,first_release_date,summary,total_rating,` +
    `genres.name,platforms.id,platforms.name,franchises.name,` +
    `involved_companies.developer,involved_companies.publisher,involved_companies.company.name,` +
    `cover.url,screenshots.url,screenshots.image_id; ` +
    `where id = ${gameId};`;

  const res = await fetchWithTimeout(IGDB_GAMES_URL, {
    method: 'POST',
    headers: {
      'Client-ID': clientId,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'text/plain',
    },
    body,
  });

  if (!res.ok) return null;
  const games = (await res.json()) as IgdbGame[];
  if (!games || games.length === 0) return null;
  return normalizeIgdbGame(games[0], fallbackTitle);
}

/**
 * Busca en IGDB external_games por barcode (EAN-13, categoría 26).
 * Prueba EAN-13 (13 dígitos) y UPC-A (12 dígitos).
 */
async function resolveByBarcode(
  barcode: string,
  clientId: string,
  token: string,
  fallbackTitle: string
): Promise<MetadataResult | null> {
  const ean13 = barcode.length === 12 ? `0${barcode}` : barcode;
  const upcA = barcode.startsWith('0') && barcode.length === 13 ? barcode.slice(1) : barcode;
  const barcodesToTry = Array.from(new Set([ean13, upcA, barcode]));

  const headers = {
    'Client-ID': clientId,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'text/plain',
  };

  for (const code of barcodesToTry) {
    const body =
      `fields uid,game; ` +
      `where uid = "${code}" & category = 26; ` +
      `limit 1;`;

    try {
      const res = await fetchWithTimeout(IGDB_EXTERNAL_URL, { method: 'POST', headers, body });
      if (!res.ok) continue;
      const results = (await res.json()) as IgdbExternalGame[];
      if (!results || results.length === 0 || !results[0].game) continue;

      const gameId = typeof results[0].game === 'number' ? results[0].game : (results[0].game as IgdbGame).id;
      if (!gameId) continue;

      return fetchGameById(gameId, clientId, token, fallbackTitle);
    } catch {
      continue;
    }
  }

  return null;
}

export async function resolveFromIgdb(input: ResolveInput): Promise<MetadataResult | null> {
  const credentials = await getApiCredentials();
  if (!credentials.igdbClientId || !credentials.igdbClientSecret) return null;

  const fallbackTitle = input.titleHint ?? (input.barcode ? `Juego ${input.barcode}` : 'Juego desconocido');

  try {
    const token = await getAccessToken(credentials.igdbClientId, credentials.igdbClientSecret);

    // 1. Si hay barcode, intentar EAN en IGDB antes que la búsqueda por título (aunque ya venga hint de otra fuente).
    if (input.barcode?.trim()) {
      const byBarcode = await resolveByBarcode(input.barcode, credentials.igdbClientId, token, fallbackTitle);
      if (byBarcode) return byBarcode;
    }

    // 2. Búsqueda por título (con limpieza Playnite)
    const searchQuery = input.titleHint ?? input.barcode;
    if (!searchQuery) return null;

    const cleanedQuery = cleanGameTitle(searchQuery);
    const searchTerm = cleanedQuery || searchQuery;

    const platformId = input.platformHint ? resolvePlatformId(input.platformHint) : null;
    const whereClause = platformId ? `where platforms = (${platformId});` : '';

    const body =
      `search "${searchTerm.replace(/"/g, '\\"')}"; ` +
      `fields id,name,first_release_date,summary,total_rating,` +
      `genres.name,platforms.id,platforms.name,franchises.name,` +
      `involved_companies.developer,involved_companies.publisher,involved_companies.company.name,` +
      `cover.url,screenshots.url,screenshots.image_id; ` +
      `${whereClause}` +
      `limit 10;`;

    const res = await fetchWithTimeout(IGDB_GAMES_URL, {
      method: 'POST',
      headers: {
        'Client-ID': credentials.igdbClientId,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'text/plain',
      },
      body,
    });

    if (!res.ok) {
      return { title: fallbackTitle, platform: 'Plataforma desconocida', status: 'error', source: 'igdb', error: `http_${res.status}` };
    }

    let games = (await res.json()) as IgdbGame[];

    // Si con filtro de plataforma no hay resultados, reintentar sin filtro
    if (games.length === 0 && platformId) {
      const bodyNoFilter =
        `search "${searchTerm.replace(/"/g, '\\"')}"; ` +
        `fields id,name,first_release_date,summary,total_rating,` +
        `genres.name,platforms.id,platforms.name,franchises.name,` +
        `involved_companies.developer,involved_companies.publisher,involved_companies.company.name,` +
        `cover.url,screenshots.url,screenshots.image_id; ` +
        `limit 10;`;
      const res2 = await fetchWithTimeout(IGDB_GAMES_URL, {
        method: 'POST',
        headers: { 'Client-ID': credentials.igdbClientId, Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain' },
        body: bodyNoFilter,
      });
      if (res2.ok) games = (await res2.json()) as IgdbGame[];
    }

    if (!games || games.length === 0) {
      return { title: fallbackTitle, platform: 'Plataforma desconocida', status: 'error', source: 'igdb', error: 'not_found' };
    }

    const candidateTitles = games.map((g) => g.name ?? '');
    const bestIdx = bestMatchIndex(searchQuery, candidateTitles);

    let finalIdx = bestIdx >= 0 ? bestIdx : 0;
    if (input.yearHint) {
      for (let i = 0; i < games.length; i++) {
        const gameYear = games[i].first_release_date
          ? new Date(games[i].first_release_date! * 1000).getFullYear()
          : null;
        if (gameYear === input.yearHint && i !== finalIdx) {
          const titleScore = candidateTitles[i] ? cleanGameTitle(candidateTitles[i]) : '';
          const queryClean = cleanGameTitle(searchQuery);
          if (titleScore.includes(queryClean.split(' ')[0] ?? '')) {
            finalIdx = i;
            break;
          }
        }
      }
    }

    return normalizeIgdbGame(games[finalIdx], fallbackTitle, input.platformHint);
  } catch (e) {
    return { title: fallbackTitle, platform: 'Plataforma desconocida', status: 'error', source: 'igdb', error: `exception: ${String(e).slice(0, 80)}` };
  }
}
