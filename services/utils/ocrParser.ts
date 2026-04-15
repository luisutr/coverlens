/**
 * Heurísticas sobre texto crudo de OCR (lomo / carátula) para rellenar título y plataforma.
 * El usuario puede corregir en el modal antes de buscar metadatos.
 */

export type OcrGameParseResult = {
  title: string;
  platform: string | null;
  rawText: string;
};

export type OcrBatchCandidate = {
  title: string;
  platform: string | null;
  confidence: number;
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
  /^(PEGI|ESRB|USK|CERO|TM|R\s*\)|©|\(C\)|MADE\s+IN|WWW\.|HTTP|PAL\b|COPYRIGHT\b|STUDIO\b|INCLUDED\b|@RUN)/i;

/** Ruido típico en fotos de estantería / marketing (lote). */
const BATCH_EXTRA_NOISE =
  /^(EXCLUSIVO|EXCLUSIVE|SOLO\s+EN|ONLY\s+ON|BONUS|INCLUYE|INCLUDES|REQUIERE|REQUIRES|INTERNET|DAY\s*ONE|DEFINITIVE|GOTY|GAME\s+OF\s+THE\s+YEAR|PLAY\s+HAS\s+NO\s+LIMITS|DISPONIBLE|AVAILABLE)/i;

const PLATFORM_ONLY_LINE =
  /^(PS\s*[345V]?|PLAYSTATION\s*[345V]?|XBOX(\s*(360|ONE|SERIES(\s*X\|S)?))?|NINTENDO(\s*SWITCH)?|SWITCH|PC)\s*[\.\-:|0-9XSO]*$/i;

const INLINE_NOISE =
  /(copyright|studio|www\.|pegi|run.?gun|mdhr|limited edition|the delicious|last course|included)/i;

function scoreTitleLine(line: string): number {
  const t = line.trim();
  if (t.length < 2) return -1;
  if (NOISE_LINE.test(t) || INLINE_NOISE.test(t)) return 0;
  if (PLATFORM_ONLY_LINE.test(t)) return 0;
  const letters = (t.match(/[a-záéíóúñü]/gi) ?? []).length;
  if (letters < 2) return 1;
  const lengthPenalty = t.length > 24 ? (t.length - 24) * 0.45 : 0;
  return letters + Math.min(t.length, 80) * 0.02 - lengthPenalty;
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

function detectPlatform(value: string): string | null {
  for (const { test, label } of PLATFORM_RULES) {
    if (test(value)) return label;
  }
  return null;
}

export function extractGameInfoFromOcr(text: string): OcrGameParseResult {
  const rawText = text.replace(/\u00a0/g, ' ').trim();
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const platform = detectPlatform(rawText);

  const title = pickTitle(lines);

  return {
    title,
    platform,
    rawText,
  };
}

function cleanupCandidateLine(line: string): string {
  return line
    .replace(/^\s*[-•*]+\s*/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Quita tokens de plataforma del texto para obtener solo título (misma lista que reglas de detección). */
function stripPlatformTokens(line: string): string {
  return line
    .replace(/\b(playstation\s*5|ps\s*5|ps5)\b/gi, '')
    .replace(/\b(playstation\s*4|ps\s*4|ps4)\b/gi, '')
    .replace(/\b(playstation\s*3|ps\s*3|ps3)\b/gi, '')
    .replace(/\b(playstation\s*vita|ps\s*vita)\b/gi, '')
    .replace(/\b(xbox\s*series\s*x\s*\|\s*s|xbox\s*series|series\s*x|series\s*s)\b/gi, '')
    .replace(/\b(xbox\s*one|xbone)\b/gi, '')
    .replace(/\b(xbox\s*360)\b/gi, '')
    .replace(/\b(nintendo\s*switch|switch)\b/gi, '')
    .replace(/\b(wii\s*u|wii)\b/gi, '')
    .replace(/\b(nintendo\s*3ds|3ds|nintendo\s*ds|ds)\b/gi, '')
    .replace(/\b(game\s*cube|gcn|nintendo\s*64|n64)\b/gi, '')
    .replace(/\b(pc|steam|gog)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[-|–—]+$/g, '')
    .trim();
}

function isPlatformOnlyLine(line: string): boolean {
  const t = line.trim();
  if (PLATFORM_ONLY_LINE.test(t)) return true;
  const pl = detectPlatform(t);
  if (!pl) return false;
  const stripped = stripPlatformTokens(t);
  return stripped.length < 2;
}

function isBatchNoiseLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 2) return true;
  if (NOISE_LINE.test(t) || BATCH_EXTRA_NOISE.test(t)) return true;
  if (/^[\d\s.\-|–—]+$/.test(t)) return true;
  return false;
}

/** Línea que puede ser continuación del título en el mismo lomo (subtítulo / número). */
function looksLikeTitleContinuation(prev: string, frag: string): boolean {
  const f = frag.trim();
  if (f.length < 1 || f.length > 40) return false;
  if (isBatchNoiseLine(f) || isPlatformOnlyLine(f)) return false;
  if (/^(PART|VOL|CAP[IÍ]TULO|EPISODIO|EP\.|CHAPTER)\b/i.test(f)) return true;
  if (/^(I{1,3}V?|V?I{0,3})$/i.test(f)) return true;
  if (/^\d{1,2}$/.test(f) && prev.replace(/\s/g, '').length >= 4) return true;
  const prevScore = scoreTitleLine(prev);
  const fragScore = scoreTitleLine(f);
  if (prev.length <= 22 && f.length <= 22 && prev.length + f.length <= 56) {
    if (prevScore > 0 && fragScore > 0 && fragScore < prevScore * 0.55) return true;
  }
  // Dos líneas de título fuerte seguidas (p. ej. «HORIZON» / «FORBIDDEN WEST») sin plataforma en la segunda.
  if (
    prev.length <= 20 &&
    f.length >= 6 &&
    f.length <= 38 &&
    !detectPlatform(f) &&
    prevScore >= 4 &&
    fragScore >= 4 &&
    prevScore + fragScore < 34 &&
    f.split(/\s+/).length >= 2
  ) {
    return true;
  }
  return false;
}

function countAlpha(s: string): number {
  return (s.match(/[a-záéíóúñü]/gi) ?? []).length;
}

function acceptBatchTitle(title: string, rawCombined: string): boolean {
  if (title.length < 4) return false;
  const alpha = countAlpha(title);
  if (alpha < 4) return false;
  if (scoreTitleLine(rawCombined) <= 0) return false;
  if (/(.)\1{5,}/i.test(title.replace(/\s/g, ''))) return false;
  return true;
}

function normalizeBatchDedupeKey(title: string, platform: string | null): string {
  const t = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9áéíóúñü]+/g, ' ')
    .trim();
  return `${t}|${(platform ?? '').toLowerCase()}`;
}

