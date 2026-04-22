/**
 * Extrae título y plataforma del texto reconocido por OCR en una portada/canto de juego.
 * No usa ninguna API externa — lógica pura en JS.
 */

// Plataformas conocidas ordenadas de más específico a más general para evitar falsos positivos
const PLATFORM_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /playstation\s*5|ps\s*5\b/i, name: 'PlayStation 5' },
  { pattern: /playstation\s*4|ps\s*4\b/i, name: 'PlayStation 4' },
  { pattern: /playstation\s*3|ps\s*3\b/i, name: 'PlayStation 3' },
  { pattern: /playstation\s*2|ps\s*2\b/i, name: 'PlayStation 2' },
  { pattern: /playstation\s*1|ps\s*1\b|psx\b/i, name: 'PlayStation' },
  { pattern: /ps\s*vita\b|vita\b/i, name: 'PS Vita' },
  { pattern: /xbox\s*series\s*x|xbox\s*series\s*s/i, name: 'Xbox Series X/S' },
  { pattern: /xbox\s*one\b/i, name: 'Xbox One' },
  { pattern: /xbox\s*360\b/i, name: 'Xbox 360' },
  { pattern: /xbox\b/i, name: 'Xbox' },
  { pattern: /nintendo\s*switch\b|switch\b/i, name: 'Switch' },
  { pattern: /wii\s*u\b/i, name: 'Wii U' },
  { pattern: /wii\b/i, name: 'Wii' },
  { pattern: /nintendo\s*3ds\b|3ds\b/i, name: 'Nintendo 3DS' },
  { pattern: /nintendo\s*ds\b|\bnds\b/i, name: 'Nintendo DS' },
  { pattern: /game\s*boy\s*advance\b|gba\b/i, name: 'Game Boy Advance' },
  { pattern: /game\s*boy\b/i, name: 'Game Boy' },
  { pattern: /gamecube\b|game\s*cube\b/i, name: 'GameCube' },
  { pattern: /nintendo\s*64\b|n64\b/i, name: 'Nintendo 64' },
  { pattern: /dreamcast\b/i, name: 'Dreamcast' },
  { pattern: /sega\s*saturn\b/i, name: 'Saturn' },
  { pattern: /mega\s*drive\b|genesis\b/i, name: 'Mega Drive' },
  { pattern: /\bpc\b|windows\b|steam\b/i, name: 'PC' },
];

// Palabras que NO son el título (publishers, ratings, etc.)
const NOISE_PATTERNS = [
  /^(sony|microsoft|nintendo|activision|ea|ubisoft|sega|namco|konami|capcom|square|enix|bandai|bethesda|rockstar|2k|thq|atari|eidos|warner|disney|lucas|take-two)$/i,
  /^(pegi|esrb|cero|usk|rated|rating|violence|language|online)$/i,
  /^\d+$/, // Solo números
  /^[^a-záéíóúüñàèìòù\s]/i, // Empieza con símbolo
  /^.{1,2}$/, // Muy corto (1-2 chars)
];

function isNoise(text: string): boolean {
  const t = text.trim();
  return NOISE_PATTERNS.some((p) => p.test(t));
}

export type OcrGameInfo = {
  title: string;
  platform: string | null;
  rawText: string;
  confidence: 'high' | 'medium' | 'low';
};

export function extractGameInfoFromOcr(fullText: string): OcrGameInfo {
  const lines = fullText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // 1. Detectar plataforma
  let platform: string | null = null;
  for (const { pattern, name } of PLATFORM_PATTERNS) {
    if (pattern.test(fullText)) {
      platform = name;
      break;
    }
  }

  // 2. Filtrar líneas de ruido
  const candidates = lines.filter((l) => !isNoise(l));

  // 3. Eliminar la línea que contiene la plataforma detectada
  const titleCandidates = platform
    ? candidates.filter((l) => !PLATFORM_PATTERNS.some(({ pattern }) => pattern.test(l)))
    : candidates;

  // 4. El título suele ser la línea más larga que queda (en spines es la primera o la más larga)
  titleCandidates.sort((a, b) => b.length - a.length);
  const title = titleCandidates[0] ?? candidates[0] ?? fullText.split('\n')[0] ?? '';

  // 5. Calcular confianza
  const confidence: OcrGameInfo['confidence'] =
    title.length > 3 && platform ? 'high' : title.length > 3 ? 'medium' : 'low';

  return { title: title.trim(), platform, rawText: fullText, confidence };
}
