import { describe, expect, it } from 'vitest';
import {
  deriveMetadataStatusFromGameFields,
  finalizeMetadataResult,
} from '../services/utils/metadataCompleteness';

const completeGame = {
  title: 'Zelda',
  platform: 'Switch',
  coverUrl: 'https://images.igdb.com/x.jpg',
  releaseYear: 2017,
  genre: 'Adventure',
  developer: 'Nintendo EPD',
  publisher: 'Nintendo',
  description: 'Una aventura épica en Hyrule con más de veinticinco caracteres.',
};

describe('deriveMetadataStatusFromGameFields', () => {
  it('resolved con portada y todos los campos de ficha', () => {
    expect(deriveMetadataStatusFromGameFields(completeGame)).toBe('resolved');
  });

  it('partial sin portada http aunque el resto esté completo', () => {
    expect(
      deriveMetadataStatusFromGameFields({
        ...completeGame,
        coverUrl: null,
      })
    ).toBe('partial');
  });

  it('partial con portada pero falta algún campo de ficha', () => {
    expect(
      deriveMetadataStatusFromGameFields({
        title: 'Zelda',
        platform: 'Switch',
        coverUrl: 'https://x/y.jpg',
        genre: 'Adventure',
      })
    ).toBe('partial');
  });

  it('partial si solo falta developer o publisher', () => {
    expect(
      deriveMetadataStatusFromGameFields({
        ...completeGame,
        developer: null,
      })
    ).toBe('partial');
    expect(
      deriveMetadataStatusFromGameFields({
        ...completeGame,
        publisher: ' ',
      })
    ).toBe('partial');
  });
});

describe('finalizeMetadataResult', () => {
  it('no toca errores del proveedor', () => {
    const r = finalizeMetadataResult({
      title: 'x',
      platform: 'y',
      status: 'error',
      source: 'igdb',
      error: 'fail',
    });
    expect(r.status).toBe('error');
  });

  it('reclasifica resolved del proveedor si faltan campos reales', () => {
    const r = finalizeMetadataResult({
      title: 'Stellar Blade',
      platform: 'PlayStation 5',
      coverUrl: 'https://image.test/cover.jpg',
      releaseYear: 2024,
      genre: 'Action',
      status: 'resolved',
      source: 'coverlens',
    });
    expect(r.status).toBe('partial');
  });
});
