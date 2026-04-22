/**
 * Ficha HTML de producto en gameplaystores.es (descripción, género, fecha, precio).
 * Complementa el JSON de búsqueda PrestaShop, que no incluye texto largo ni datos de pestaña.
 */
import { fetchWithTimeout } from '../utils/networkUtils';

export type GpsProductPageDetails = {
  description: string | null;
  genre: string | null;
  releaseYear: number | null;
  priceCents: number | null;
  priceCurrency: 'EUR' | null;
};

const GPS_ORIGIN = 'https://www.gameplaystores.es';

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Extrae URL absoluta del producto desde el objeto del JSON de búsqueda PrestaShop.
 */
export function resolveGpsProductAbsoluteUrl(product: {
  url?: string | null;
  link?: string | null;
  canonical_url?: string | null;
  id_product?: string | number | null;
}): string | null {
  const raw = product.url ?? product.link ?? product.canonical_url;
  if (raw && typeof raw === 'string') {
    const t = raw.trim();
    if (t) {
      if (/^https?:\/\//i.test(t)) return t;
      if (t.startsWith('//')) return `https:${t}`;
      if (t.startsWith('/')) return `${GPS_ORIGIN}${t}`;
      return `${GPS_ORIGIN}/${t.replace(/^\//, '')}`;
    }
  }
  const id = product.id_product;
  if (id != null && String(id).replace(/\D/g, '').length > 0) {
    return `${GPS_ORIGIN}/index.php?id_product=${encodeURIComponent(String(id))}&controller=product`;
  }
  return null;
}

/**
 * Parsea HTML de ficha de producto (PrestaShop / tema GameplayStores).
 * Expuesto para tests con HTML guardado.
 */
function extractDescriptionFromProductHtml(html: string): string | null {
  const inDescTab = html.match(
    /id=["']description["'][\s\S]*?<div[^>]*\brte-content\b[^>]*>([\s\S]*?)<\/div>/i
  );
  if (inDescTab?.[1]) {
    const text = stripTags(inDescTab[1]).trim();
    if (text.length > 12) return text;
  }
  const inProdDesc = html.match(
    /<div[^>]*class="[^"]*product-description[^"]*"[^>]*>[\s\S]*?<div[^>]*\brte-content\b[^>]*>([\s\S]*?)<\/div>/i
  );
  if (inProdDesc?.[1]) {
    const text = stripTags(inProdDesc[1]).trim();
    if (text.length > 12) return text;
  }
  let best = '';
  const re = /<div[^>]*\brte-content\b[^>]*>([\s\S]*?)<\/div>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const text = stripTags(m[1] ?? '').trim();
    if (text.length > best.length) best = text;
  }
  return best.length > 12 ? best : null;
}

export function parseGameplayStoresProductPageHtml(html: string): GpsProductPageDetails {
  const description = extractDescriptionFromProductHtml(html);

  let genre: string | null = null;
  const genDt = html.match(
    /<dt[^>]*>[\s\n]*G[ée]nero[\s\n]*<\/dt>[\s\n]*<dd[^>]*>([^<]+)<\/dd>/i
  );
  if (genDt?.[1]) {
    const g = genDt[1].replace(/\s+/g, ' ').trim();
    if (g.length > 0 && g.length < 120) genre = g;
  }

  let releaseYear: number | null = null;
  const launch = html.match(
    /Lanzamiento:[\s\S]{0,200}?<dd[^>]*class=["']value["'][^>]*>(\d{1,2})\/(\d{1,2})\/(\d{4})<\/dd>/i
  );
  if (launch?.[3]) {
    const y = parseInt(launch[3], 10);
    if (y >= 1970 && y <= 2100) releaseYear = y;
  }

  let priceCents: number | null = null;
  let priceCurrency: 'EUR' | null = null;
  const intPart = html.match(/class="price-amount-integer"[^>]*>(\d+)</i);
  const decPart = html.match(/class="price-amount-decimal"[^>]*>(\d{2})</i);
  if (intPart?.[1] && decPart?.[1]) {
    const euros = parseInt(intPart[1], 10);
    const cents = parseInt(decPart[1], 10);
    if (cents <= 99 && euros >= 0) {
      priceCents = euros * 100 + cents;
      priceCurrency = 'EUR';
    }
  }

  return { description, genre, releaseYear, priceCents, priceCurrency };
}

/** Portada en ficha (og:image) cuando el JSON de búsqueda no incluye `cover`. */
export function parseOgImageUrlFromGpsProductHtml(html: string): string | null {
  const m =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  const raw = m?.[1]?.trim();
  if (!raw || !/^https?:\/\//i.test(raw)) return null;
  return raw;
}

/**
 * Imagen principal de producto si el JSON no trae `cover` (misma URL de ficha que metadatos).
 */
export async function fetchGpsProductCoverUrlFromProductPage(productUrl: string): Promise<string | null> {
  const html = await fetchGameplayStoresProductPageHtml(productUrl);
  if (!html) return null;
  return parseOgImageUrlFromGpsProductHtml(html);
}

export async function fetchGameplayStoresProductPageHtml(productUrl: string): Promise<string | null> {
  let u: URL;
  try {
    u = new URL(productUrl);
  } catch {
    return null;
  }
  if (u.hostname !== 'www.gameplaystores.es' && u.hostname !== 'gameplaystores.es') {
    return null;
  }

  try {
    const res = await fetchWithTimeout(
      u.toString(),
      {
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': 'Mozilla/5.0 (compatible; PokedexGamer/1.0; +metadata)',
        },
      },
      14000
    );
    if (!res.ok) return null;
    const text = await res.text();
    return text.length > 200 ? text : null;
  } catch {
    return null;
  }
}
