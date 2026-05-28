import { describe, expect, it } from 'vitest';
import {
  gameHasSpanishText,
  gameHasSpanishVoice,
  languagesFromCoverLensRecord,
  normalizeLanguagesFromVps,
} from '../services/utils/gameLanguages';

describe('normalizeLanguagesFromVps', () => {
  it('normaliza códigos ISO y arrays', () => {
    expect(normalizeLanguagesFromVps(['es', 'en', 'fr'])).toBe('Castellano, Inglés, Francés');
    expect(normalizeLanguagesFromVps('es, en')).toBe('Castellano, Inglés');
  });

  it('detecta castellano en filtros', () => {
    expect(gameHasSpanishText({ textLanguages: 'Castellano, Inglés' })).toBe(true);
    expect(gameHasSpanishVoice({ voiceLanguages: 'Inglés, Francés' })).toBe(false);
    expect(gameHasSpanishVoice({ voiceLanguages: 'es, en' })).toBe(true);
  });

  it('lee campos alternativos del JSON CoverLens', () => {
    const r = languagesFromCoverLensRecord({
      textLanguages: ['es', 'en'],
      voiceLanguages: ['en'],
    });
    expect(r.textLanguages).toBe('Castellano, Inglés');
    expect(r.voiceLanguages).toBe('Inglés');
  });

  it('lee objeto languages anidado', () => {
    const r = languagesFromCoverLensRecord({
      languages: { text: ['es'], voice: ['es', 'en'] },
    });
    expect(r.textLanguages).toBe('Castellano');
    expect(r.voiceLanguages).toBe('Castellano, Inglés');
  });
});
