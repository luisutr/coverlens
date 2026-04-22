import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/providers/gameplayStoresPriceProvider', () => ({
  resolveRetailPriceFromGameplayStoresSearch: vi.fn(),
}));
vi.mock('../services/pricechartingProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/pricechartingProvider')>();
  return { ...actual, fetchPriceChartingProduct: vi.fn() };
});
vi.mock('../services/ebayPriceProvider', () => ({
  fetchEbayApplicationToken: vi.fn(),
  medianActiveListingPrice: vi.fn(),
}));

import { fetchPriceChartingProduct } from '../services/pricechartingProvider';
import { fetchEbayApplicationToken, medianActiveListingPrice } from '../services/ebayPriceProvider';
import { resolveRetailPriceFromGameplayStoresSearch } from '../services/providers/gameplayStoresPriceProvider';
import { resolveValueEstimateFromPreferences } from '../services/valuePreferenceResolver';
import { DEFAULT_VALUE_SOURCE_PREFERENCES } from '../services/valueSourcePreferences';
import type { ApiCredentials } from '../services/credentialsStore';

const creds: ApiCredentials = {
  screenScraperUsername: '',
  screenScraperPassword: '',
  screenScraperDevId: '',
  screenScraperDevPassword: '',
  steamGridDbApiKey: '',
  igdbClientId: '',
  igdbClientSecret: '',
  priceChartingToken: 'test-token',
  ebayClientId: 'ebay-id',
  ebayClientSecret: 'ebay-secret',
  ebayMarketplaceId: 'EBAY_ES',
};

describe('resolveValueEstimateFromPreferences — orden por defecto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveRetailPriceFromGameplayStoresSearch).mockResolvedValue(null);
    vi.mocked(fetchPriceChartingProduct).mockResolvedValue(null);
    vi.mocked(fetchEbayApplicationToken).mockResolvedValue('ebay-app-token');
    vi.mocked(medianActiveListingPrice).mockResolvedValue(null);
  });

  it('GameplayStores tiene prioridad si devuelve precio', async () => {
    vi.mocked(resolveRetailPriceFromGameplayStoresSearch).mockResolvedValue({ cents: 1500, currency: 'EUR' });
    vi.mocked(fetchPriceChartingProduct).mockResolvedValue({
      looseCents: 999,
      cibCents: 1999,
      newCents: null,
      productName: 'X',
      consoleName: 'Y',
    });
    vi.mocked(medianActiveListingPrice).mockResolvedValue({ cents: 3000, currency: 'EUR' });

    const r = await resolveValueEstimateFromPreferences({
      title: 'Mario 64',
      platform: 'Nintendo 64',
      barcode: null,
      discOnly: false,
      creds,
      prefs: DEFAULT_VALUE_SOURCE_PREFERENCES,
    });

    expect(r).toEqual({ cents: 1500, currency: 'EUR', source: 'gameplaystores' });
    expect(fetchPriceChartingProduct).not.toHaveBeenCalled();
    expect(medianActiveListingPrice).not.toHaveBeenCalled();
  });

  it('si GameplayStores falla, usa PriceCharting antes que eBay', async () => {
    vi.mocked(fetchPriceChartingProduct).mockResolvedValue({
      looseCents: 100,
      cibCents: 200,
      newCents: null,
      productName: 'Mario 64',
      consoleName: 'N64',
    });

    const r = await resolveValueEstimateFromPreferences({
      title: 'Mario 64',
      platform: 'Nintendo 64',
      barcode: null,
      discOnly: false,
      creds,
      prefs: DEFAULT_VALUE_SOURCE_PREFERENCES,
    });

    expect(r?.source).toBe('pricecharting');
    expect(r?.cents).toBe(200);
    expect(medianActiveListingPrice).not.toHaveBeenCalled();
  });

  it('si GameplayStores y PriceCharting no aportan valor, intenta eBay', async () => {
    vi.mocked(fetchPriceChartingProduct).mockResolvedValue(null);
    vi.mocked(medianActiveListingPrice).mockResolvedValue({ cents: 4500, currency: 'EUR' });

    const r = await resolveValueEstimateFromPreferences({
      title: 'Rare Game',
      platform: 'PS2',
      barcode: null,
      discOnly: false,
      creds,
      prefs: DEFAULT_VALUE_SOURCE_PREFERENCES,
    });

    expect(r?.source).toBe('ebay');
    expect(fetchPriceChartingProduct).toHaveBeenCalled();
  });

  it('respeta prefs.order: eBay antes que GameplayStores', async () => {
    vi.mocked(resolveRetailPriceFromGameplayStoresSearch).mockResolvedValue({ cents: 100, currency: 'EUR' });
    vi.mocked(medianActiveListingPrice).mockResolvedValue({ cents: 50, currency: 'EUR' });

    const r = await resolveValueEstimateFromPreferences({
      title: 'Test',
      platform: 'PS1',
      barcode: null,
      discOnly: false,
      creds,
      prefs: {
        order: ['ebay', 'gameplaystores', 'pricecharting'],
        enabled: DEFAULT_VALUE_SOURCE_PREFERENCES.enabled,
      },
    });

    expect(r?.source).toBe('ebay');
    expect(resolveRetailPriceFromGameplayStoresSearch).not.toHaveBeenCalled();
  });
});
