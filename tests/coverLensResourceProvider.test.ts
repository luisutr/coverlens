import { describe, expect, it } from 'vitest';
import { mapCoverLensRecordToMetadata } from '../services/providers/coverLensResourceProvider';
import type { CoverLensGameRecord } from '../services/providers/coverLensResourceProvider';

describe('mapCoverLensRecordToMetadata', () => {
  it('mapea barcode, publisher y campos de texto del JSON del VPS', () => {
    const record: CoverLensGameRecord = {
      slug: 'batman-arkham-asylum-goty-edition',
      title: 'Batman Arkham Asylum GOTY Edition',
      platform: 'Xbox 360',
      platformSlug: 'x360',
      barcode: '5021290040632',
      publisher: 'Warner',
      developer: 'Rocksteady',
      genre: 'Acción/Aventura',
      releaseYear: 2010,
      description: 'Edición GOTY con mapas extra.',
      coverPath: '/covers/x360/batman-arkham-asylum-goty-edition.jpg',
    };

    const meta = mapCoverLensRecordToMetadata(record);

    expect(meta.source).toBe('coverlens');
    expect(meta.barcode).toBe('5021290040632');
    expect(meta.publisher).toBe('Warner');
    expect(meta.developer).toBe('Rocksteady');
    expect(meta.coverUrl).toBe(
      'https://covers.cholloweb.es/covers/x360/batman-arkham-asylum-goty-edition.jpg'
    );
  });

  it('usa releaseDate si releaseYear no viene en el registro', () => {
    const record: CoverLensGameRecord = {
      slug: 'demo',
      title: 'Demo Game',
      platform: 'Switch',
      platformSlug: 'switch',
      releaseDate: '2019-03-15',
    };

    expect(mapCoverLensRecordToMetadata(record).releaseYear).toBe(2019);
  });

  it('normaliza strings vacíos a null', () => {
    const record: CoverLensGameRecord = {
      slug: 'demo',
      title: 'Demo Game',
      platform: 'Switch',
      platformSlug: 'switch',
      barcode: '   ',
      publisher: '',
    };

    const meta = mapCoverLensRecordToMetadata(record);
    expect(meta.barcode).toBeNull();
    expect(meta.publisher).toBeNull();
  });

  it('mapea textLanguages y voiceLanguages del VPS', () => {
    const record: CoverLensGameRecord = {
      slug: 'demo',
      title: 'Demo Game',
      platform: 'Switch',
      platformSlug: 'switch',
      textLanguages: ['es', 'en'],
      voiceLanguages: ['en'],
    };

    const meta = mapCoverLensRecordToMetadata(record);
    expect(meta.textLanguages).toBe('Castellano, Inglés');
    expect(meta.voiceLanguages).toBe('Inglés');
  });
});
