import { describe, expect, it } from 'vitest';
import { inferCoverSourceLabel } from '../services/utils/coverUrlSource';

describe('inferCoverSourceLabel', () => {
  it('reconoce CoverLens VPS en cholloweb.es', () => {
    expect(inferCoverSourceLabel('https://covers.cholloweb.es/catalogo/covers/foo.jpg')).toBe(
      'CoverLens VPS'
    );
  });

  it('reconoce otras fuentes conocidas', () => {
    expect(inferCoverSourceLabel('https://media.gameplaystores.es/cover.jpg')).toBe('GameplayStores');
    expect(inferCoverSourceLabel('https://cdn.steamgriddb.com/grid.png')).toBe('SteamGridDB');
    expect(inferCoverSourceLabel('https://images.igdb.com/igdb/image/upload/t_cover_big/x.jpg')).toBe(
      'IGDB'
    );
  });

  it('devuelve null para URL vacía o no http', () => {
    expect(inferCoverSourceLabel(null)).toBeNull();
    expect(inferCoverSourceLabel('')).toBeNull();
    expect(inferCoverSourceLabel('/local/path.jpg')).toBeNull();
  });
});
