/**
 * Contrato de orden por defecto (Ajustes → fuentes):
 * - Portada: CoverLens Resource → GameplayStores → SteamGridDB → IGDB → ScreenScraper
 * - Metadatos: CoverLens Resource → GameplayStores → IGDB → ScreenScraper
 * - Valor: CoverLens Resource → GameplayStores → PriceCharting → eBay
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/providers/screenScraperProvider', () => ({
  resolveCoverFromScreenScraperSearch: vi.fn(),
}));
vi.mock('../services/providers/steamGridDbProvider', () => ({
  resolveCoverFromSteamGridDb: vi.fn(),
}));
vi.mock('../services/providers/gameplayStoresCoverProvider', () => ({
  resolveCoverFromGameplayStoresSearch: vi.fn(),
}));
vi.mock('../services/providers/coverLensResourceProvider', () => ({
  resolveCoverFromCoverLensResource: vi.fn(),
}));
import {
  ALL_COVER_PROVIDER_IDS,
  DEFAULT_COVER_SOURCE_PREFERENCES,
  normalizeCoverSourcePreferences,
} from '../services/coverSourcePreferences';
import {
  ALL_METADATA_PROVIDER_IDS,
  DEFAULT_METADATA_SOURCE_PREFERENCES,
  normalizeMetadataSourcePreferences,
} from '../services/metadataSourcePreferences';
import {
  ALL_VALUE_PROVIDER_IDS,
  DEFAULT_VALUE_SOURCE_PREFERENCES,
  normalizeValueSourcePreferences,
} from '../services/valueSourcePreferences';
import { resolvePreferredCoverWithSource } from '../services/coverPreferenceResolver';
import { resolveCoverFromGameplayStoresSearch } from '../services/providers/gameplayStoresCoverProvider';
import { resolveCoverFromCoverLensResource } from '../services/providers/coverLensResourceProvider';
import { resolveCoverFromScreenScraperSearch } from '../services/providers/screenScraperProvider';
import { resolveCoverFromSteamGridDb } from '../services/providers/steamGridDbProvider';

describe('orden por defecto de fuentes (ids)', () => {
  it('portada / imagen: CoverLens Resource → GameplayStores → SteamGridDB → IGDB → ScreenScraper', () => {
    expect(ALL_COVER_PROVIDER_IDS).toEqual([
      'coverlens',
      'gameplaystores',
      'steamgriddb',
      'igdb',
      'screenscraper',
    ]);
    expect(DEFAULT_COVER_SOURCE_PREFERENCES.order).toEqual(ALL_COVER_PROVIDER_IDS);
  });

  it('metadatos: CoverLens Resource → GameplayStores → IGDB → ScreenScraper', () => {
    expect(ALL_METADATA_PROVIDER_IDS).toEqual(['coverlens', 'gameplaystores', 'igdb', 'screenscraper']);
    expect(DEFAULT_METADATA_SOURCE_PREFERENCES.order).toEqual(ALL_METADATA_PROVIDER_IDS);
  });

  it('precio / valor: CoverLens Resource → GameplayStores → PriceCharting → eBay', () => {
    expect(ALL_VALUE_PROVIDER_IDS).toEqual(['coverlens', 'gameplaystores', 'pricecharting', 'ebay']);
    expect(DEFAULT_VALUE_SOURCE_PREFERENCES.order).toEqual(ALL_VALUE_PROVIDER_IDS);
  });
});

describe('normalize* restaura el orden canónico si falta un id', () => {
  it('cover: orden parcial se rellena al final', () => {
    const n = normalizeCoverSourcePreferences({
      order: ['igdb', 'steamgriddb'],
      enabled: DEFAULT_COVER_SOURCE_PREFERENCES.enabled,
    });
    expect(n.order).toEqual(['igdb', 'steamgriddb', 'coverlens', 'gameplaystores', 'screenscraper']);
  });

  it('metadata: orden parcial se rellena al final', () => {
    const n = normalizeMetadataSourcePreferences({
      order: ['screenscraper'],
      enabled: DEFAULT_METADATA_SOURCE_PREFERENCES.enabled,
    });
    expect(n.order).toEqual(['screenscraper', 'coverlens', 'gameplaystores', 'igdb']);
  });

  it('value: orden parcial se rellena al final', () => {
    const n = normalizeValueSourcePreferences({
      order: ['ebay'],
      enabled: DEFAULT_VALUE_SOURCE_PREFERENCES.enabled,
    });
    expect(n.order).toEqual(['ebay', 'coverlens', 'gameplaystores', 'pricecharting']);
  });
});

describe('resolvePreferredCoverWithSource con DEFAULT_COVER_SOURCE_PREFERENCES', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveCoverFromCoverLensResource).mockResolvedValue(null);
    vi.mocked(resolveCoverFromGameplayStoresSearch).mockResolvedValue(null);
    vi.mocked(resolveCoverFromSteamGridDb).mockResolvedValue(null);
    vi.mocked(resolveCoverFromScreenScraperSearch).mockResolvedValue(null);
  });

  it('recorre portadas en orden: CoverLens → GameplayStores → SteamGridDB → IGDB (fallback) → ScreenScraper', async () => {
    const order: string[] = [];
    vi.mocked(resolveCoverFromCoverLensResource).mockImplementation(async () => {
      order.push('coverlens');
      return null;
    });
    vi.mocked(resolveCoverFromGameplayStoresSearch).mockImplementation(async () => {
      order.push('gameplaystores');
      return null;
    });
    vi.mocked(resolveCoverFromSteamGridDb).mockImplementation(async () => {
      order.push('steamgriddb');
      return null;
    });
    vi.mocked(resolveCoverFromScreenScraperSearch).mockImplementation(async () => {
      order.push('screenscraper');
      return 'https://ss/cover.png';
    });

    const { url, source } = await resolvePreferredCoverWithSource(
      'Juego Test',
      'PS2',
      null,
      DEFAULT_COVER_SOURCE_PREFERENCES
    );

    expect(order).toEqual(['coverlens', 'gameplaystores', 'steamgriddb', 'screenscraper']);
    expect(url).toBe('https://ss/cover.png');
    expect(source).toBe('screenscraper');
  });

  it('usa IGDB antes que ScreenScraper si hay URL de metadatos', async () => {
    vi.mocked(resolveCoverFromSteamGridDb).mockResolvedValue(null);

    const { url, source } = await resolvePreferredCoverWithSource(
      'Juego Test',
      'PS2',
      'https://images.igdb.com/co.jpg',
      DEFAULT_COVER_SOURCE_PREFERENCES
    );

    expect(url).toBe('https://images.igdb.com/co.jpg');
    expect(source).toBe('igdb');
    expect(resolveCoverFromScreenScraperSearch).not.toHaveBeenCalled();
  });
});
