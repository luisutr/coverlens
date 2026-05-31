/**
 * Preferencias de orden y activación para la cadena de valor / cotización en ficha.
 * CoverLens es la fuente integrada por defecto. PriceCharting y eBay son opcionales (credenciales del usuario).
 * GameplayStores desactivado (nivel C — sin confirmación de uso).
 */
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'coverlens_value_source_prefs_v1';

export type ValueProviderId = 'cholloweb' | 'gameplaystores' | 'pricecharting' | 'ebay';

export const ALL_VALUE_PROVIDER_IDS: ValueProviderId[] = ['cholloweb', 'gameplaystores', 'pricecharting', 'ebay'];

export const VALUE_PROVIDER_LABELS: Record<ValueProviderId, string> = {
  cholloweb: 'CoverLens (integrado, valor EUR)',
  gameplaystores: 'GameplayStores (desactivado)',
  pricecharting: 'PriceCharting Pro (opcional — guía USD)',
  ebay: 'eBay (opcional — mediana anuncios activos)',
};

export type ValueSourcePreferences = {
  order: ValueProviderId[];
  enabled: Record<ValueProviderId, boolean>;
};

export const DEFAULT_VALUE_SOURCE_PREFERENCES: ValueSourcePreferences = {
  order: [...ALL_VALUE_PROVIDER_IDS],
  enabled: {
    cholloweb: true,
    gameplaystores: false, // nivel C — sin confirmación de uso
    pricecharting: true,
    ebay: true,
  },
};

export function normalizeValueSourcePreferences(raw: unknown): ValueSourcePreferences {
  const def = DEFAULT_VALUE_SOURCE_PREFERENCES;
  if (!raw || typeof raw !== 'object') {
    return { order: [...def.order], enabled: { ...def.enabled } };
  }
  const r = raw as Partial<ValueSourcePreferences>;
  const seen = new Set<ValueProviderId>();
  const order: ValueProviderId[] = [];
  if (Array.isArray(r.order)) {
    for (const x of r.order) {
      if (ALL_VALUE_PROVIDER_IDS.includes(x as ValueProviderId) && !seen.has(x as ValueProviderId)) {
        seen.add(x as ValueProviderId);
        order.push(x as ValueProviderId);
      }
    }
  }
  for (const id of ALL_VALUE_PROVIDER_IDS) {
    if (!seen.has(id)) order.push(id);
  }
  const enabled: Record<ValueProviderId, boolean> = { ...def.enabled };
  if (r.enabled && typeof r.enabled === 'object') {
    for (const id of ALL_VALUE_PROVIDER_IDS) {
      const v = (r.enabled as Record<string, unknown>)[id];
      if (typeof v === 'boolean') enabled[id] = v;
    }
  }
  return { order, enabled };
}

export async function loadValueSourcePreferences(): Promise<ValueSourcePreferences> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_VALUE_SOURCE_PREFERENCES, order: [...DEFAULT_VALUE_SOURCE_PREFERENCES.order] };
    return normalizeValueSourcePreferences(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_VALUE_SOURCE_PREFERENCES, order: [...DEFAULT_VALUE_SOURCE_PREFERENCES.order] };
  }
}

export async function saveValueSourcePreferences(prefs: ValueSourcePreferences): Promise<void> {
  const normalized = normalizeValueSourcePreferences(prefs);
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(normalized));
}

export function moveValueProvider(
  prefs: ValueSourcePreferences,
  id: ValueProviderId,
  direction: 'up' | 'down'
): ValueSourcePreferences {
  const idx = prefs.order.indexOf(id);
  if (idx < 0) return prefs;
  const next = [...prefs.order];
  const j = direction === 'up' ? idx - 1 : idx + 1;
  if (j < 0 || j >= next.length) return prefs;
  [next[idx], next[j]] = [next[j]!, next[idx]!];
  return { ...prefs, order: next };
}
