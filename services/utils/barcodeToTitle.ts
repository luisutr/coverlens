/**
 * Convierte un barcode EAN/UPC en título de juego y plataforma.
 *
 * Fuente principal: gameplaystores.es (PrestaShop JSON, sin autenticación)
 * Formato de respuesta: { products: [{ name: "Stellar Blade - PS5", ... }] }
 *
 * Fallback: GameUPC (campo searched_for)
 */

import { fetchWithTimeout } from './networkUtils';
import { canonicalizePlatform } from './platformUtils';

const GAMEPLAYSTORES_URL = 'https://www.gameplaystores.es/busqueda';
const GAMEUPC_URL = 'https://api.gameupc.com/test/upc';
const GAMEUPC_KEY = 'test_test_test_test_test';

export type BarcodeResult = {
  title: string;
  platformHint: string | null;
  editionHint: string | null;
};

/**
 * Mapeo de sufijos GPS → nombre canónico de plataforma.
 * GPS usa abreviaturas como "PS5", "GC", "SWI" al final del nombre del producto.
 * Los nombres canónicos deben coincidir con los que devuelve canonicalizePlatform.
 */
const PLATFORM_SUFFIX_MAP: Array<{ suffixes: string[]; platform: string }> = [
  { suffixes: ['PS5', 'PS 5', 'PLAYSTATION 5'], platform: 'PlayStation 5' },
  { suffixes: ['PS4', 'PS 4', 'PLAYSTATION 4'], platform: 'PlayStation 4' },
  { suffixes: ['PS3', 'PS 3', 'PLAYSTATION 3'], platform: 'PlayStation 3' },
  { suffixes: ['PS2', 'PS 2', 'PLAYSTATION 2'], platform: 'PlayStation 2' },
  { suffixes: ['PSX', 'PS1', 'PLAYSTATION ONE'], platform: 'PlayStation' },
  { suffixes: ['PSP'], platform: 'PSP' },
  { suffixes: ['PSVITA', 'PS VITA', 'VITA'], platform: 'PS Vita' },
  { suffixes: ['XBSX', 'XSX', 'XBOX SERIES X', 'XBOX SERIES'], platform: 'Xbox Series X' },
  { suffixes: ['XBONE', 'XBOX ONE'], platform: 'Xbox One' },
  { suffixes: ['X360', 'XBOX 360'], platform: 'Xbox 360' },
  { suffixes: ['XBOX'], platform: 'Xbox' },
  { suffixes: ['SWI2', 'SWITCH 2', 'NINTENDO SWITCH 2'], platform: 'Switch 2' },
  { suffixes: ['SWI', 'SWITCH', 'NINTENDO SWITCH'], platform: 'Switch' },
  { suffixes: ['WIIU', 'WII U', 'NINTENDO WIIU'], platform: 'Wii U' },
  { suffixes: ['WII', 'NINTENDO WII'], platform: 'Wii' },
  { suffixes: ['3DS', 'NINTENDO 3DS', '2DS'], platform: 'Nintendo 3DS' },
  { suffixes: ['NDS', 'DS', 'NINTENDO DS'], platform: 'Nintendo DS' },
  { suffixes: ['GBA', 'GAME BOY ADVANCE'], platform: 'Game Boy Advance' },
  { suffixes: ['GBC', 'GAME BOY COLOR'], platform: 'Game Boy Color' },
  { suffixes: ['GB', 'GAME BOY', 'GAMEBOY'], platform: 'Game Boy' },
  { suffixes: ['GC', 'NGC', 'GAMECUBE', 'GAME CUBE'], platform: 'GameCube' },
  { suffixes: ['N64', 'NINTENDO 64'], platform: 'Nintendo 64' },
  { suffixes: ['SNES', 'SUPER NES', 'SUPER NINTENDO'], platform: 'SNES' },
  { suffixes: ['NES'], platform: 'NES' },
  { suffixes: ['DC', 'DREAMCAST'], platform: 'Dreamcast' },
  { suffixes: ['SAT', 'SATURN', 'SEGA SATURN'], platform: 'Saturn' },
  { suffixes: ['MD', 'MEGA DRIVE', 'GENESIS', 'MEGADRIVE'], platform: 'Mega Drive' },
  { suffixes: ['GG', 'GAME GEAR'], platform: 'Game Gear' },
  { suffixes: ['SMS', 'MASTER SYSTEM'], platform: 'Master System' },
  { suffixes: ['PC'], platform: 'PC' },
];