function scoreBatchCandidate(
  rawCombined: string,
  title: string,
  platform: string | null,
  mergedLineCount: number
): number {
  const lineScore = scoreTitleLine(rawCombined);
  let score = lineScore * 2.1;
  if (platform) score += 24;
  else score -= 6;
  if (mergedLineCount > 1) score += 6;
  if (detectPlatform(rawCombined) && stripPlatformTokens(rawCombined).length >= 6) score += 4;
  return Math.min(100, Math.max(8, Math.round(score)));
}

/**
 * Candidatos de lote: intenta asociar plataforma al mismo lomo que el título
 * (línea solo-plataforma antes o después, o en la misma línea), sin mezclar
 * una plataforma “dominante” de toda la foto entre títulos distintos.
 */
export function extractBatchCandidatesFromOcr(text: string, maxCandidates = 20): OcrBatchCandidate[] {
  const rawText = text.replace(/\u00a0/g, ' ').trim();
  const rawLines = rawText.split(/\r?\n/).map(cleanupCandidateLine);
  const lines = rawLines.filter((line) => line.length >= 2 && line.length <= 90);

  type Row = { text: string };
  const rows: Row[] = lines.map((text) => ({ text }));

  const out: OcrBatchCandidate[] = [];
  const seen = new Set<string>();

  /** Plataforma del bloque actual de estantería (misma fila / consola) hasta la siguiente línea solo-plataforma. */
  let stickyPlatform: string | null = null;
  let i = 0;

  while (i < rows.length) {
    const line = rows[i].text;

    if (isBatchNoiseLine(line)) {
      i += 1;
      continue;
    }

    if (isPlatformOnlyLine(line)) {
      const p = detectPlatform(line);
      if (p) stickyPlatform = p;
      i += 1;
      continue;
    }

    let j = i;
    let combined = line;
    while (j + 1 < rows.length) {
      const next = rows[j + 1].text;
      if (isBatchNoiseLine(next) || isPlatformOnlyLine(next)) break;
      if (!looksLikeTitleContinuation(combined, next)) break;
      combined = `${combined} ${next}`.replace(/\s{2,}/g, ' ').trim();
      j += 1;
    }

    const mergedCount = j - i + 1;
    i = j + 1;

    const inlinePlat = detectPlatform(combined);
    let title = stripPlatformTokens(combined);
    let platform: string | null = inlinePlat;

    if (!platform && i < rows.length && isPlatformOnlyLine(rows[i].text)) {
      platform = detectPlatform(rows[i].text);
      if (platform) {
        stickyPlatform = platform;
        i += 1;
      }
    }

    if (!platform) platform = stickyPlatform;

    if (!acceptBatchTitle(title, combined)) continue;

    if (platform) stickyPlatform = platform;

    const dedupeKey = normalizeBatchDedupeKey(title, platform);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const confidence = scoreBatchCandidate(combined, title, platform, mergedCount);
    out.push({ title, platform, confidence });
  }

  return out.sort((a, b) => b.confidence - a.confidence).slice(0, maxCandidates);
}
