/**
 * Resuelve valor estimado siguiendo preferencias (orden + fuentes activas), como las portadas.
 */
import type { ApiCredentials } from './credentialsStore';
import { fetchEbayApplicationToken, medianActiveListingPrice } from './ebayPriceProvider';
import { fetchPriceChartingProduct, pickPriceChartingCents, type PcCondition } from './pricechartingProvider';
import { resolveValueFromCoverLensResource } from './providers/coverLensResourceProvider';
import { resolveRetailPriceFromGameplayStoresSearch } from './providers/gameplayStoresPriceProvider';
import type { ValueSourcePreferences } from './valueSourcePreferences';

export type ResolvedValueEstimate = {
  cents: number;
  currency: string;
  source: 'coverlens' | 'gameplaystores' | 'pricecharting' | 'ebay';
};

export async function resolveValueEstimateFromPreferences(
  params: {
    title: string;
    platform: string;
    barcode: string | null | undefined;
    discOnly: boolean;
    creds: ApiCredentials;
    prefs: ValueSourcePreferences;
  }
): Promise<ResolvedValueEstimate | null> {
  const { title, platform, barcode, discOnly, creds, prefs } = params;
  const t = title.trim();
  const plat = platform.trim();
  if (!t || !plat) return null;

  for (const id of prefs.order) {
    if (!prefs.enabled[id]) continue;
    switch (id) {
      case 'coverlens': {
        const c = await resolveValueFromCoverLensResource(t, plat);
        if (c) return { cents: c.cents, currency: c.currency, source: 'coverlens' };
        break;
      }
      case 'gameplaystores': {
        const g = await resolveRetailPriceFromGameplayStoresSearch(t, plat);
        if (g) return { cents: g.cents, currency: g.currency, source: 'gameplaystores' };
        break;
      }
      case 'pricecharting': {
        const token = creds.priceChartingToken?.trim();
        if (!token) break;
        let picked: { cents: number; condition: PcCondition } | null = null;
        const bc = barcode?.trim();
        if (bc) {
          const q1 = await fetchPriceChartingProduct(token, { upc: bc });
          if (q1) picked = pickPriceChartingCents(q1, discOnly);
        }
        if (!picked) {
          const q2 = await fetchPriceChartingProduct(token, { query: `${t} ${plat}`.trim() });
          if (q2) picked = pickPriceChartingCents(q2, discOnly);
        }
        if (picked) {
          return { cents: picked.cents, currency: 'USD', source: 'pricecharting' };
        }
        break;
      }
      case 'ebay': {
        const cid = creds.ebayClientId?.trim();
        const sec = creds.ebayClientSecret?.trim();
        if (!cid || !sec) break;
        const tok = await fetchEbayApplicationToken(cid, sec);
        if (!tok) break;
        const marketplace = creds.ebayMarketplaceId?.trim() || 'EBAY_ES';
        const med = await medianActiveListingPrice(tok, marketplace, t, plat, cid);
        if (med) {
          return { cents: med.cents, currency: med.currency, source: 'ebay' };
        }
        break;
      }
    }
  }

  return null;
}
