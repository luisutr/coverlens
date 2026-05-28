import { describe, expect, it } from 'vitest';
import type { GameRecord } from '../database/dbConfig';
import { filterAndSortGames } from '../services/catalogDisplay';

function base(over: Partial<GameRecord> & Pick<GameRecord, 'id' | 'title' | 'platform'>): GameRecord {
  return {
    barcode: null,
    version: null,
    releaseYear: null,
    genre: null,
    developer: null,
    publisher: null,
    description: null,
    rating: null,
    franchise: null,
    textLanguages: null,
    voiceLanguages: null,
    coverUrl: null,
    headerImageUrl: null,
    coverLocalThumbUri: null,
    metadataStatus: 'resolved',
    metadataSource: null,
    lastError: null,
    favorite: 0,
    discOnly: 0,
    valueCents: null,
    valueCurrency: null,
    valueSource: null,
    valueUpdatedAt: null,
    createdAt: '2020-01-01',
    ...over,
  };
}

describe('filterAndSortGames', () => {
  const games: GameRecord[] = [
    base({ id: 1, title: 'Zelda', platform: 'Switch', metadataStatus: 'pending', favorite: 1, valueCents: 1000 }),
    base({ id: 2, title: 'Mario', platform: 'NES', metadataStatus: 'resolved', discOnly: 1, valueCents: 5000 }),
    base({ id: 3, title: 'Metroid', platform: 'SNES', metadataStatus: 'error', releaseYear: 1994 }),
  ];

  it('filtra por texto en título', () => {
    const out = filterAndSortGames(
      games,
      { search: 'met', platform: null, onlyFavorite: false, onlyDiscOnly: false, onlySpanishText: false, onlySpanishVoice: false },
      'title_asc'
    );
    expect(out.map((x) => x.title)).toEqual(['Metroid']);
  });

  it('filtra por plataforma', () => {
    const out = filterAndSortGames(
      games,
      { search: '', platform: 'NES', onlyFavorite: false, onlyDiscOnly: false, onlySpanishText: false, onlySpanishVoice: false },
      'title_asc'
    );
    expect(out.map((x) => x.title)).toEqual(['Mario']);
  });

  it('filtra favoritos y ordena por valor', () => {
    const out = filterAndSortGames(
      games,
      { search: '', platform: null, onlyFavorite: true, onlyDiscOnly: false, onlySpanishText: false, onlySpanishVoice: false },
      'value_desc'
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.title).toBe('Zelda');
  });

  it('filtra solo disco', () => {
    const out = filterAndSortGames(
      games,
      { search: '', platform: null, onlyFavorite: false, onlyDiscOnly: true, onlySpanishText: false, onlySpanishVoice: false },
      'added_desc'
    );
    expect(out.map((x) => x.id)).toEqual([2]);
  });

  it('filtra por castellano en texto y doblaje', () => {
    const withLang = [
      ...games,
      base({
        id: 4,
        title: 'Español texto',
        platform: 'PS4',
        textLanguages: 'Castellano, Inglés',
        voiceLanguages: 'Inglés',
      }),
      base({
        id: 5,
        title: 'Doblado ES',
        platform: 'PS4',
        textLanguages: 'Inglés',
        voiceLanguages: 'Castellano',
      }),
    ];
    const textOnly = filterAndSortGames(
      withLang,
      { search: '', platform: null, onlyFavorite: false, onlyDiscOnly: false, onlySpanishText: true, onlySpanishVoice: false },
      'title_asc'
    );
    expect(textOnly.map((x) => x.id)).toEqual([4]);

    const voiceOnly = filterAndSortGames(
      withLang,
      { search: '', platform: null, onlyFavorite: false, onlyDiscOnly: false, onlySpanishText: false, onlySpanishVoice: true },
      'title_asc'
    );
    expect(voiceOnly.map((x) => x.id)).toEqual([5]);
  });
});