/**
 * Etiquetas de edición especial.
 * Se procesan en orden: primero las versiones entre paréntesis (GPS usa ambos formatos),
 * luego las versiones como texto suelto. Más específico antes que más genérico.
 *
 * GPS usa dos formatos:
 *   - "The Last of Us Remastered Hits - PS4"         (texto suelto)
 *   - "Metroid Prime (Player Choice) - GC"           (entre paréntesis)
 *   - "Dragon Ball Z Budokai Tenkaichi Platinum (Manual Deteriorado) - PS2"  (edición + nota)
 */
const EDITION_LABELS: Array<{ pattern: RegExp; label: string | null }> = [
  // ── Ediciones entre paréntesis ────────────────────────────────────────────
  { pattern: /\s*\(Player['']?s?\s+Choice\)/gi, label: "Player's Choice" },
  { pattern: /\s*\(Greatest\s+Hits\)/gi, label: 'Greatest Hits' },
  { pattern: /\s*\(Platinum\)/gi, label: 'Platinum' },
  { pattern: /\s*\(Game\s+of\s+the\s+Year(?:\s+Edition)?\)/gi, label: 'Game of the Year' },
  { pattern: /\s*\(GOTY\)/gi, label: 'GOTY' },
  { pattern: /\s*\(Complete\s+Edition\)/gi, label: 'Complete Edition' },
  { pattern: /\s*\(Deluxe\s+Edition\)/gi, label: 'Deluxe Edition' },
  { pattern: /\s*\(Special\s+Edition\)/gi, label: 'Special Edition' },
  { pattern: /\s*\(Gold\s+Edition\)/gi, label: 'Gold Edition' },
  { pattern: /\s*\(Day\s+One\s+Edition\)/gi, label: 'Day One Edition' },
  { pattern: /\s*\(Standard\s+Edition\)/gi, label: 'Standard Edition' },
  { pattern: /\s*\(Digital\s+Edition\)/gi, label: 'Digital Edition' },
  // ── Notas de condición / formato GPS (se eliminan; no son el título IGDB) ─
  { pattern: /\s*\(Cartucho\)/gi, label: null },
  { pattern: /\s*\(Caja\s+Pequeña[^)]*\)/gi, label: null },
  { pattern: /\s*\(Caja\s+Deteriorada[^)]*\)/gi, label: null },
  { pattern: /\s*\(NTSC[^)]*\)/gi, label: null },
  { pattern: /\s*\(Manual\s+Deteriorado\)/gi, label: null },
  { pattern: /\s*\(Sin\s+Manual\)/gi, label: null },
  { pattern: /\s*\(Sin\s+Caja\)/gi, label: null },
  { pattern: /\s*\(Sin\s+Insert\)/gi, label: null },
  { pattern: /\s*\(Caja\s+Dañada\)/gi, label: null },
  { pattern: /\s*\(Seminuevo\)/gi, label: null },
  { pattern: /\s*\(Import\.?\)/gi, label: null },
  // ── Ediciones como texto suelto (más específico primero) ──────────────────
  { pattern: /\s+Greatest\s+Hits\b/gi, label: 'Greatest Hits' },
  { pattern: /\s+Player['']?s?\s+Choice\b/gi, label: "Player's Choice" },
  { pattern: /\s+Game\s+of\s+the\s+Year\b/gi, label: 'Game of the Year' },
  { pattern: /\s+Day\s+One\s+Edition\b/gi, label: 'Day One Edition' },
  { pattern: /\s+Day\s+1\s+Edition\b/gi, label: 'Day One Edition' },
  { pattern: /\s+Deluxe\s+Edition\b/gi, label: 'Deluxe Edition' },
  { pattern: /\s+Gold\s+Edition\b/gi, label: 'Gold Edition' },
  { pattern: /\s+Complete\s+Edition\b/gi, label: 'Complete Edition' },
  { pattern: /\s+Standard\s+Edition\b/gi, label: 'Standard Edition' },
  { pattern: /\s+Digital\s+Edition\b/gi, label: 'Digital Edition' },
  { pattern: /\s+Launch\s+Edition\b/gi, label: 'Launch Edition' },
  { pattern: /\s+Special\s+Edition\b/gi, label: 'Special Edition' },
  { pattern: /\s+GOTY\b/gi, label: 'GOTY' },
  { pattern: /\s+Platinum\b/gi, label: 'Platinum' },
  { pattern: /\s+Hits\b/gi, label: 'PlayStation Hits' },
  { pattern: /\s+Seminuevo\b/gi, label: null },
];

