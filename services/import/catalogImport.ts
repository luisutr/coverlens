import type { NewGameInput } from '../../database/dbConfig';
import { deriveMetadataStatusFromGameFields } from '../utils/metadataCompleteness';
import { normalizePlatformFieldForStorage } from '../utils/platformTokens';
import { stripHtml } from './catalogImportStrings';
import { parsePlayniteLibraryExporterCsv } from './playniteCsvImport';

export type CatalogImportSource = 'coverlens' | 'playnite' | 'playnite_csv' | 'generic';

export type ParsedCatalogImport = {
  source: CatalogImportSource;
  rows: NewGameInput[];
  /** Avisos para mostrar al usuario (p. ej. juegos ocultos omitidos) */
  notes: string[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function pickStr(o: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function pickBool(o: Record<string, unknown>, keys: string[]): boolean | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'boolean') return v;
  }
  return null;
}

function pickNum(o: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim()) {
      const n = parseFloat(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

/** Nombres desde listas Playnite: [{ Name: "x" }] o ["x"] */
function joinEntityNames(v: unknown, max = 4): string | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const names: string[] = [];
  for (const el of v.slice(0, max)) {
    if (typeof el === 'string' && el.trim()) names.push(el.trim());
    else if (isRecord(el)) {
      const n = pickStr(el, ['Name', 'name']);
      if (n) names.push(n);
    }
  }
  if (names.length === 0) return null;
  return names.join(', ');
}

function platformsToString(v: unknown): string {
  if (!Array.isArray(v) || v.length === 0) return 'Desconocida';
  const names: string[] = [];
  for (const el of v) {
    if (typeof el === 'string' && el.trim()) names.push(el.trim());
    else if (isRecord(el)) {
      const n = pickStr(el, ['Name', 'name', 'SpecificationId']);
      if (n) names.push(n);
    }
  }
  return names.length ? names.join(', ') : 'Desconocida';
}

function parseReleaseYear(o: Record<string, unknown>): number | null {
  const y = pickNum(o, ['ReleaseYear', 'releaseYear']);
  if (y != null && y >= 1950 && y <= 2100) return Math.round(y);

  const rd = o.ReleaseDate ?? o.releaseDate;
  if (isRecord(rd)) {
    const yy = pickNum(rd, ['Year', 'year']);
    if (yy != null && yy >= 1950 && yy <= 2100) return Math.round(yy);
  }
  if (typeof rd === 'string' && /^\d{4}/.test(rd)) {
    const yy = parseInt(rd.slice(0, 4), 10);
    if (Number.isFinite(yy) && yy >= 1950 && yy <= 2100) return yy;
  }
  return null;
}

function httpCoverOnly(v: string | null): string | null {
  if (!v) return null;
  const t = v.trim();
  if (t.startsWith('http://') || t.startsWith('https://')) return t;
  return null;
}

function playniteGameToRow(o: Record<string, unknown>, hiddenCount: { n: number }): NewGameInput | null {
  if (pickBool(o, ['Hidden', 'hidden']) === true) {
    hiddenCount.n++;
    return null;
  }

  const title =
    pickStr(o, ['Name', 'name', 'title', 'SortingName', 'sortingName']) ?? '';
  if (!title) return null;

  const platformRaw =
    pickStr(o, ['Platform', 'platform']) ??
    platformsToString(o.Platforms ?? o.platforms);
  const platform = platformRaw ? normalizePlatformFieldForStorage(platformRaw) : '';

  const descriptionRaw = pickStr(o, ['Description', 'description']);
  const description = descriptionRaw ? stripHtml(descriptionRaw) : null;

  const coverUrl = httpCoverOnly(pickStr(o, ['CoverImage', 'coverImage', 'coverUrl', 'coverURL']));

  const genre = joinEntityNames(o.Genres ?? o.genres);
  const developer = joinEntityNames(o.Developers ?? o.developers);
  const publisher = joinEntityNames(o.Publishers ?? o.publishers);
  const franchise = joinEntityNames(o.Series ?? o.series, 2);

  const userScore = pickNum(o, ['UserScore', 'userScore']);
  const criticScore = pickNum(o, ['CriticScore', 'criticScore']);
  const communityScore = pickNum(o, ['CommunityScore', 'communityScore']);
  let rating: number | null = null;
  if (userScore != null && userScore >= 0 && userScore <= 100) rating = userScore;
  else if (criticScore != null && criticScore >= 0 && criticScore <= 100) rating = criticScore;
  else if (communityScore != null && communityScore >= 0 && communityScore <= 100)
    rating = communityScore;

  const version = pickStr(o, ['Version', 'version']);

  const gameId = pickStr(o, ['GameId', 'gameId']);
  const barcode =
    gameId && /^\d{8,14}$/.test(gameId.replace(/\s/g, '')) ? gameId.replace(/\s/g, '') : null;

  const favorite = pickBool(o, ['Favorite', 'favorite']) === true ? 1 as const : (0 as const);

  const row: NewGameInput = {
    title,
    barcode,
    platform,
    version,
    releaseYear: parseReleaseYear(o),
    genre,
    developer,
    publisher,
    description,
    rating,
    franchise,
    coverUrl,
    metadataStatus: 'pending',
    metadataSource: 'import:playnite',
    lastError: null,
    favorite,
    discOnly: 0,
  };
  return { ...row, metadataStatus: deriveMetadataStatusFromGameFields(row) };
}

function coverLensItemToRow(item: Record<string, unknown>): NewGameInput | null {
  const title = pickStr(item, ['title']) ?? '';
  const platform = pickStr(item, ['platform']) ?? '';
  if (!title.trim() || !platform.trim()) return null;

  const thumb = pickStr(item, ['coverLocalThumbUri']);
  const coverRemote = httpCoverOnly(pickStr(item, ['coverUrl']));
  const coverUrl =
    coverRemote ??
    (thumb?.startsWith('http://') || thumb?.startsWith('https://') ? thumb : null);

  const meta = pickStr(item, ['metadataStatus']);

  const row: NewGameInput = {
    title: title.trim(),
    barcode: pickStr(item, ['barcode']),
    platform: normalizePlatformFieldForStorage(platform.trim()),
    version: pickStr(item, ['version']),
    releaseYear: pickNum(item, ['releaseYear']),
    genre: pickStr(item, ['genre']),
    developer: pickStr(item, ['developer']),
    publisher: pickStr(item, ['publisher']),
    description: pickStr(item, ['description']),
    rating: pickNum(item, ['rating']),
    franchise: pickStr(item, ['franchise']),
    textLanguages: pickStr(item, ['textLanguages']),
    voiceLanguages: pickStr(item, ['voiceLanguages']),
    coverUrl,
    metadataStatus: 'pending',
    metadataSource: pickStr(item, ['metadataSource']) ?? 'import:coverlens',
    lastError: pickStr(item, ['lastError']),
    favorite: pickNum(item, ['favorite']) === 1 ? 1 : 0,
    discOnly: pickNum(item, ['discOnly']) === 1 ? 1 : 0,
  };

  if (meta === 'error') return { ...row, metadataStatus: 'error' };
  if (meta === 'pending') return { ...row, metadataStatus: 'pending' };

  return { ...row, metadataStatus: deriveMetadataStatusFromGameFields(row) };
}

function parseCoverLensExport(o: Record<string, unknown>): ParsedCatalogImport {
  const items = o.items;
  if (!Array.isArray(items)) {
    return { source: 'coverlens', rows: [], notes: ['El archivo no contiene "items" (array).'] };
  }
  const rows: NewGameInput[] = [];
  for (const el of items) {
    if (!isRecord(el)) continue;
    const row = coverLensItemToRow(el);
    if (row) rows.push(row);
  }
  return { source: 'coverlens', rows, notes: [] };
}

function parsePlayniteGameArray(arr: unknown[], notes: string[]): NewGameInput[] {
  const rows: NewGameInput[] = [];
  const hiddenCount = { n: 0 };
  for (const el of arr) {
    if (!isRecord(el)) continue;
    const row = playniteGameToRow(el, hiddenCount);
    if (row) rows.push(row);
  }
  if (hiddenCount.n > 0) {
    notes.push(`Se omitieron ${hiddenCount.n} juego(s) ocultos en Playnite (Hidden).`);
  }
  return rows;
}

function detectAndParse(data: unknown): ParsedCatalogImport {
  const notes: string[] = [];

  if (isRecord(data)) {
    const app = data.app;
    const hasItems = Array.isArray(data.items);
    if (hasItems && (app === 'CoverLens' || typeof data.formatVersion === 'number')) {
      return parseCoverLensExport(data);
    }

    const gamesPascal = data.Games;
    if (Array.isArray(gamesPascal)) {
      const rows = parsePlayniteGameArray(gamesPascal, notes);
      return { source: 'playnite', rows, notes };
    }

    const gamesLower = data.games;
    if (Array.isArray(gamesLower)) {
      const rows = parsePlayniteGameArray(gamesLower, notes);
      return { source: 'playnite', rows, notes };
    }
  }

  if (Array.isArray(data) && data.length > 0) {
    const first = data[0];
    if (isRecord(first) && pickStr(first, ['title']) && pickStr(first, ['platform'])) {
      return parseCoverLensExport({ items: data, app: 'CoverLens', formatVersion: 0 });
    }
    if (isRecord(first) && (pickStr(first, ['Name', 'name', 'title']) || pickStr(first, ['title']))) {
      const rows = parsePlayniteGameArray(data, notes);
      if (rows.length > 0) {
        const looksPlaynite = data.some((x) => isRecord(x) && pickStr(x, ['PluginId', 'pluginId']));
        return { source: looksPlaynite ? 'playnite' : 'generic', rows, notes };
      }
    }
  }

  return {
    source: 'generic',
    rows: [],
    notes: ['No se reconoció el formato. Usa export de CoverLens o un JSON de juegos estilo Playnite (Name + Platforms).'],
  };
}

export function parseCatalogImportJson(text: string): ParsedCatalogImport {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('El archivo no es JSON válido.');
  }
  return detectAndParse(data);
}

/**
 * JSON (CoverLens / Playnite) o CSV (Library Exporter Advanced, coma o punto y coma).
 */
export function parseCatalogImport(text: string): ParsedCatalogImport {
  let s = text;
  if (s.charCodeAt(0) === 0xfeff) {
    s = s.slice(1);
  }
  const t = s.trim();
  if (t.startsWith('{') || t.startsWith('[')) {
    return parseCatalogImportJson(t);
  }
  const csv = parsePlayniteLibraryExporterCsv(s);
  return { source: 'playnite_csv', rows: csv.rows, notes: csv.notes };
}
