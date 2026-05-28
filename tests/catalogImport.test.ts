import { describe, expect, it } from 'vitest';
import { parseCatalogImport, parseCatalogImportJson } from '../services/import/catalogImport';

describe('parseCatalogImportJson', () => {
  it('detecta export CoverLens con items', () => {
    const json = JSON.stringify({
      app: 'CoverLens',
      formatVersion: 4,
      items: [
        {
          id: 99,
          title: 'Halo 3',
          platform: 'Xbox 360',
          barcode: null,
          coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1.jpg',
          metadataStatus: 'resolved',
          favorite: 1,
          discOnly: 0,
        },
      ],
    });
    const r = parseCatalogImportJson(json);
    expect(r.source).toBe('coverlens');
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]!.title).toBe('Halo 3');
    expect(r.rows[0]!.coverUrl).toContain('igdb.com');
    expect(r.rows[0]!.metadataSource).toBe('import:coverlens');
    // Sin género/año/etc. en el JSON: solo portada no basta para «resolved»
    expect(r.rows[0]!.metadataStatus).toBe('partial');
  });

  it('acepta array plano de items CoverLens', () => {
    const json = JSON.stringify([
      { title: 'Metroid', platform: 'SNES', coverUrl: null, metadataStatus: 'pending' },
    ]);
    const r = parseCatalogImportJson(json);
    expect(r.source).toBe('coverlens');
    expect(r.rows[0]!.title).toBe('Metroid');
  });

  it('parsea objetos estilo Playnite (Name, Platforms)', () => {
    const json = JSON.stringify({
      Games: [
        {
          Name: 'Final Fantasy VII',
          Hidden: false,
          Favorite: true,
          Platforms: [{ Name: 'PlayStation' }],
          ReleaseYear: 1997,
          Genres: [{ Name: 'RPG' }],
          Developers: [{ Name: 'Square' }],
          Publishers: [{ Name: 'Square' }],
          CoverImage: 'https://example.com/cover.jpg',
          Description: '<p>Un clásico de rol japonés con combates por turnos y una historia memorable.</p>',
          UserScore: 88,
        },
        { Name: 'Hidden Game', Hidden: true },
      ],
    });
    const r = parseCatalogImportJson(json);
    expect(r.source).toBe('playnite');
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]!.title).toBe('Final Fantasy VII');
    expect(r.rows[0]!.platform).toContain('PlayStation');
    expect(r.rows[0]!.releaseYear).toBe(1997);
    expect(r.rows[0]!.genre).toBe('RPG');
    expect(r.rows[0]!.description).toContain('clásico de rol');
    expect(r.rows[0]!.favorite).toBe(1);
    expect(r.rows[0]!.metadataSource).toBe('import:playnite');
    expect(r.rows[0]!.metadataStatus).toBe('resolved');
    expect(r.notes.some((n) => n.includes('ocultos'))).toBe(true);
  });

  it('parseCatalogImport acepta JSON CoverLens', () => {
    const json = JSON.stringify({ app: 'CoverLens', formatVersion: 4, items: [] });
    expect(parseCatalogImport(json).source).toBe('coverlens');
  });

  it('ignora portadas locales o rutas Windows en CoverImage', () => {
    const json = JSON.stringify([
      {
        Name: 'Test',
        Platforms: [{ Name: 'PC' }],
        CoverImage: 'C:\\Games\\cover.png',
      },
    ]);
    const r = parseCatalogImportJson(json);
    expect(r.rows[0]!.coverUrl).toBeNull();
  });
});
