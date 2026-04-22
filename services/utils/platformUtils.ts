/**
 * Nombres canónicos de plataformas.
 *
 * Todas las fuentes de datos (IGDB, GamePlayStores, entrada manual) deben
 * pasar sus nombres de plataforma por `canonicalizePlatform` para garantizar
 * consistencia en la base de datos.
 *
 * Orden importante: de más específico a menos específico para evitar falsos positivos.
 */

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Palabras sueltas de plataforma al final del texto del usuario (p. ej. "360" = Xbox 360).
 * Van después de alias multi-palabra en el emparejado por longitud.
 */
const STANDALONE_SUFFIX: Array<{ re: RegExp; canonical: string }> = [
  { re: /(?:^|[\s\-,])(360)$/i, canonical: 'Xbox 360' },
];

const PLATFORM_CANONICAL: Array<{ patterns: string[]; canonical: string }> = [
  // PlayStation (más específico primero)
  { patterns: ['playstation 5', 'ps5'], canonical: 'PlayStation 5' },
  { patterns: ['playstation 4', 'ps4'], canonical: 'PlayStation 4' },
  { patterns: ['playstation 3', 'ps3'], canonical: 'PlayStation 3' },
  { patterns: ['playstation 2', 'ps2'], canonical: 'PlayStation 2' },
  { patterns: ['playstation portable', 'psp'], canonical: 'PSP' },
  { patterns: ['playstation vita', 'ps vita', 'vita'], canonical: 'PS Vita' },
  { patterns: ['playstation', 'psx', 'ps one', 'ps1'], canonical: 'PlayStation' },
  // Nintendo Switch (2 antes que 1); nombres cortos en BD como en GPS (- SWI, - NES…)
  { patterns: ['nintendo switch 2', 'switch 2'], canonical: 'Switch 2' },
  { patterns: ['nintendo switch', 'switch'], canonical: 'Switch' },
  // Wii U antes que Wii
  { patterns: ['wii u', 'wiiu', 'nintendo wiiu', 'nintendo wii u'], canonical: 'Wii U' },
  { patterns: ['wii', 'nintendo wii'], canonical: 'Wii' },
  // 3DS / DS (3DS primero)
  { patterns: ['nintendo 3ds', '3ds', 'new 3ds', '2ds', 'new nintendo 3ds'], canonical: 'Nintendo 3DS' },
  { patterns: ['nintendo ds', 'nds'], canonical: 'Nintendo DS' },
  // Game Boy (Advance > Color > plain)
  { patterns: ['game boy advance', 'gameboy advance', 'gba'], canonical: 'Game Boy Advance' },
  { patterns: ['game boy color', 'gameboy color', 'gbc'], canonical: 'Game Boy Color' },
  { patterns: ['game boy', 'gameboy'], canonical: 'Game Boy' },
  // GameCube
  { patterns: ['nintendo gamecube', 'gamecube', 'game cube', 'ngc'], canonical: 'GameCube' },
  // Otras Nintendo
  { patterns: ['nintendo 64', 'n64'], canonical: 'Nintendo 64' },
  /** "nintendo nes" antes que el token suelto nes (evita confusión con otras consolas Nintendo) */
  { patterns: ['nintendo nes'], canonical: 'NES' },
  { patterns: ['super nintendo entertainment system', 'super nintendo', 'super nes', 'snes'], canonical: 'SNES' },
  { patterns: ['nintendo entertainment system', 'famicom'], canonical: 'NES' },
  { patterns: ['nes'], canonical: 'NES' },
  // Xbox (Series X antes que One, One antes que 360, 360 antes que plain)
  { patterns: ['xbox series x|s', 'xbox series x', 'xbox series s', 'xbox series'], canonical: 'Xbox Series X' },
  { patterns: ['xbox one'], canonical: 'Xbox One' },
  { patterns: ['xbox 360', 'x360'], canonical: 'Xbox 360' },
  { patterns: ['xbox'], canonical: 'Xbox' },
  // Sega
  { patterns: ['sega dreamcast', 'dreamcast'], canonical: 'Dreamcast' },
  { patterns: ['sega saturn', 'saturn'], canonical: 'Saturn' },
  { patterns: ['sega mega drive', 'sega genesis', 'mega drive', 'megadrive', 'genesis'], canonical: 'Mega Drive' },
  { patterns: ['sega game gear', 'game gear'], canonical: 'Game Gear' },
  { patterns: ['sega master system', 'master system'], canonical: 'Master System' },
  // PC (Playnite suele usar «PC (Windows)»); «pc» suelto al final en búsqueda manual
  { patterns: ['pc (windows)', 'pc (microsoft windows)', 'microsoft windows'], canonical: 'PC' },
  { patterns: ['windows'], canonical: 'PC' },
  { patterns: ['pc'], canonical: 'PC' },
];