function cleanEditionNoise(title: string): { clean: string; edition: string | null } {
  let clean = title;
  let edition: string | null = null;
  for (const entry of EDITION_LABELS) {
    // Resetear lastIndex antes de test() ya que son RegExp con flag /g
    entry.pattern.lastIndex = 0;
    if (entry.pattern.test(clean)) {
      entry.pattern.lastIndex = 0;
      if (entry.label) edition = entry.label;
      clean = clean.replace(entry.pattern, '');
    }
  }
  return { clean: clean.trim(), edition };
}

export function parseGamePlayStoresName(raw: string): { title: string; platformHint: string | null; editionHint: string | null } {
  // GPS usa " - " como separador. El último segmento suele ser la plataforma.
  // Ejemplos:
  //   "Stellar Blade - PS5"                          → title: "Stellar Blade", platform: "PlayStation 5"
  //   "The Last of Us Remastered Hits - PS4"         → title: "The Last of Us Remastered", version: "PlayStation Hits", platform: "PlayStation 4"
  //   "Metroid Prime (Player Choice) - GC"           → title: "Metroid Prime", version: "Player's Choice", platform: "GameCube"
  //   "Pikmin - GC"                                  → title: "Pikmin", platform: "GameCube"

  const parts = raw.split(' - ');
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1].trim().toUpperCase();
    for (const entry of PLATFORM_SUFFIX_MAP) {
      if (entry.suffixes.some((s) => lastPart === s || lastPart.startsWith(s + ' '))) {
        const rawTitle = parts.slice(0, parts.length - 1).join(' - ').trim();
        const { clean: title, edition } = cleanEditionNoise(rawTitle);
        return { title, platformHint: entry.platform, editionHint: edition };
      }
    }
  }
  // Sin plataforma reconocida: limpiar ediciones del nombre completo
  const { clean, edition } = cleanEditionNoise(raw.trim());
  return { title: clean, platformHint: null, editionHint: edition };
}

// ─── Validación EAN-13 y corrección de barcodes ─────────────────────────────

