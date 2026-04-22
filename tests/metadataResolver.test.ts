import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/providers/igdbProvider', () => ({
  resolveFromIgdb: vi.fn(),
}));
vi.mock('../services/providers/screenScraperProvider', () => ({
  resolveFromScreenScraper: vi.fn(),
}));
vi.mock('../services/coverSourcePreferences', () => ({
  loadCoverSourcePreferences: vi.fn(async () => ({
    order: ['gameplaystores', 'steamgriddb', 'igdb', 'screenscraper'],
    enabled: {
      gameplaystores: true,
      steamgriddb: true,
      igdb: true,
      screenscraper: true,
    },
  })),
}));
vi.mock('../services/coverPreferenceResolver', () => ({
  resolvePreferredCoverUrl: vi.fn(async (_t: string, _h: unknown, fb: string | null | undefined) => fb ?? null),
  resolvePreferredCoverWithSource: vi.fn(
    async (_t: string, _h: unknown, fb: string | null | undefined) => ({
      url: fb ?? null,
      source: fb ? 'igdb' : null,
    })
  ),
}));
vi.mock('../services/utils/barcodeToTitle', async () => {
  const actual = await vi.importActual<typeof import('../services/utils/barcodeToTitle')>(
    '../services/utils/barcodeToTitle'
  );
  return { ...actual, barcodeToTitle: vi.fn() };
});
vi.mock('../services/providers/gameplayStoresCoverProvider', () => ({
  findBestGameplayStoresProduct: vi.fn().mockResolvedValue(null),
}));
vi.mock('../services/metadataSourcePreferences', () => ({
  loadMetadataSourcePreferences: vi.fn(async () => ({
    order: ['gameplaystores', 'igdb', 'screenscraper'],
    enabled: { gameplaystores: true, igdb: true, screenscraper: true },
  })),
}));
vi.mock('../services/providers/gameplayStoresMetadataProvider', () => ({
  resolveFromGameplayStoresMetadata: vi.fn().mockResolvedValue(null),
}));

import { resolvePreferredCoverUrl, resolvePreferredCoverWithSource } from '../services/coverPreferenceResolver';
import { resolveMetadata } from '../services/metadataResolver';
import { findBestGameplayStoresProduct } from '../services/providers/gameplayStoresCoverProvider';
import { resolveFromGameplayStoresMetadata } from '../services/providers/gameplayStoresMetadataProvider';
import { resolveFromIgdb } from '../services/providers/igdbProvider';
import { resolveFromScreenScraper } from '../services/providers/screenScraperProvider';
import { barcodeToTitle } from '../services/utils/barcodeToTitle';

