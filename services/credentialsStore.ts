import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'api_credentials_v2';

export type ApiCredentials = {
  screenScraperUsername: string;
  screenScraperPassword: string;
  screenScraperDevId: string;
  screenScraperDevPassword: string;
  steamGridDbApiKey: string;
  igdbClientId: string;
  igdbClientSecret: string;
  /** Token API PriceCharting Pro (parámetro t) */
  priceChartingToken: string;
  /** eBay Developers: para mediana de anuncios activos (Browse API) */
  ebayClientId: string;
  ebayClientSecret: string;
  /** p.ej. EBAY_ES, EBAY_US */
  ebayMarketplaceId: string;
  /** GameUPC: fallback barcode → título (opcional) */
  gameUpcApiKey: string;
};

export const providerLinks = {
  screenScraper: 'https://www.screenscraper.fr',
  steamGridDb: 'https://www.steamgriddb.com',
  igdb: 'https://dev.twitch.tv/console',
  priceCharting: 'https://www.pricecharting.com/pricecharting-pro?f=api',
  ebayDevelopers: 'https://developer.ebay.com',
  gameUpc: 'https://www.gameupc.com/',
};

const EMPTY: ApiCredentials = {
  screenScraperUsername: '',
  screenScraperPassword: '',
  screenScraperDevId: '',
  screenScraperDevPassword: '',
  steamGridDbApiKey: '',
  igdbClientId: '',
  igdbClientSecret: '',
  priceChartingToken: '',
  ebayClientId: '',
  ebayClientSecret: '',
  ebayMarketplaceId: 'EBAY_ES',
  gameUpcApiKey: '',
};

export async function getApiCredentials(): Promise<ApiCredentials> {
  const raw = await SecureStore.getItemAsync(STORAGE_KEY);
  if (!raw) return { ...EMPTY };
  try {
    const parsed = JSON.parse(raw) as Partial<ApiCredentials>;
    return {
      screenScraperUsername: parsed.screenScraperUsername ?? '',
      screenScraperPassword: parsed.screenScraperPassword ?? '',
      screenScraperDevId: parsed.screenScraperDevId ?? '',
      screenScraperDevPassword: parsed.screenScraperDevPassword ?? '',
      steamGridDbApiKey: parsed.steamGridDbApiKey ?? '',
      igdbClientId: parsed.igdbClientId ?? '',
      igdbClientSecret: parsed.igdbClientSecret ?? '',
      priceChartingToken: parsed.priceChartingToken ?? '',
      ebayClientId: parsed.ebayClientId ?? '',
      ebayClientSecret: parsed.ebayClientSecret ?? '',
      ebayMarketplaceId: parsed.ebayMarketplaceId?.trim() || 'EBAY_ES',
      gameUpcApiKey: parsed.gameUpcApiKey ?? '',
    };
  } catch {
    return { ...EMPTY };
  }
}

export async function saveApiCredentials(input: ApiCredentials) {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(input));
}

export async function clearApiCredentials() {
  await SecureStore.deleteItemAsync(STORAGE_KEY);
}

/** IGDB: necesario para resolver bien metadatos al escanear códigos de barras y cabeceras IGDB. */
export function hasIgdbConfigured(input: ApiCredentials): boolean {
  return Boolean(input.igdbClientId.trim() && input.igdbClientSecret.trim());
}

/**
 * @deprecated Usar hasIgdbConfigured o validación por pasos en onboarding.
 * Antes exigía todas las APIs; ahora solo IGDB es el núcleo para barcode + metadatos.
 */
export function hasRequiredOnboardingCredentials(input: ApiCredentials): boolean {
  return hasIgdbConfigured(input);
}
