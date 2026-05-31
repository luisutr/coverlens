/**
 * Preferencias de orden y activación para la cadena de metadatos de ficha (título, plataforma, texto, portada de metadatos).
 * CoverLens es la fuente integrada por defecto. IGDB y ScreenScraper son opcionales (credenciales del usuario).
 * GameplayStores desactivado (nivel C — sin confirmación de uso).
 */
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'coverlens_metadata_source_prefs_v1';

export type MetadataProviderId = 'cholloweb' | 'gameplaystores' | 'igdb' | 'screenscraper';

export const ALL_METADATA_PROVIDER_IDS: MetadataProviderId[] = ['cholloweb', 'gameplaystores', 'igdb', 'screenscraper'];

export const METADATA_PROVIDER_LABELS: Record<MetadataProviderId, string> = {
  cholloweb: 'CoverLens (integrado, sin clave)',
  gameplaystores: 'GameplayStores (desactivado)',
  igdb: 'IGDB (opcional — credenciales Twitch)',
  screenscraper: 'ScreenScraper (opcional — usuario/contraseña)',
};

export type MetadataSourcePreferences = {
  order: MetadataProviderId[];
  enabled: Record<MetadataProviderId, boolean>;
};

export const DEFAULT_METADATA_SOURCE_PREFERENCES: MetadataSourcePreferences = {
  order: [...ALL_METADATA_PROVIDER_IDS],
  enabled: {
    cholloweb: true,
    gameplaystores: false, // nivel C — sin confirmación de uso
    igdb: true,
    screenscraper: true,
  },
};

export function normalizeMetadataSourcePreferences(raw: unknown): MetadataSourcePreferences {
  const def = DEFAULT_METADATA_SOURCE_PREFERENCES;
  if (!raw || typeof raw !== 'object') {
    return { order: [...def.order], enabled: { ...def.enabled } };
  }
  const r = raw as Partial<MetadataSourcePreferences>;
  const seen = new Set<MetadataProviderId>();
  const order: MetadataProviderId[] = [];
  if (Array.isArray(r.order)) {
    for (const x of r.order) {
      if (ALL_METADATA_PROVIDER_IDS.includes(x as MetadataProviderId) && !seen.has(x as MetadataProviderId)) {
        seen.add(x as MetadataProviderId);
        order.push(x as MetadataProviderId);
      }
    }
  }
  for (const id of ALL_METADATA_PROVIDER_IDS) {
    if (!seen.has(id)) order.push(id);
  }
  const enabled: Record<MetadataProviderId, boolean> = { ...def.enabled };
  if (r.enabled && typeof r.enabled === 'object') {
    for (const id of ALL_METADATA_PROVIDER_IDS) {
      const v = (r.enabled as Record<string, unknown>)[id];
      if (typeof v === 'boolean') enabled[id] = v;
    }
  }
  return { order, enabled };
}

export async function loadMetadataSourcePreferences(): Promise<MetadataSourcePreferences> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) {
      return {
        ...DEFAULT_METADATA_SOURCE_PREFERENCES,
        order: [...DEFAULT_METADATA_SOURCE_PREFERENCES.order],
      };
    }
    return normalizeMetadataSourcePreferences(JSON.parse(raw));
  } catch {
    return {
      ...DEFAULT_METADATA_SOURCE_PREFERENCES,
      order: [...DEFAULT_METADATA_SOURCE_PREFERENCES.order],
    };
  }
}

export async function saveMetadataSourcePreferences(prefs: MetadataSourcePreferences): Promise<void> {
  const normalized = normalizeMetadataSourcePreferences(prefs);
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(normalized));
}

export function moveMetadataProvider(
  prefs: MetadataSourcePreferences,
  id: MetadataProviderId,
  direction: 'up' | 'down'
): MetadataSourcePreferences {
  const idx = prefs.order.indexOf(id);
  if (idx < 0) return prefs;
  const next = [...prefs.order];
  const j = direction === 'up' ? idx - 1 : idx + 1;
  if (j < 0 || j >= next.length) return prefs;
  [next[idx], next[j]] = [next[j]!, next[idx]!];
  return { ...prefs, order: next };
}
