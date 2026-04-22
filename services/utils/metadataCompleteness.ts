import type { MetadataResult } from '../providers/types';

/** Título genérico o desconocido: no cuenta como ficha completa. */
export function isPlaceholderTitle(title: string | null | undefined): boolean {
  const t = title?.trim() ?? '';
  if (!t) return true;
  if (/^juego desconocido$/i.test(t)) return true;
  if (/^juego \d+$/i.test(t)) return true;
  return false;
}

export function isUnknownPlatform(platform: string | null | undefined): boolean {
  const p = platform?.trim() ?? '';
  if (!p) return true;
  if (/desconocida/i.test(p)) return true;
  return false;
}

export function hasHttpCover(coverUrl: string | null | undefined): boolean {
  const u = coverUrl?.trim() ?? '';
  return /^https?:\/\//i.test(u);
}

/**
 * Campos de ficha que importan para considerar la entrada «completa» (sin barcode ni precio).
 * Basta con al menos uno relleno además de título, plataforma y portada.
 */
function richFieldCount(fields: {
  releaseYear?: number | null;
  genre?: string | null;
  developer?: string | null;
  publisher?: string | null;
  description?: string | null;
  version?: string | null;
}): number {
  let n = 0;
  if (fields.releaseYear != null && !Number.isNaN(Number(fields.releaseYear))) n++;
  if ((fields.genre?.trim() ?? '').length > 0) n++;
  if ((fields.developer?.trim() ?? '').length > 0) n++;
  if ((fields.publisher?.trim() ?? '').length > 0) n++;
  if ((fields.description?.trim() ?? '').length > 24) n++;
  if ((fields.version?.trim() ?? '').length > 0) n++;
  return n;
}

export type GameFieldsForStatus = {
  title: string;
  platform: string | null | undefined;
  coverUrl?: string | null;
  releaseYear?: number | null;
  genre?: string | null;
  developer?: string | null;
  publisher?: string | null;
  description?: string | null;
  version?: string | null;
};

/**
 * Regla de catálogo: resolved = portada HTTP + título válido + plataforma conocida + al menos un dato de ficha.
 * partial = falta portada, plataforma/título mal o ningún dato de ficha extra.
 */
export function deriveMetadataStatusFromGameFields(game: GameFieldsForStatus): 'resolved' | 'partial' {
  if (!hasHttpCover(game.coverUrl)) return 'partial';
  if (isPlaceholderTitle(game.title)) return 'partial';
  if (isUnknownPlatform(game.platform)) return 'partial';
  if (richFieldCount(game) < 1) return 'partial';
  return 'resolved';
}

/** Tras resolver metadatos: mantiene error; el resto se reclasifica por completitud real. */
export function finalizeMetadataResult(result: MetadataResult): MetadataResult {
  if (result.status === 'error') return result;
  return {
    ...result,
    status: deriveMetadataStatusFromGameFields(result),
  };
}
