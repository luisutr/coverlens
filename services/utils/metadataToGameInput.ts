import type { NewGameInput } from '../../database/dbConfig';
import type { MetadataResult } from '../providers/types';

/** Prioriza el código escaneado frente al devuelto por metadatos (p. ej. CoverLens Resource). */
export function pickBarcodeForSave(
  scannedBarcode: string | null | undefined,
  resolved: Pick<MetadataResult, 'barcode'>
): string | null {
  const scanned = scannedBarcode?.trim() ?? '';
  if (scanned.length > 0) return scanned;
  const fromMeta = resolved.barcode?.trim() ?? '';
  return fromMeta.length > 0 ? fromMeta : null;
}

type NewGameExtras = {
  scannedBarcode?: string | null;
  favorite?: number;
  discOnly?: number;
  title?: string;
  platform?: string;
};

export function newGameFieldsFromMetadata(
  resolved: MetadataResult,
  extras: NewGameExtras = {}
): NewGameInput {
  return {
    title: extras.title ?? resolved.title,
    barcode: pickBarcodeForSave(extras.scannedBarcode, resolved),
    platform: extras.platform ?? resolved.platform,
    version: resolved.version,
    releaseYear: resolved.releaseYear,
    genre: resolved.genre,
    developer: resolved.developer,
    publisher: resolved.publisher,
    description: resolved.description,
    rating: resolved.rating,
    franchise: resolved.franchise,
    textLanguages: resolved.textLanguages ?? null,
    voiceLanguages: resolved.voiceLanguages ?? null,
    coverUrl: resolved.coverUrl ?? null,
    headerImageUrl: resolved.headerImageUrl ?? null,
    metadataStatus: resolved.status,
    metadataSource: resolved.source,
    lastError: resolved.error ?? null,
    favorite: extras.favorite ?? 0,
    discOnly: extras.discOnly ?? 0,
    valueCents: resolved.valueCents ?? null,
    valueCurrency: resolved.valueCurrency ?? null,
    valueSource: resolved.valueSource ?? null,
  };
}
