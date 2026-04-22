/**
 * Precio «en tienda» desde gameplaystores.es (misma búsqueda JSON que portadas).
 * Sin API key; el listado incluye `price` tipo "7,95 €" (EUR, impuestos incluidos en tienda).
 */

import { findBestGameplayStoresProduct } from './gameplayStoresCoverProvider';

/**
 * Convierte el texto de precio del JSON de PrestaShop (EUR) a céntimos.
 */
export function parseGpsEuroPriceString(raw: string | undefined | null): { cents: number; currency: 'EUR' } | null {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  // "7,95 €", "7.95 €", "29'95 €" (tienda usa a veces ' como separador decimal)
  const m = s.match(/(\d+)\s*[.,\u0027\u2019](\d{2})/);
  if (!m) return null;
  const euros = parseInt(m[1], 10);
  const centsPart = parseInt(m[2], 10);
  if (centsPart > 99) return null;
  const cents = euros * 100 + centsPart;
  if (cents <= 0) return null;
  return { cents, currency: 'EUR' };
}

export async function resolveRetailPriceFromGameplayStoresSearch(
  title: string,
  platformHint: string | null | undefined
): Promise<{ cents: number; currency: 'EUR' } | null> {
  /** El listado a veces no trae `cover` pero sí `price`; no exigir imagen para cotizar. */
  const p = await findBestGameplayStoresProduct(title, platformHint, { requireCover: false });
  return parseGpsEuroPriceString(p?.price);
}
