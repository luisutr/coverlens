import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/utils/networkUtils', () => ({
  fetchWithTimeout: vi.fn(),
}));

import {
  findBestGameplayStoresProduct,
  resolveCoverFromGameplayStoresSearch,
  scoreGpsListingForCatalog,
} from '../services/providers/gameplayStoresCoverProvider';
import { parseGamePlayStoresName } from '../services/utils/barcodeToTitle';
import { fetchWithTimeout } from '../services/utils/networkUtils';

function jsonResponse(obj: unknown): Response {
  return new Response(JSON.stringify(obj), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('resolveCoverFromGameplayStoresSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sin plataforma no llama a la red', async () => {
    const url = await resolveCoverFromGameplayStoresSearch('Some Game', null);
    expect(url).toBeNull();
    expect(fetchWithTimeout).not.toHaveBeenCalled();
  });

  it('prefiere large_default del JSON (como la ficha web) frente a thickbox en cover.large', async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValue(
      jsonResponse({
        products: [
          {
            name: 'X-Men Next Dimension - PS2',
            cover: {
              large: { url: 'https://media.gameplaystores.es/1-thickbox_default/x.jpg' },
              medium: { url: 'https://media2.gameplaystores.es/1-large_default/x.jpg' },
              bySize: {
                large_default: { url: 'https://media2.gameplaystores.es/1-large_default/x.jpg' },
                thickbox_default: { url: 'https://media.gameplaystores.es/1-thickbox_default/x.jpg' },
              },
            },
          },
        ],
      })
    );

    const resolved = await resolveCoverFromGameplayStoresSearch('X-Men Next Dimension', 'PlayStation 2');
    expect(resolved).toBe('https://media2.gameplaystores.es/1-large_default/x.jpg');
  });

  it('elige producto con título y plataforma alineados y devuelve cover.large si no hay large_default', async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValue(
      jsonResponse({
        products: [
          {
            name: 'X-Men Legends - PS2',
            cover: { large: { url: 'https://media.gameplaystores.es/wrong.jpg' } },
          },
          {
            name: 'X-Men Next Dimension - PS2',
            cover: { large: { url: 'https://media.gameplaystores.es/right.jpg' } },
          },
        ],
      })
    );

    const url = await resolveCoverFromGameplayStoresSearch('X-Men Next Dimension', 'PlayStation 2');
    expect(url).toBe('https://media.gameplaystores.es/right.jpg');
    expect(fetchWithTimeout).toHaveBeenCalledTimes(1);
    const calledUrl = vi.mocked(fetchWithTimeout).mock.calls[0][0] as string;
    expect(calledUrl).toContain('order=product.position.desc');
    expect(calledUrl).toContain(encodeURIComponent('X-Men Next Dimension - PS2'));
  });

  it('no duplica el sufijo GPS si el título ya termina en « - PS2»', async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValue(
      jsonResponse({
        products: [
          {
            name: 'X-Men Next Dimension - PS2',
            cover: { large: { url: 'https://media.gameplaystores.es/ok.jpg' } },
          },
        ],
      })
    );

    await resolveCoverFromGameplayStoresSearch('X-Men Next Dimension - PS2', 'PlayStation 2');
    const calledUrl = vi.mocked(fetchWithTimeout).mock.calls[0][0] as string;
    expect(calledUrl).not.toContain(encodeURIComponent('X-Men Next Dimension - PS2 - PS2'));
    expect(calledUrl).toContain(encodeURIComponent('X-Men Next Dimension - PS2'));
  });

  it('rechaza match débil de título', async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValue(
      jsonResponse({
        products: [
          {
            name: 'Totally Unrelated RPG - PS2',
            cover: { large: { url: 'https://media.gameplaystores.es/nope.jpg' } },
          },
        ],
      })
    );

    const url = await resolveCoverFromGameplayStoresSearch('X-Men Next Dimension', 'PlayStation 2');
    expect(url).toBeNull();
  });

  it('con plataforma solo acepta listados con sufijo « - PLAT» (descarta enciclopedia sin plataforma)', async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValue(
      jsonResponse({
        products: [
          {
            name: 'Enciclopedia Super Mario Bros.',
            cover: { large: { url: 'https://media.gameplaystores.es/bad.jpg' } },
          },
          {
            name: 'Super Mario Bros (Cartucho) - NES',
            cover: { large: { url: 'https://media.gameplaystores.es/good.jpg' } },
          },
        ],
      })
    );

    const p = await findBestGameplayStoresProduct('Mario Bros', 'NES');
    expect(p?.name).toBe('Super Mario Bros (Cartucho) - NES');
  });

  it('prefiere SMB original frente a SMB3 si la búsqueda no indica número', async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValue(
      jsonResponse({
        products: [
          {
            name: 'Super Mario Bros 3 (Cartucho) - NES',
            cover: { large: { url: 'https://media.gameplaystores.es/3.jpg' } },
          },
          {
            name: 'Super Mario Bros (Cartucho) - NES',
            cover: { large: { url: 'https://media.gameplaystores.es/1.jpg' } },
          },
        ],
      })
    );

    const p = await findBestGameplayStoresProduct('Mario Bros', 'NES');
    expect(p?.name).toContain('Super Mario Bros (Cartucho)');
    expect(p?.name).not.toContain('Bros 3');
  });
});

describe('scoreGpsListingForCatalog', () => {
  it('penaliza enciclopedias', () => {
    const parsedGood = parseGamePlayStoresName('Super Mario Bros (Cartucho) - NES');
    const parsedBad = parseGamePlayStoresName('Enciclopedia Super Mario Bros.');
    const sGood = scoreGpsListingForCatalog('mario bros', 'Super Mario Bros (Cartucho) - NES', parsedGood);
    const sBad = scoreGpsListingForCatalog('mario bros', 'Enciclopedia Super Mario Bros.', parsedBad);
    expect(sGood).toBeGreaterThan(sBad);
  });
});
