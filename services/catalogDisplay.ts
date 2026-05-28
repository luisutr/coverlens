import type { GameRecord } from '../database/dbConfig';
import { gameHasSpanishText, gameHasSpanishVoice } from './utils/gameLanguages';
import { gameMatchesPlatformFilter } from './utils/platformTokens';

export type CatalogSort =
  | 'added_desc'
  | 'title_asc'
  | 'platform_asc'
  | 'year_desc'
  | 'rating_desc'
  | 'value_desc';

export type CatalogFilters = {
  search: string;
  /** Cadena exacta (tras trim) tal como en el catálogo; null = todas las plataformas */
  platform: string | null;
  onlyFavorite: boolean;
  onlyDiscOnly: boolean;
  /** Menús/subtítulos incluyen castellano */
  onlySpanishText: boolean;
  /** Doblaje incluye castellano */
  onlySpanishVoice: boolean;
};

function compareTitle(a: GameRecord, b: GameRecord): number {
  return a.title.localeCompare(b.title, 'es', { sensitivity: 'base' });
}

function comparePlatform(a: GameRecord, b: GameRecord): number {
  const p = a.platform.localeCompare(b.platform, 'es', { sensitivity: 'base' });
  if (p !== 0) return p;
  return compareTitle(a, b);
}

export function filterAndSortGames(
  games: GameRecord[],
  filters: CatalogFilters,
  sort: CatalogSort
): GameRecord[] {
  let list = [...games];
  const q = filters.search.trim().toLowerCase();
  if (q) {
    list = list.filter((g) => {
      const barcode = g.barcode?.toLowerCase() ?? '';
      return (
        g.title.toLowerCase().includes(q) ||
        g.platform.toLowerCase().includes(q) ||
        barcode.includes(q)
      );
    });
  }
  const pf = filters.platform?.trim();
  if (pf) {
    list = list.filter((g) => gameMatchesPlatformFilter(g.platform, pf));
  }
  if (filters.onlyFavorite) list = list.filter((g) => g.favorite === 1);
  if (filters.onlyDiscOnly) list = list.filter((g) => g.discOnly === 1);
  if (filters.onlySpanishText) list = list.filter((g) => gameHasSpanishText(g));
  if (filters.onlySpanishVoice) list = list.filter((g) => gameHasSpanishVoice(g));

  const nullLast = (va: number | null | undefined, vb: number | null | undefined): number => {
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return 0;
  };

  list.sort((a, b) => {
    switch (sort) {
      case 'title_asc':
        return compareTitle(a, b);
      case 'platform_asc':
        return comparePlatform(a, b);
      case 'year_desc': {
        const yr = nullLast(a.releaseYear, b.releaseYear);
        if (yr !== 0) return yr;
        const ya = a.releaseYear ?? 0;
        const yb = b.releaseYear ?? 0;
        if (ya !== yb) return yb - ya;
        return b.id - a.id;
      }
      case 'rating_desc': {
        const rr = nullLast(a.rating, b.rating);
        if (rr !== 0) return rr;
        const ra = a.rating ?? 0;
        const rb = b.rating ?? 0;
        if (ra !== rb) return rb - ra;
        return b.id - a.id;
      }
      case 'value_desc': {
        const vr = nullLast(a.valueCents, b.valueCents);
        if (vr !== 0) return vr;
        const ca = a.valueCents ?? 0;
        const cb = b.valueCents ?? 0;
        if (ca !== cb) return cb - ca;
        return b.id - a.id;
      }
      case 'added_desc':
      default:
        return b.id - a.id;
    }
  });

  return list;
}
