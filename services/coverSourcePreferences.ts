/**
 * Preferencias de orden y activación de fuentes para la cadena de portadas del catálogo.
 * CoverLens es la fuente integrada por defecto. SteamGridDB, ScreenScraper e IGDB son opcionales.
 * GameplayStores desactivado (nivel C — sin confirmación de uso).
 */
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'coverlens_cover_source_prefs_v1';

export type CoverProviderId = 'cholloweb' | 'gameplaystores' | 'steamgriddb' | 'igdb' | 'screenscraper';

export const ALL_COVER_PROVIDER_IDS: CoverProviderId[] = [
  'cholloweb',
  'gameplaystores',
  'steamgriddb',
  'igdb',
  'screenscraper',
];

export const COVER_PROVIDER_LABELS: Record<CoverProviderId, string> = {
  cholloweb: 'CoverLens (integrado)',
  gameplaystores: 'GameplayStores (desactivado)',
  steamgriddb: 'SteamGridDB (opcional — API key)',
  igdb: 'IGDB (opcional — credenciales Twitch)',
  screenscraper: 'ScreenScraper (opcional — usuario/contraseña)',
};

export type CoverSourcePreferences = {
  order: CoverProviderId[];
  enabled: Record<CoverProviderId, boolean>;
};

export const DEFAULT_COVER_SOURCE_PREFERENCES: CoverSourcePreferences = {
  order: [...ALL_COVER_PROVIDER_IDS],
  enabled: {
    cholloweb: true,
    gameplaystores: false, // nivel C — sin confirmación de uso
    steamgriddb: true,
    igdb: true,
    screenscraper: true,
  },
};

export function normalizeCoverSourcePreferences(raw: unknown): CoverSourcePreferences {
  const def = DEFAULT_COVER_SOURCE_PREFERENCES;
  if (!raw || typeof raw !== 'object') {
    return { order: [...def.order], enabled: { ...def.enabled } };
  }
  const r = raw as Partial<CoverSourcePreferences>;
  const seen = new Set<CoverProviderId>();
  const order: CoverProviderId[] = [];
  if (Array.isArray(r.order)) {
    for (const x of r.order) {
      if (ALL_COVER_PROVIDER_IDS.includes(x as CoverProviderId) && !seen.has(x as CoverProviderId)) {
        seen.add(x as CoverProviderId);
        order.push(x as CoverProviderId);
      }
    }
  }
  for (const id of ALL_COVER_PROVIDER_IDS) {
    if (!seen.has(id)) order.push(id);
  }
  const enabled: Record<CoverProviderId, boolean> = { ...def.enabled };
  if (r.enabled && typeof r.enabled === 'object') {
    for (const id of ALL_COVER_PROVIDER_IDS) {
      const v = (r.enabled as Record<string, unknown>)[id];
      if (typeof v === 'boolean') enabled[id] = v;
    }
  }
  return { order, enabled };
}

export async function loadCoverSourcePreferences(): Promise<CoverSourcePreferences> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_COVER_SOURCE_PREFERENCES, order: [...DEFAULT_COVER_SOURCE_PREFERENCES.order] };
    return normalizeCoverSourcePreferences(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_COVER_SOURCE_PREFERENCES, order: [...DEFAULT_COVER_SOURCE_PREFERENCES.order] };
  }
}

export async function saveCoverSourcePreferences(prefs: CoverSourcePreferences): Promise<void> {
  const normalized = normalizeCoverSourcePreferences(prefs);
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(normalized));
}

export function moveCoverProvider(
  prefs: CoverSourcePreferences,
  id: CoverProviderId,
  direction: 'up' | 'down'
): CoverSourcePreferences {
  const idx = prefs.order.indexOf(id);
  if (idx < 0) return prefs;
  const next = [...prefs.order];
  const j = direction === 'up' ? idx - 1 : idx + 1;
  if (j < 0 || j >= next.length) return prefs;
  [next[idx], next[j]] = [next[j]!, next[idx]!];
  return { ...prefs, order: next };
}