const FLAT_PATTERNS = PLATFORM_CANONICAL.flatMap(({ patterns, canonical }) =>
  patterns.map((pattern) => ({ pattern, canonical }))
).sort((a, b) => b.pattern.length - a.pattern.length);

const SEP_BEFORE_PLATFORM = /[\s\-,\u2013\u2014]/;

function patternMatchesPlatform(lower: string, pattern: string): boolean {
  const p = pattern.toLowerCase();
  if (lower === p) return true;
  if (p.includes(' ')) {
    return lower.includes(p);
  }
  const escaped = escapeRegex(p);
  const re = new RegExp(
    `(^|[\\s\\-\\u2013\\u2014,])${escaped}($|[\\s\\-\\u2013\\u2014,])|^${escaped}$`,
    'i'
  );
  return re.test(lower);
}

/**
 * Normaliza texto de búsqueda manual (espacios, guiones, comas típicas «título, PS4»).
 */
export function normalizeManualGameSearch(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ' ')
    /** Solo guiones usados como separadores «título – plataforma», no guiones del nombre (F-Zero, Half-Life). */
    .replace(/\s+[\-–—]\s+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Quita ruido de anuncios de venta (caja, CIB, región…) del título. */
export function cleanTitleRetailNoise(title: string): string {
  return title
    .replace(
      /\b(caja|car[aá]tucho|cartridge|complete\s+in\s+box|cib|nuevo|usado|pal|ntsc|region\s*free)\b/gi,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Índice en `lower` donde empieza el sufijo de plataforma, o null si no coincide al final.
 */
function matchPlatformSuffix(lower: string, pattern: string): number | null {
  const p = pattern.toLowerCase();
  if (p.includes('|')) return null;
  if (p.includes(' ')) {
    if (!lower.endsWith(p)) return null;
    const platStart = lower.length - p.length;
    if (platStart > 0 && !SEP_BEFORE_PLATFORM.test(lower[platStart - 1]!)) return null;
    return platStart;
  }
  const escaped = escapeRegex(p);
  const re = new RegExp(`(^|[\\s\\-\\u2013\\u2014,])${escaped}$`, 'i');
  const m = lower.match(re);
  if (!m || m.index === undefined) return null;
  return m.index;
}

/**
 * Convierte cualquier nombre de plataforma a su nombre canónico.
 * "Nintendo GameCube" → "GameCube"
 * "PlayStation 4" → "PlayStation 4"  (ya canónico)
 * "GC" no llega aquí (se resuelve en PLATFORM_SUFFIX_MAP de barcodeToTitle)
 */
export function canonicalizePlatform(name: string): string {
  if (!name) return name;
  const lower = name.toLowerCase().trim();
  for (const { patterns, canonical } of PLATFORM_CANONICAL) {
    if (patterns.some((p) => patternMatchesPlatform(lower, p))) {
      return canonical;
    }
  }
  return name;
}

/**
 * Intenta separar "título + plataforma" al final del texto (ej. "Gears of War Xbox 360").
 * Prueba alias largos primero; tokens cortos (NES, 360…) usan límites de palabra para evitar falsos positivos.
 */
export function splitTitleAndPlatform(raw: string): { titleHint: string; platformHint: string | null } {
  const normalized = normalizeManualGameSearch(raw);
  if (!normalized) return { titleHint: '', platformHint: null };

  const lower = normalized.toLowerCase();

  for (const { pattern, canonical } of FLAT_PATTERNS) {
    const startIdx = matchPlatformSuffix(lower, pattern);
    if (startIdx === null || startIdx <= 0) continue;
    const titlePart = cleanTitleRetailNoise(normalized.slice(0, startIdx).trim());
    if (titlePart.length > 0) {
      return { titleHint: titlePart, platformHint: canonical };
    }
  }

  for (const { re, canonical } of STANDALONE_SUFFIX) {
    const m = lower.match(re);
    if (!m || m.index === undefined) continue;
    const titlePart = cleanTitleRetailNoise(normalized.slice(0, m.index).trim());
    if (titlePart.length > 0) {
      return { titleHint: titlePart, platformHint: canonical };
    }
  }

  return { titleHint: cleanTitleRetailNoise(normalized), platformHint: null };
}
