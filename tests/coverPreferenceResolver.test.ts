import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/providers/screenScraperProvider', () => ({
  resolveCoverFromScreenScraperSearch: vi.fn(),
}));
vi.mock('../services/providers/steamGridDbProvider', () => ({
  resolveCoverFromSteamGridDb: vi.fn(),
}));
vi.mock('../services/providers/gameplayStoresCoverProvider', () => ({
  resolveCoverFromGameplayStoresSearch: vi.fn(),
}));
vi.mock('../services/providers/chollwebVpsProvider', () => ({
  resolveCoverFromChollwebVps: vi.fn().mockResolvedValue(null),
}));
vi.mock('../services/coverSourcePreferences', () => ({
  loadCoverSourcePreferences: vi.fn(async () => ({
    order: ['gameplaystores', 'steamgriddb', 'igdb', 'screenscraper'],
    enabled: {
      cholloweb: false,
      gameplaystores: true,
      steamgriddb: true,
      igdb: true,
      screenscraper: true,
    },
  })),
}));

import type { CoverSourcePreferences } from '../services/coverSourcePreferences';
import { resolvePreferredCoverUrl } from '../services/coverPreferenceResolver';
import { resolveCoverFromGameplayStoresSearch } from '../services/providers/gameplayStoresCoverProvider';
import { resolveCoverFromScreenScraperSearch } from '../services/providers/screenScraperProvider';
import { resolveCoverFromSteamGridDb } from '../services/providers/steamGridDbProvider';

describe('resolvePreferredCoverUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveCoverFromGameplayStoresSearch).mockResolvedValue(null);
  });

  it('prioriza GameplayStores cuando hay match y plataforma mapeada', async () => {
    vi.mocked(resolveCoverFromGameplayStoresSearch).mockResolvedValue('https://media.gameplaystores.es/cover.jpg');
    vi.mocked(resolveCoverFromSteamGridDb).mockResolvedValue('https://sg/grid.png');

    const url = await resolvePreferredCoverUrl('X-Men Next Dimension', 'PlayStation 2', null);
    expect(url).toBe('https://media.gameplaystores.es/cover.jpg');
    expect(resolveCoverFromGameplayStoresSearch).toHaveBeenCalledWith('X-Men Next Dimension', 'PlayStation 2');
    expect(resolveCoverFromSteamGridDb).not.toHaveBeenCalled();
  });

  it('prioriza SteamGridDB sobre IGDB y ScreenScraper si GameplayStores no aporta URL', async () => {
    vi.mocked(resolveCoverFromSteamGridDb).mockResolvedValue('https://sg/grid.png');
    vi.mocked(resolveCoverFromScreenScraperSearch).mockResolvedValue('https://ss/box.png');

    const url = await resolvePreferredCoverUrl('Portal 2', 'PC (Windows)', 'https://igdb/cover.jpg');
    expect(url).toBe('https://sg/grid.png');
    expect(resolveCoverFromSteamGridDb).toHaveBeenCalled();
    expect(resolveCoverFromScreenScraperSearch).not.toHaveBeenCalled();
  });

  it('si SteamGridDB falla, usa IGDB', async () => {
    vi.mocked(resolveCoverFromSteamGridDb).mockResolvedValue(null);
    vi.mocked(resolveCoverFromScreenScraperSearch).mockResolvedValue('https://ss/box.png');

    const url = await resolvePreferredCoverUrl('Foo', 'PlayStation 4', 'https://igdb/x.jpg');
    expect(url).toBe('https://igdb/x.jpg');
    expect(resolveCoverFromScreenScraperSearch).not.toHaveBeenCalled();
  });

  it('si SteamGrid e IGDB vacíos, usa ScreenScraper', async () => {
    vi.mocked(resolveCoverFromSteamGridDb).mockResolvedValue(null);
    vi.mocked(resolveCoverFromScreenScraperSearch).mockResolvedValue('https://ss/box.png');

    const url = await resolvePreferredCoverUrl('Foo', 'PlayStation 4', null);
    expect(url).toBe('https://ss/box.png');
    expect(resolveCoverFromScreenScraperSearch).toHaveBeenCalled();
  });

  it('usa fallback IGDB si Steam y SS fallan', async () => {
    vi.mocked(resolveCoverFromSteamGridDb).mockResolvedValue(null);
    vi.mocked(resolveCoverFromScreenScraperSearch).mockResolvedValue(null);

    const url = await resolvePreferredCoverUrl('Bar', 'Switch', 'https://igdb/cover.jpg');
    expect(url).toBe('https://igdb/cover.jpg');
  });

  it('sin título solo devuelve IGDB si existe', async () => {
    vi.mocked(resolveCoverFromSteamGridDb).mockResolvedValue('https://sg/x.png');

    const url = await resolvePreferredCoverUrl('  ', 'Switch', 'https://igdb/only.jpg');
    expect(url).toBe('https://igdb/only.jpg');
    expect(resolveCoverFromGameplayStoresSearch).not.toHaveBeenCalled();
    expect(resolveCoverFromSteamGridDb).not.toHaveBeenCalled();
  });

  it('sin título no usa IGDB si esa fuente está desactivada en preferencias', async () => {
    const prefs: CoverSourcePreferences = {
      order: ['gameplaystores', 'steamgriddb', 'igdb', 'screenscraper'],
      enabled: {
        gameplaystores: true,
        steamgriddb: true,
        igdb: false,
        screenscraper: true,
      },
    };
    const url = await resolvePreferredCoverUrl('  ', 'Switch', 'https://igdb/only.jpg', prefs);
    expect(url).toBeNull();
  });

  it('respeta orden: SteamGridDB antes que GameplayStores', async () => {
    vi.mocked(resolveCoverFromGameplayStoresSearch).mockResolvedValue('https://media.gameplaystores.es/cover.jpg');
    vi.mocked(resolveCoverFromSteamGridDb).mockResolvedValue('https://sg/grid.png');
    const prefs: CoverSourcePreferences = {
      order: ['steamgriddb', 'gameplaystores', 'igdb', 'screenscraper'],
      enabled: {
        gameplaystores: true,
        steamgriddb: true,
        igdb: true,
        screenscraper: true,
      },
    };
    const url = await resolvePreferredCoverUrl('X-Men Next Dimension', 'PlayStation 2', null, prefs);
    expect(url).toBe('https://sg/grid.png');
    expect(resolveCoverFromSteamGridDb).toHaveBeenCalled();
    expect(resolveCoverFromGameplayStoresSearch).not.toHaveBeenCalled();
  });
});