function ean13CheckDigit(barcode: string): number {
  const digits = barcode.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += digits[i] * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

function isValidEan13(barcode: string): boolean {
  if (barcode.length !== 13 || !/^\d+$/.test(barcode)) return false;
  return ean13CheckDigit(barcode) === parseInt(barcode[12]);
}

/**
 * Genera variantes válidas del barcode para cubrir errores de lectura de cámara:
 * - Si 12 dígitos (UPC-A), añade '0' al inicio → EAN-13
 * - Si el EAN-13 (original o paddeado) tiene checksum inválido,
 *   prueba cambiar cada dígito (pos 0-11) del 0 al 9 hasta encontrar checksums válidos
 */
export function getBarcodeVariants(barcode: string): string[] {
  const variants: string[] = [barcode];
  const ean13Candidates: string[] = [];

  if (barcode.length === 12) {
    const ean = '0' + barcode;
    if (!variants.includes(ean)) variants.push(ean);
    ean13Candidates.push(ean);
  } else if (barcode.length === 13) {
    ean13Candidates.push(barcode);
  }

  for (const ean of ean13Candidates) {
    if (!isValidEan13(ean)) {
      console.log('[GPS] Checksum inválido para:', ean, '→ generando correcciones...');
      const digits = ean.split('');
      for (let pos = 0; pos < 12; pos++) {
        for (let d = 0; d <= 9; d++) {
          const candidate = [...digits];
          candidate[pos] = String(d);
          const candidateStr = candidate.join('');
          if (isValidEan13(candidateStr) && !variants.includes(candidateStr)) {
            variants.push(candidateStr);
          }
        }
      }
    }
  }

  return variants;
}

// ─── Providers ───────────────────────────────────────────────────────────────

async function fromGamePlayStores(barcode: string): Promise<BarcodeResult | null> {
  const variants = getBarcodeVariants(barcode);
  console.log('[GPS] Variantes a probar para', barcode, ':', variants.length);

  for (const code of variants) {
    try {
      const res = await fetchWithTimeout(`${GAMEPLAYSTORES_URL}?s=${encodeURIComponent(code)}`, {
        headers: { Accept: 'application/json' },
      }, 10000);
      console.log('[GPS] HTTP', res.status, 'para', code);
      if (!res.ok) continue;
      const text = await res.text();
      if (!text.trim().startsWith('{')) {
        console.log('[GPS] Respuesta no-JSON para', code);
        continue;
      }
      const data = JSON.parse(text) as { products?: Array<{ name?: string }> };
      const first = data.products?.[0]?.name;
      if (first) {
        if (code !== barcode) {
          console.log('[GPS] Barcode corregido:', barcode, '→', code);
        }
        console.log('[GPS]', code, '→', first);
        return parseGamePlayStoresName(first);
      } else {
        console.log('[GPS] Sin productos para', code);
      }
    } catch (e) {
      console.log('[GPS] Error para', code, ':', e);
    }
  }
  console.log('[GPS] No encontrado:', barcode, '(probadas', variants.length, 'variantes)');
  return null;
}

async function fromGameUpc(barcode: string): Promise<BarcodeResult | null> {
  try {
    const res = await fetchWithTimeout(`${GAMEUPC_URL}/${encodeURIComponent(barcode)}?search_mode=quality`, {
      headers: { 'x-api-key': GAMEUPC_KEY },
    }, 10000);
    if (!res.ok) return null;
    const data = (await res.json()) as { searched_for?: string; name?: string };
    const raw = data.searched_for ?? data.name ?? '';
    if (!raw) return null;
    const lower = raw.toLowerCase();
    for (const entry of PLATFORM_SUFFIX_MAP) {
      if (entry.suffixes.some((s) => lower.includes(s.toLowerCase()))) {
        const cleanTitle = raw.replace(new RegExp(entry.suffixes.join('|'), 'gi'), '').replace(/\s*[-–]\s*$/, '').trim();
        return { title: cleanTitle || raw, platformHint: canonicalizePlatform(entry.platform), editionHint: null };
      }
    }
    return { title: raw, platformHint: null, editionHint: null };
  } catch {
    return null;
  }
}

/** Primer producto del JSON GPS para un EAN/UPC (portada en JSON si existe). */
export async function fetchFirstGpsProductForBarcode(barcode: string): Promise<{
  name: string;
  price?: string;
  url?: string;
  link?: string;
  canonical_url?: string;
  id_product?: string | number;
  cover?: { large?: { url?: string }; medium?: { url?: string }; small?: { url?: string }; bySize?: Record<string, { url?: string } | undefined> };
} | null> {
  const clean = barcode.replace(/\s/g, '');
  const variants = getBarcodeVariants(clean);

  for (const code of variants) {
    try {
      const res = await fetchWithTimeout(`${GAMEPLAYSTORES_URL}?s=${encodeURIComponent(code)}`, {
        headers: { Accept: 'application/json' },
      }, 10000);
      if (!res.ok) continue;
      const text = await res.text();
      if (!text.trim().startsWith('{')) continue;
      const data = JSON.parse(text) as {
        products?: Array<{
          name?: string;
          price?: string;
          url?: string;
          link?: string;
          canonical_url?: string;
          id_product?: string | number;
          cover?: {
            large?: { url?: string };
            medium?: { url?: string };
            small?: { url?: string };
            bySize?: Record<string, { url?: string } | undefined>;
          };
        }>;
      };
      const first = data.products?.[0];
      if (first?.name) {
        return {
          name: first.name,
          cover: first.cover,
          price: first.price,
          url: first.url,
          link: first.link,
          canonical_url: first.canonical_url,
          id_product: first.id_product,
        };
      }
    } catch {
      continue;
    }
  }
  return null;
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function barcodeToTitle(barcode: string): Promise<BarcodeResult | null> {
  const clean = barcode.replace(/\s/g, '');
  console.log('[barcodeToTitle] Buscando barcode:', clean);

  const fromGPS = await fromGamePlayStores(clean);
  if (fromGPS) return fromGPS;

  const fromGUpc = await fromGameUpc(clean);
  if (fromGUpc) return fromGUpc;

  return null;
}
