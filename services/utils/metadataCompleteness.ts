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

type RichMetadataFields = {
  releaseYear?: number | null;
  genre?: string | null;
  developer?: string | null;
  publisher?: string | null;
  description?: string | null;
};

/** Todos los campos de ficha de texto deben estar rellenos (sin exigir barcode, precio ni versión/edición). */
function hasAllRichMetadataFields(fields: RichMetadataFields): boolean {
  if (fields.releaseYear == null || Number.isNaN(Number(fields.releaseYear))) return false;
  if (!(fields.genre?.trim() ?? '').length) return false;
  if (!(fields.developer?.trim() ?? '').length) return false;
  if (!(fields.publisher?.trim() ?? '').length) return false;
  if ((fields.description?.trim() ?? '').length <= 24) return false;
  return true;
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
 * Regla de catálogo: resolved = portada HTTP + título válido + plataforma conocida + todos los campos de ficha.
 * partial = falta portada, plataforma/título mal o cualquier campo de ficha vacío (año, género, dev, pub, descripción).
 */
export function deriveMetadataStatusFromGameFields(game: GameFieldsForStatus): 'resolved' | 'partial' {
  if (!hasHttpCover(game.coverUrl)) return 'partial';
  if (isPlaceholderTitle(game.title)) return 'partial';
  if (isUnknownPlatform(game.platform)) return 'partial';
  if (!hasAllRichMetadataFields(game)) return 'partial';
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
