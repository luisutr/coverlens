import type { MetadataResult } from './providers/types';
import { hasHttpCover, isPlaceholderTitle, isUnknownPlatform } from './utils/metadataCompleteness';

function pickStr(a: string | null | undefined, b: string | null | undefined): string | null {
  const ta = a?.trim() ?? '';
  if (ta.length > 0) return a!.trim();
  const tb = b?.trim() ?? '';
  return tb.length > 0 ? b!.trim() : null;
}

function pickNum(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a != null && !Number.isNaN(Number(a))) return a;
  if (b != null && !Number.isNaN(Number(b))) return b;
  return null;
}

export function mergeMetadataSourceLabel(prev: string | undefined, next: string | undefined): string {
  const x = prev?.trim() ?? '';
  const y = next?.trim() ?? '';
  if (!x) return y || 'local';
  if (!y || x === y) return x;
  if (x.includes(y)) return x;
  return `${x}+${y}`;
}

/** Capas en orden: la primera fuente gana en conflicto; las siguientes solo rellenan huecos. */
export function mergeMetadataLayers(base: MetadataResult | null, layer: MetadataResult): MetadataResult {
  if (!base) return { ...layer };

  const title = !isPlaceholderTitle(base.title) ? base.title : layer.title;
  const platform = !isUnknownPlatform(base.platform) ? base.platform : layer.platform;

  return {
    title,
    platform,
    version: pickStr(base.version, layer.version),
    releaseYear: pickNum(base.releaseYear, layer.releaseYear),
    genre: pickStr(base.genre, layer.genre),
    developer: pickStr(base.developer, layer.developer),
    publisher: pickStr(base.publisher, layer.publisher),
    description: pickStr(base.description, layer.description),
    rating: pickNum(base.rating, layer.rating),
    franchise: pickStr(base.franchise, layer.franchise),
    coverUrl: hasHttpCover(base.coverUrl) ? base.coverUrl! : layer.coverUrl ?? null,
    headerImageUrl: hasHttpCover(base.headerImageUrl) ? base.headerImageUrl! : layer.headerImageUrl ?? null,
    status: 'partial',
    source: mergeMetadataSourceLabel(base.source, layer.source),
    error: layer.error ?? base.error,
    valueCents: base.valueCents != null ? base.valueCents : layer.valueCents ?? null,
    valueCurrency: base.valueCurrency ?? layer.valueCurrency ?? null,
    valueSource: base.valueSource ?? layer.valueSource ?? null,
  };
}

export function isUsableMetadataLayer(r: MetadataResult | null | undefined): boolean {
  if (!r) return false;
  if (r.status === 'error') return false;
  return true;
}
