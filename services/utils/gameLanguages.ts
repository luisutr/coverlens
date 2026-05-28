/**
 * Idiomas de texto (menús/subtítulos) y voces (doblaje) en ficha de juego.
 * En BD se guardan como lista legible separada por comas: «Castellano, Inglés».
 */

const SPANISH_ALIASES = new Set([
  'es',
  'spa',
  'spanish',
  'español',
  'espanol',
  'castellano',
  'esp',
  'es-es',
  'es_es',
  'es-mx',
]);

const CODE_TO_LABEL: Record<string, string> = {
  es: 'Castellano',
  en: 'Inglés',
  fr: 'Francés',
  de: 'Alemán',
  it: 'Italiano',
  pt: 'Portugués',
  ja: 'Japonés',
  ko: 'Coreano',
  zh: 'Chino',
  ru: 'Ruso',
  nl: 'Neerlandés',
  pl: 'Polaco',
  sv: 'Sueco',
  no: 'Noruego',
  da: 'Danés',
  fi: 'Finlandés',
  cs: 'Checo',
  hu: 'Húngaro',
  tr: 'Turco',
  ar: 'Árabe',
};

function tokenize(raw: string): string[] {
  return raw
    .split(/[,;/|]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function labelForToken(token: string): string {
  const t = token.trim();
  if (!t) return '';
  const lower = t.toLowerCase();
  if (lower === 'es' || lower === 'spa' || lower.startsWith('es-') || lower.startsWith('es_')) {
    return 'Castellano';
  }
  if (CODE_TO_LABEL[lower]) return CODE_TO_LABEL[lower]!;
  if (/^[a-z]{2}(-[a-z]{2})?$/i.test(t)) {
    const base = lower.slice(0, 2);
    return CODE_TO_LABEL[base] ?? t;
  }
  if (lower.includes('castellano') || lower.includes('español') || lower.includes('espanol')) {
    return 'Castellano';
  }
  if (lower.includes('ingl') || lower === 'en') return 'Inglés';
  if (lower.includes('franc')) return 'Francés';
  if (lower.includes('alem') || lower.includes('german')) return 'Alemán';
  if (lower.includes('ital')) return 'Italiano';
  if (lower.includes('portug')) return 'Portugués';
  if (lower.includes('japon') || lower.includes('japan')) return 'Japonés';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Normaliza arrays, strings o objetos del JSON del VPS a texto para SQLite. */
export function normalizeLanguagesFromVps(raw: unknown): string | null {
  if (raw == null) return null;

  let items: string[] = [];
  if (Array.isArray(raw)) {
    items = raw.flatMap((x) => (typeof x === 'string' ? tokenize(x) : []));
  } else if (typeof raw === 'string') {
    items = tokenize(raw);
  } else if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const nested = o.text ?? o.voice ?? o.audio ?? o.interface;
    if (nested != null) return normalizeLanguagesFromVps(nested);
  }

  const labels: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const label = labelForToken(item);
    const key = label.toLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
  }
  return labels.length > 0 ? labels.join(', ') : null;
}

export function parseLanguageList(stored: string | null | undefined): string[] {
  const s = stored?.trim() ?? '';
  if (!s) return [];
  return tokenize(s).map(labelForToken).filter(Boolean);
}

export function includesSpanish(stored: string | null | undefined): boolean {
  const tokens = parseLanguageList(stored);
  return tokens.some((label) => {
    const lower = label.toLowerCase();
    if (SPANISH_ALIASES.has(lower)) return true;
    return lower.includes('castellano') || lower.includes('español') || lower.includes('espanol');
  });
}

export function gameHasSpanishText(game: { textLanguages?: string | null }): boolean {
  return includesSpanish(game.textLanguages);
}

export function gameHasSpanishVoice(game: { voiceLanguages?: string | null }): boolean {
  return includesSpanish(game.voiceLanguages);
}

/** Extrae idiomas del registro CoverLens Resource (varios nombres de campo posibles). */
export function languagesFromCoverLensRecord(record: Record<string, unknown>): {
  textLanguages: string | null;
  voiceLanguages: string | null;
} {
  const nested = record.languages;
  const nestedObj =
    nested && typeof nested === 'object' && !Array.isArray(nested)
      ? (nested as Record<string, unknown>)
      : null;

  const textRaw =
    record.textLanguages ??
    record.text_languages ??
    record.idiomasTexto ??
    record.interfaceLanguages ??
    nestedObj?.text ??
    nestedObj?.interface;

  const voiceRaw =
    record.voiceLanguages ??
    record.voice_languages ??
    record.idiomasVoz ??
    record.audioLanguages ??
    nestedObj?.voice ??
    nestedObj?.audio;

  return {
    textLanguages: normalizeLanguagesFromVps(textRaw),
    voiceLanguages: normalizeLanguagesFromVps(voiceRaw),
  };
}
