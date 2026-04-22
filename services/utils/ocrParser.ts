/**
 * Heurísticas sobre texto crudo de OCR (lomo / carátula) para rellenar título y plataforma.
 * El usuario puede corregir en el modal antes de buscar metadatos.
 */

export type OcrGameParseResult = {
  title: string;
  platform: string | null;
  rawText: string;
};

const PLATFORM_RULES: Array<{ test: (s: string) => boolean; label: string }> = [
  { test: (s) => /\bps\s*5\b|playstation\s*5|ps5\b/i.test(s), label: 'PlayStation 5' },
  { test: (s) => /\bps\s*4\b|playstation\s*4|ps4\b/i.test(s), label: 'PlayStation 4' },
  { test: (s) => /\bps\s*3\b|playstation\s*3|ps3\b/i.test(s), label: 'PlayStation 3' },
  { test: (s) => /\bps\s*vita\b|playstation\s*vita/i.test(s), label: 'PlayStation Vita' },
  { test: (s) => /\bxbox\s*series|series\s*x\b|series\s*s\b/i.test(s), label: 'Xbox Series X|S' },
  { test: (s) => /\bxbox\s*one\b|xbone\b/i.test(s), label: 'Xbox One' },
  { test: (s) => /\bxbox\s*360\b/i.test(s), label: 'Xbox 360' },
  { test: (s) => /\bnintendo\s*switch\b|\bswitch\b/i.test(s), label: 'Switch' },
  { test: (s) => /\bwii\s*u\b/i.test(s), label: 'Wii U' },
  { test: (s) => /\bwii\b/i.test(s), label: 'Wii' },
  { test: (s) => /\b3ds\b|\bnintendo\s*3ds\b/i.test(s), label: 'Nintendo 3DS' },
  { test: (s) => /\bds\b|\bnintendo\s*ds\b/i.test(s), label: 'Nintendo DS' },
  { test: (s) => /\bgame\s*cube\b|\bgcn\b/i.test(s), label: 'GameCube' },
  { test: (s) => /\bn64\b|\bnintendo\s*64\b/i.test(s), label: 'Nintendo 64' },
  { test: (s) => /\bpc\b|\bsteam\b|\bgog\b/i.test(s), label: 'PC' },
];

const NOISE_LINE =
  /^(PEGI|ESRB|USK|CERO|TM|R\s*\)|©|\(C\)|MADE\s+IN|WWW\.|HTTP)/i;

function scoreTitleLine(line: string): number {
  const t = line.trim();
  if (t.length < 2) return -1;
  if (NOISE_LINE.test(t)) return 0;
  const letters = (t.match(/[a-záéíóúñü]/gi) ?? []).length;
  if (letters < 2) return 1;
  return letters + Math.min(t.length, 80) * 0.02;
}

function pickTitle(lines: string[]): string {
  if (lines.length === 0) return '';
  let best = lines[0];
  let bestScore = scoreTitleLine(best);
  for (const line of lines) {
    const s = scoreTitleLine(line);
    if (s > bestScore) {
      best = line;
      bestScore = s;
    }
  }
  return best.trim();
}

export function extractGameInfoFromOcr(text: string): OcrGameParseResult {
  const rawText = text.replace(/\u00a0/g, ' ').trim();
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let platform: string | null = null;
  for (const { test, label } of PLATFORM_RULES) {
    if (test(rawText)) {
      platform = label;
      break;
    }
  }

  const title = pickTitle(lines);

  return {
    title,
    platform,
    rawText,
  };
}
