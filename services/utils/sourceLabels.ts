import type { ValueSource } from '../../database/dbConfig';
import { COVER_PROVIDER_LABELS, type CoverProviderId } from '../coverSourcePreferences';
import { METADATA_PROVIDER_LABELS, type MetadataProviderId } from '../metadataSourcePreferences';
import { VALUE_PROVIDER_LABELS, type ValueProviderId } from '../valueSourcePreferences';

const SOURCE_HOME_URLS: Record<string, string> = {
  coverlens: 'https://covers.cholloweb.es/',
  gameplaystores: 'https://www.gameplaystores.es/',
  igdb: 'https://api-docs.igdb.com/',
  screenscraper: 'https://www.screenscraper.fr/',
  steamgriddb: 'https://www.steamgriddb.com/',
  pricecharting: 'https://www.pricecharting.com/',
  ebay: 'https://www.ebay.es/',
};

const METADATA_SOURCE_ALIASES: Record<string, MetadataProviderId | 'local' | 'cover_fallback'> = {
  coverlens: 'coverlens',
  gameplaystores: 'gameplaystores',
  igdb: 'igdb',
  screenscraper: 'screenscraper',
  local: 'local',
  cover_fallback: 'cover_fallback',
};

/** Etiqueta legible de la fuente de metadatos guardada en BD (`metadataSource`). */
export function formatMetadataSourceLabel(source: string | null | undefined): string | null {
  const raw = source?.trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();

  if (lower.startsWith('import:')) {
    const kind = lower.slice('import:'.length);
    if (kind.includes('coverlens')) return METADATA_PROVIDER_LABELS.coverlens;
    if (kind.includes('playnite')) return 'Importación Playnite';
    return `Importación (${kind})`;
  }
  if (lower.includes('gemini')) return 'Escaneo por lote (Gemini)';
  if (lower === 'local') return 'Datos locales';
  if (lower === 'cover_fallback') return 'Cadena de portadas (Ajustes)';

  const alias = METADATA_SOURCE_ALIASES[lower];
  if (alias && alias !== 'local' && alias !== 'cover_fallback') {
    return METADATA_PROVIDER_LABELS[alias];
  }
  if (alias === 'local') return 'Datos locales';
  if (alias === 'cover_fallback') return 'Cadena de portadas (Ajustes)';

  for (const id of Object.keys(METADATA_PROVIDER_LABELS) as MetadataProviderId[]) {
    if (lower.includes(id)) return METADATA_PROVIDER_LABELS[id];
  }
  return raw;
}

/** Etiqueta legible según el host de una URL de imagen (portada o cabecera). */
export function inferImageSourceLabel(imageUrl: string | null | undefined): string | null {
  const u = imageUrl?.trim().toLowerCase() ?? '';
  if (!u || !/^https?:\/\//i.test(u)) return null;
  if (u.includes('cholloweb.es')) return COVER_PROVIDER_LABELS.coverlens;
  if (u.includes('gameplaystores.es') || u.includes('media.gameplaystores')) {
    return COVER_PROVIDER_LABELS.gameplaystores;
  }
  if (u.includes('steamgriddb.com')) return COVER_PROVIDER_LABELS.steamgriddb;
  if (u.includes('igdb.com')) return 'IGDB';
  if (u.includes('screenscraper.fr')) return COVER_PROVIDER_LABELS.screenscraper;
  return 'Web';
}

/** Etiqueta legible del id de fuente de portada devuelto por la cadena de resolución. */
export function formatCoverProviderLabel(sourceId: string | null | undefined): string | null {
  const raw = sourceId?.trim().toLowerCase();
  if (!raw) return null;
  if (raw in COVER_PROVIDER_LABELS) return COVER_PROVIDER_LABELS[raw as CoverProviderId];
  return inferImageSourceLabel(raw) ?? raw;
}

/** Etiqueta legible de valor estimado (`valueSource` en BD). */
export function formatValueSourceLabel(source: ValueSource | null | undefined): string | null {
  if (!source) return null;
  if (source in VALUE_PROVIDER_LABELS) return VALUE_PROVIDER_LABELS[source as ValueProviderId];
  if (source === 'manual') return 'Manual';
  return source;
}

export function resolveMetadataSourceUrl(source: string | null | undefined): string | null {
  const raw = source?.trim().toLowerCase() ?? '';
  if (!raw) return null;
  if (raw.includes('coverlens')) return SOURCE_HOME_URLS.coverlens;
  if (raw.includes('gameplaystores') || raw.includes('gameupc')) return SOURCE_HOME_URLS.gameplaystores;
  if (raw.includes('igdb')) return SOURCE_HOME_URLS.igdb;
  if (raw.includes('screenscraper')) return SOURCE_HOME_URLS.screenscraper;
  if (raw.includes('steamgriddb')) return SOURCE_HOME_URLS.steamgriddb;
  if (raw === 'cover_fallback') return null;
  return null;
}

export function resolveImageSourceUrl(imageUrl: string | null | undefined): string | null {
  const u = imageUrl?.trim().toLowerCase() ?? '';
  if (!u) return null;
  if (u.includes('cholloweb.es')) return SOURCE_HOME_URLS.coverlens;
  if (u.includes('gameplaystores.es') || u.includes('media.gameplaystores')) return SOURCE_HOME_URLS.gameplaystores;
  if (u.includes('steamgriddb.com')) return SOURCE_HOME_URLS.steamgriddb;
  if (u.includes('igdb.com')) return SOURCE_HOME_URLS.igdb;
  if (u.includes('screenscraper.fr')) return SOURCE_HOME_URLS.screenscraper;
  return null;
}

export function resolveValueSourceUrl(source: ValueSource | null | undefined): string | null {
  if (!source || source === 'manual') return null;
  return SOURCE_HOME_URLS[source] ?? null;
}

/** @deprecated Usar inferImageSourceLabel */
export function inferCoverSourceLabel(coverUrl: string | null | undefined): string | null {
  return inferImageSourceLabel(coverUrl);
}