describe('metadataResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findBestGameplayStoresProduct).mockResolvedValue(null);
    vi.mocked(resolveFromGameplayStoresMetadata).mockResolvedValue(null);
    vi.mocked(resolvePreferredCoverUrl).mockImplementation(async (_t, _h, fb) => fb ?? null);
    vi.mocked(resolvePreferredCoverWithSource).mockImplementation(async (_t, _h, fb) => ({
      url: fb ?? null,
      source: fb ? 'igdb' : null,
    }));
  });

  it('devuelve partial cuando GPS resuelve título pero providers fallan', async () => {
    vi.mocked(resolveFromGameplayStoresMetadata).mockResolvedValue({
      title: 'Metroid Prime',
      platform: 'GameCube',
      version: "Player's Choice",
      releaseYear: null,
      genre: null,
      developer: null,
      publisher: null,
      description: null,
      rating: null,
      franchise: null,
      coverUrl: null,
      headerImageUrl: null,
      status: 'partial',
      source: 'gameplaystores',
    });

    vi.mocked(resolveFromIgdb).mockResolvedValue({
      title: 'Metroid Prime',
      platform: 'Plataforma desconocida',
      status: 'error',
      source: 'igdb',
      error: 'not_found',
    });

    vi.mocked(resolveFromScreenScraper).mockResolvedValue({
      title: 'Metroid Prime',
      platform: 'Plataforma desconocida',
      status: 'error',
      source: 'screenscraper',
      error: 'not_found',
    });

    const result = await resolveMetadata({ barcode: '045496391256' });

    expect(result.status).toBe('partial');
    expect(result.title).toBe('Metroid Prime');
    expect(result.platform).toBe('GameCube');
    expect(result.version).toBe("Player's Choice");
  });

  it('partial con portada cuando IGDB y ScreenScraper fallan pero SteamGrid (u otras) devuelven URL', async () => {
    vi.mocked(resolveFromIgdb).mockResolvedValue({
      title: 'X-Men: Next Dimension',
      platform: 'Plataforma desconocida',
      status: 'error',
      source: 'igdb',
      error: 'not_found',
    });
    vi.mocked(resolveFromScreenScraper).mockResolvedValue({
      title: 'X-Men: Next Dimension',
      platform: 'Plataforma desconocida',
      status: 'error',
      source: 'screenscraper',
      error: 'not_found',
    });
    vi.mocked(resolvePreferredCoverWithSource).mockResolvedValue({
      url: 'https://cdn.steamgriddb.com/grid/x.png',
      source: 'steamgriddb',
    });

    const result = await resolveMetadata({
      titleHint: 'X-Men: Next Dimension',
      platformHint: 'PlayStation 2',
    });

    expect(result.status).toBe('partial');
    expect(result.source).toBe('cover_fallback');
    expect(result.coverUrl).toBe('https://cdn.steamgriddb.com/grid/x.png');
    expect(result.platform).toBe('PlayStation 2');
  });

  it('GPS como primera capa enriquece titleHint para IGDB (manual + plataforma)', async () => {
    vi.mocked(resolveFromGameplayStoresMetadata).mockResolvedValue({
      title: 'Super Mario Bros',
      platform: 'NES',
      version: null,
      releaseYear: null,
      genre: null,
      developer: null,
      publisher: null,
      description: null,
      rating: null,
      franchise: null,
      coverUrl: null,
      headerImageUrl: null,
      status: 'partial',
      source: 'gameplaystores',
    });
    vi.mocked(resolveFromIgdb).mockImplementation(async (input) => {
      expect(input.titleHint).toBe('Super Mario Bros');
      expect(input.platformHint).toBe('NES');
      return {
        title: 'Super Mario Bros',
        platform: 'NES',
        status: 'resolved',
        source: 'igdb',
        coverUrl: 'https://image.test/cover.jpg',
        headerImageUrl: 'https://image.test/cover.jpg',
        version: null,
        genre: 'Platform',
        releaseYear: 1985,
      };
    });

    const result = await resolveMetadata({ titleHint: 'Mario Bros', platformHint: 'NES' });
    expect(result.title).toBe('Super Mario Bros');
    expect(resolveFromGameplayStoresMetadata).toHaveBeenCalled();
  });

  it('mantiene resolved cuando IGDB devuelve metadata completa', async () => {
    vi.mocked(resolveFromIgdb).mockResolvedValue({
      title: 'Stellar Blade',
      platform: 'PlayStation 5',
      status: 'resolved',
      source: 'igdb',
      coverUrl: 'https://image.test/cover.jpg',
      headerImageUrl: 'https://image.test/cover.jpg',
      version: null,
      genre: 'Action',
      releaseYear: 2024,
    });

    const result = await resolveMetadata({ titleHint: 'Stellar Blade' });
    expect(result.status).toBe('resolved');
    expect(result.title).toBe('Stellar Blade');
    expect(result.platform).toBe('PlayStation 5');
    expect(result.coverUrl).toBe('https://image.test/cover.jpg');
    expect(result.headerImageUrl).toBe('https://image.test/cover.jpg');
  });

  it('guarda la carátula del proveedor como cabecera y la de la cadena como portada de catálogo', async () => {
    vi.mocked(resolveFromIgdb).mockResolvedValue({
      title: 'X-Men Next Dimension',
      platform: 'PlayStation 2',
      status: 'resolved',
      source: 'igdb',
      coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1.jpg',
      headerImageUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1.jpg',
      version: null,
      genre: 'Fighting',
      releaseYear: 2003,
    });
    vi.mocked(resolvePreferredCoverWithSource).mockResolvedValue({
      url: 'https://media.gameplaystores.es/90759-thickbox_default/x-men.jpg',
      source: 'gameplaystores',
    });

    const result = await resolveMetadata({ titleHint: 'X-Men Next Dimension', platformHint: 'PlayStation 2' });
    expect(result.coverUrl).toBe('https://media.gameplaystores.es/90759-thickbox_default/x-men.jpg');
    expect(result.headerImageUrl).toBe('https://images.igdb.com/igdb/image/upload/t_cover_big/co1.jpg');
  });

  it('recorre metadatos en orden: GameplayStores → IGDB → ScreenScraper', async () => {
    const order: string[] = [];
    vi.mocked(resolveFromGameplayStoresMetadata).mockImplementation(async () => {
      order.push('gameplaystores');
      return null;
    });
    vi.mocked(resolveFromIgdb).mockImplementation(async () => {
      order.push('igdb');
      return null;
    });
    vi.mocked(resolveFromScreenScraper).mockImplementation(async () => {
      order.push('screenscraper');
      return {
        title: 'Capa SS',
        platform: 'PlayStation 2',
        version: null,
        releaseYear: 2001,
        genre: 'Action',
        developer: null,
        publisher: null,
        description: null,
        rating: null,
        franchise: null,
        coverUrl: null,
        headerImageUrl: null,
        status: 'partial',
        source: 'screenscraper',
      };
    });

    const result = await resolveMetadata({ titleHint: 'Capa SS', platformHint: 'PlayStation 2' });
    expect(order).toEqual(['gameplaystores', 'igdb', 'screenscraper']);
    expect(result.title).toBe('Capa SS');
    expect(result.genre).toBe('Action');
  });

  it('con fetchCovers false no llama a la cadena de portada y omite URLs de imagen', async () => {
    vi.mocked(resolveFromIgdb).mockResolvedValue({
      title: 'Stellar Blade',
      platform: 'PlayStation 5',
      status: 'resolved',
      source: 'igdb',
      coverUrl: 'https://image.test/cover.jpg',
      headerImageUrl: 'https://image.test/header.jpg',
      version: null,
      genre: 'Action',
      releaseYear: 2024,
    });

    const result = await resolveMetadata({ titleHint: 'Stellar Blade', fetchCovers: false });

    expect(resolvePreferredCoverWithSource).not.toHaveBeenCalled();
    expect(result.coverUrl).toBeUndefined();
    expect(result.headerImageUrl).toBeUndefined();
    expect(result.title).toBe('Stellar Blade');
    expect(result.status).toBe('resolved');
  });
});
