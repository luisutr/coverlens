/**
 * Tests del proveedor VPS covers.cholloweb.es
 *
 * Cubre:
 *   - canonicalToVpsSlug: mapeo de plataforma canónica a slug VPS
 *   - searchChollwebVps: fetch a /api/browse.php (mockeado)
 *   - getChollwebVpsDetail: fetch a /games/{platform}/{slug}.json (mockeado)
 *   - resolveFromChollwebVps: metadatos completos
 *   - resolveCoverFromChollwebVps: URL de portada
 *   - resolveValueFromChollwebVps: precio en EUR
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/utils/barcodeToTitle', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/utils/barcodeToTitle')>();
  return {
    ...actual,
    barcodeToTitle: vi.fn().mockResolvedValue(null),
  };
});

import {
  canonicalToVpsSlug,
  resolveFromChollwebVps,
  resolveCoverFromChollwebVps,
  resolveValueFromChollwebVps,
  searchChollwebVps,
  searchChollwebVpsByBarcode,
  getChollwebVpsDetail,
  type VpsBrowseResponse,
  type VpsGameDetail,
} from '../services/providers/chollwebVpsProvider';
import { barcodeToTitle } from '../services/utils/barcodeToTitle';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeBrowseResponse(overrides: Partial<VpsBrowseResponse> = {}): VpsBrowseResponse {
  return {
    query: 'mario',
    platform: 'switch',
    total: 1,
    page: 1,
    limit: 5,
    pages: 1,
    results: [
      {
        slug: 'super-mario-odyssey',
        title: 'Super Mario Odyssey',
        platform: 'Switch',
        platformSlug: 'switch',
        coverUrl: 'https://covers.cholloweb.es/covers/switch/super-mario-odyssey.jpg',
        marketValueEUR: 39.95,
        rating: 97,
        castilianText: true,
        castilianVoice: false,
        physicalRelease: true,
      },
    ],
    ...overrides,
  };
}

function makeGameDetail(overrides: Partial<VpsGameDetail> = {}): VpsGameDetail {
  return {
    slug: 'super-mario-odyssey',
    title: 'Super Mario Odyssey',
    platform: 'Switch',
    platformSlug: 'switch',
    version: null,
    barcode: null,
    genre: 'Platform / Action-Adventure',
    developer: 'Nintendo EPD',
    publisher: 'Nintendo',
    releaseYear: 2017,
    description: 'Super Mario Odyssey is a platform-action-adventure game.',
    rating: 97,
    coverPath: 'covers/switch/super-mario-odyssey.jpg',
    coverUrl: 'https://media.rawg.io/media/games/267/267bd0dbc496f52692487d07d014c061.jpg',
    marketValue: 39.95,
    igdbId: 3756,
    ...overrides,
  };
}

// ── canonicalToVpsSlug ────────────────────────────────────────────────────────

describe('canonicalToVpsSlug', () => {
  it.each([
    ['PlayStation 5', 'ps5'],
    ['PlayStation 4', 'ps4'],
    ['PlayStation 3', 'ps3'],
    ['PlayStation 2', 'ps2'],
    ['PlayStation', 'psx'],
    ['PSP', 'psp'],
    ['PS Vita', 'psvita'],
    ['Switch', 'switch'],
    ['Wii U', 'wiiu'],
    ['Wii', 'wii'],
    ['Nintendo 3DS', '3ds'],
    ['Nintendo DS', 'nds'],
    ['Game Boy Advance', 'gba'],
    ['GameCube', 'gc'],
    ['Nintendo 64', 'n64'],
    ['SNES', 'snes'],
    ['NES', 'nes'],
    ['Xbox Series X', 'xbsx'],
    ['Xbox One', 'xboxone'],
    ['Xbox 360', 'x360'],
    ['Mega Drive', 'md'],
    ['PC', 'pc'],
  ])('%s → %s', (canonical, expected) => {
    expect(canonicalToVpsSlug(canonical)).toBe(expected);
  });

  it('acepta nombres no canónicos pasándolos por canonicalizePlatform', () => {
    expect(canonicalToVpsSlug('ps4')).toBe('ps4');
    expect(canonicalToVpsSlug('nintendo switch')).toBe('switch');
    expect(canonicalToVpsSlug('game boy advance')).toBe('gba');
  });

  it('devuelve null para plataformas desconocidas', () => {
    expect(canonicalToVpsSlug('Commodore 64')).toBeNull();
    expect(canonicalToVpsSlug('Plataforma desconocida')).toBeNull();
  });
});

// ── searchChollwebVps ────────────────────────────────────────────────────────

describe('searchChollwebVps', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('devuelve null si fetch falla', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('network'));
    const result = await searchChollwebVps('mario', 'switch');
    expect(result).toBeNull();
  });

  it('devuelve null si respuesta no es ok (404)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response('Not found', { status: 404 })
    );
    const result = await searchChollwebVps('mario', 'switch');
    expect(result).toBeNull();
  });

  it('construye la URL con parámetros correctos', async () => {
    const mockData = makeBrowseResponse();
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200 })
    );

    await searchChollwebVps('mario kart', 'switch', 3);

    const calledUrl = mockFetch.mock.calls[0]![0] as string;
    expect(calledUrl).toContain('/api/browse.php');
    expect(calledUrl).toContain('q=mario+kart');
    expect(calledUrl).toContain('platform=switch');
    expect(calledUrl).toContain('limit=3');
  });

  it('no incluye platform si es null', async () => {
    const mockData = makeBrowseResponse({ platform: null });
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200 })
    );

    await searchChollwebVps('mario', null, 5);

    const calledUrl = mockFetch.mock.calls[0]![0] as string;
    expect(calledUrl).not.toContain('platform=');
  });

  it('devuelve la respuesta parseada', async () => {
    const mockData = makeBrowseResponse();
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200 })
    );

    const result = await searchChollwebVps('mario', 'switch');
    expect(result?.total).toBe(1);
    expect(result?.results[0]?.title).toBe('Super Mario Odyssey');
  });
});

// ── getChollwebVpsDetail ──────────────────────────────────────────────────────

describe('getChollwebVpsDetail', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('devuelve null si fetch falla', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('timeout'));
    const result = await getChollwebVpsDetail('switch', 'super-mario-odyssey');
    expect(result).toBeNull();
  });

  it('construye la URL correcta /games/{platform}/{slug}.json', async () => {
    const detail = makeGameDetail();
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(detail), { status: 200 })
    );

    await getChollwebVpsDetail('switch', 'super-mario-odyssey');

    const calledUrl = mockFetch.mock.calls[0]![0] as string;
    expect(calledUrl).toBe('https://covers.cholloweb.es/games/switch/super-mario-odyssey.json');
  });

  it('devuelve la ficha completa', async () => {
    const detail = makeGameDetail();
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(detail), { status: 200 })
    );

    const result = await getChollwebVpsDetail('switch', 'super-mario-odyssey');
    expect(result?.genre).toBe('Platform / Action-Adventure');
    expect(result?.developer).toBe('Nintendo EPD');
    expect(result?.releaseYear).toBe(2017);
    expect(result?.igdbId).toBe(3756);
  });
});

// ── searchChollwebVpsByBarcode ────────────────────────────────────────────────

describe('searchChollwebVpsByBarcode', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(barcodeToTitle).mockResolvedValue(null);
  });

  it('devuelve null si fetch falla', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('network'));
    const result = await searchChollwebVpsByBarcode('5021290040045');
    expect(result).toBeNull();
  });

  it('devuelve null si respuesta no es ok', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response('Not found', { status: 404 })
    );
    const result = await searchChollwebVpsByBarcode('5021290040045');
    expect(result).toBeNull();
  });

  it('devuelve null si count es 0 en todas las variantes', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ barcode: '5021290040045', count: 0, results: [] }), { status: 200 })
    );
    const result = await searchChollwebVpsByBarcode('5021290040045');
    expect(result).toBeNull();
  });

  it('llama a /api/search.php con el barcode correcto', async () => {
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ barcode: '045496742843', count: 0, results: [] }), { status: 200 })
    );
    await searchChollwebVpsByBarcode('045496742843');
    const calledUrl = mockFetch.mock.calls[0]![0] as string;
    expect(calledUrl).toContain('/api/search.php');
    expect(calledUrl).toContain('barcode=045496742843');
  });

  it('devuelve el primer resultado cuando hay hit', async () => {
    const hit = {
      score: 1,
      slug: 'super-mario-odyssey',
      title: 'Super Mario Odyssey',
      platform: 'Switch',
      platformSlug: 'switch',
      coverPath: 'covers/switch/super-mario-odyssey.jpg',
      jsonUrl: 'https://covers.cholloweb.es/games/switch/super-mario-odyssey.json',
    };
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ barcode: '045496742843', count: 1, results: [hit] }), { status: 200 })
    );
    const result = await searchChollwebVpsByBarcode('045496742843');
    expect(result).not.toBeNull();
    expect(result!.slug).toBe('super-mario-odyssey');
    expect(result!.platformSlug).toBe('switch');
  });

  it('prueba UPC-A (12 dígitos) y acierta con EAN-13 en el índice', async () => {
    const hit = {
      score: 1,
      slug: 'super-mario-odyssey',
      title: 'Super Mario Odyssey',
      platform: 'Switch',
      platformSlug: 'switch',
      coverPath: 'covers/switch/super-mario-odyssey.jpg',
      jsonUrl: '',
    };
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ barcode: '045496742843', count: 0, results: [] }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ barcode: '0045496742843', count: 1, results: [hit] }), { status: 200 })
      );
    const result = await searchChollwebVpsByBarcode('045496742843');
    expect(result?.slug).toBe('super-mario-odyssey');
  });
});

// ── resolveFromChollwebVps ────────────────────────────────────────────────────

describe('resolveFromChollwebVps', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(barcodeToTitle).mockResolvedValue(null);
  });

  it('devuelve null si no hay titleHint ni barcode', async () => {
    const result = await resolveFromChollwebVps({});
    expect(result).toBeNull();
  });

  it('devuelve null si titleHint es solo espacios y no hay barcode', async () => {
    const result = await resolveFromChollwebVps({ titleHint: '   ' });
    expect(result).toBeNull();
  });

  // ── Ruta barcode-only ─────────────────────────────────────────────────────

  it('ruta barcode: devuelve null si search.php no encuentra el EAN ni hay fallback de título', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ barcode: '0000000000000', count: 0, results: [] }), { status: 200 })
    );
    const result = await resolveFromChollwebVps({ barcode: '0000000000000' });
    expect(result).toBeNull();
    expect(barcodeToTitle).toHaveBeenCalledWith('0000000000000');
  });

  it('ruta barcode: fallback barcodeToTitle → browse cuando search.php falla', async () => {
    const browseData = makeBrowseResponse();
    const detail = makeGameDetail();

    vi.mocked(barcodeToTitle).mockResolvedValueOnce({
      title: 'Super Mario Odyssey',
      platformHint: 'Switch',
      editionHint: null,
    });

    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ barcode: '045496742843', count: 0, results: [] }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ barcode: '045496742843', count: 0, results: [] }), { status: 200 })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(browseData), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(detail), { status: 200 }));

    const result = await resolveFromChollwebVps({ barcode: '045496742843' });
    expect(result?.title).toBe('Super Mario Odyssey');
    expect(barcodeToTitle).toHaveBeenCalled();
  });

  it('ruta barcode: resuelve MetadataResult cuando el EAN está en el VPS', async () => {
    const hit = {
      score: 1,
      slug: 'super-mario-odyssey',
      title: 'Super Mario Odyssey',
      platform: 'Switch',
      platformSlug: 'switch',
      coverPath: 'covers/switch/super-mario-odyssey.jpg',
      jsonUrl: 'https://covers.cholloweb.es/games/switch/super-mario-odyssey.json',
    };
    const detail = makeGameDetail();

    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ barcode: '045496742843', count: 1, results: [hit] }), { status: 200 })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(detail), { status: 200 }));

    const result = await resolveFromChollwebVps({ barcode: '045496742843' });
    expect(result).not.toBeNull();
    expect(result!.title).toBe('Super Mario Odyssey');
    expect(result!.platform).toBe('Switch');
    expect(result!.genre).toBe('Platform / Action-Adventure');
    expect(result!.source).toBe('cholloweb');
    expect(result!.status).toBe('resolved');
  });

  it('ruta barcode: usa coverPath del hit si detail no tiene coverPath', async () => {
    const hit = {
      score: 1,
      slug: 'super-mario-odyssey',
      title: 'Super Mario Odyssey',
      platform: 'Switch',
      platformSlug: 'switch',
      coverPath: 'covers/switch/super-mario-odyssey.jpg',
      jsonUrl: '',
    };
    const detail = makeGameDetail({ coverPath: null, coverUrl: null });

    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ barcode: '045496742843', count: 1, results: [hit] }), { status: 200 })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(detail), { status: 200 }));

    const result = await resolveFromChollwebVps({ barcode: '045496742843' });
    expect(result!.coverUrl).toBe('https://covers.cholloweb.es/covers/switch/super-mario-odyssey.jpg');
  });

  it('ruta barcode: funciona aunque getChollwebVpsDetail falle (datos del hit)', async () => {
    const hit = {
      score: 1,
      slug: 'super-mario-odyssey',
      title: 'Super Mario Odyssey',
      platform: 'Switch',
      platformSlug: 'switch',
      coverPath: null,
      jsonUrl: '',
    };

    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ barcode: '045496742843', count: 1, results: [hit] }), { status: 200 })
      )
      .mockResolvedValueOnce(new Response('', { status: 500 }));

    const result = await resolveFromChollwebVps({ barcode: '045496742843' });
    expect(result).not.toBeNull();
    expect(result!.title).toBe('Super Mario Odyssey');
    expect(result!.genre).toBeNull();
    expect(result!.status).toBe('partial');
  });

  it('devuelve null si browse no encuentra resultados', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(makeBrowseResponse({ total: 0, results: [] })), { status: 200 })
    );
    const result = await resolveFromChollwebVps({ titleHint: 'Juego Inexistente' });
    expect(result).toBeNull();
  });

  it('devuelve null si el mejor resultado tiene similitud baja', async () => {
    const browseData = makeBrowseResponse({
      results: [
        {
          slug: 'tekken-7',
          title: 'Tekken 7',
          platform: 'PlayStation 4',
          platformSlug: 'ps4',
          coverUrl: 'https://covers.cholloweb.es/covers/ps4/tekken-7.jpg',
          marketValueEUR: 20.0,
          rating: 82,
          castilianText: false,
          castilianVoice: false,
          physicalRelease: true,
        },
      ],
    });
    // Browse llama dos veces fetch (browse + detail), mockeamos ambas
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(browseData), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 404 }));

    const result = await resolveFromChollwebVps({ titleHint: 'Completamente Diferente XYZABC' });
    expect(result).toBeNull();
  });

  it('devuelve MetadataResult con status resolved cuando hay ficha completa', async () => {
    const browseData = makeBrowseResponse();
    const detail = makeGameDetail();

    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(browseData), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(detail), { status: 200 }));

    const result = await resolveFromChollwebVps({
      titleHint: 'Super Mario Odyssey',
      platformHint: 'Switch',
    });

    expect(result).not.toBeNull();
    expect(result!.title).toBe('Super Mario Odyssey');
    expect(result!.platform).toBe('Switch');
    expect(result!.genre).toBe('Platform / Action-Adventure');
    expect(result!.developer).toBe('Nintendo EPD');
    expect(result!.publisher).toBe('Nintendo');
    expect(result!.releaseYear).toBe(2017);
    expect(result!.rating).toBe(97);
    expect(result!.source).toBe('cholloweb');
    expect(result!.status).toBe('resolved');
  });

  it('usa la coverUrl del browse como portada (URL del VPS)', async () => {
    const browseData = makeBrowseResponse();
    const detail = makeGameDetail();

    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(browseData), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(detail), { status: 200 }));

    const result = await resolveFromChollwebVps({ titleHint: 'Super Mario Odyssey', platformHint: 'Switch' });
    // La coverUrl del browse apunta directamente al VPS (prioridad sobre la de RAWG del detail)
    expect(result!.coverUrl).toBe('https://covers.cholloweb.es/covers/switch/super-mario-odyssey.jpg');
  });

  it('devuelve status partial si no hay developer ni publisher en ficha', async () => {
    const browseData = makeBrowseResponse();
    const detail = makeGameDetail({ developer: null, publisher: null });

    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(browseData), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(detail), { status: 200 }));

    const result = await resolveFromChollwebVps({ titleHint: 'Super Mario Odyssey' });
    expect(result!.status).toBe('partial');
  });

  it('funciona aunque getChollwebVpsDetail falle (solo datos del browse)', async () => {
    const browseData = makeBrowseResponse();

    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(browseData), { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 500 })); // detail falla

    const result = await resolveFromChollwebVps({ titleHint: 'Super Mario Odyssey', platformHint: 'Switch' });
    expect(result).not.toBeNull();
    expect(result!.title).toBe('Super Mario Odyssey');
    expect(result!.platform).toBe('Switch');
    // Sin datos de detail, genre/developer serán null
    expect(result!.genre).toBeNull();
    expect(result!.developer).toBeNull();
    expect(result!.status).toBe('partial');
  });

  it('canonicaliza la plataforma correctamente', async () => {
    const browseData = makeBrowseResponse({
      results: [
        {
          slug: 'god-of-war',
          title: 'God of War',
          platform: 'PlayStation 4',
          platformSlug: 'ps4',
          coverUrl: 'https://covers.cholloweb.es/covers/ps4/god-of-war.jpg',
          marketValueEUR: 20.0,
          rating: 94,
          castilianText: true,
          castilianVoice: true,
          physicalRelease: true,
        },
      ],
    });
    const detail = makeGameDetail({
      title: 'God of War',
      platform: 'PlayStation 4',
      platformSlug: 'ps4',
    });

    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(browseData), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(detail), { status: 200 }));

    const result = await resolveFromChollwebVps({ titleHint: 'God of War', platformHint: 'ps4' });
    expect(result!.platform).toBe('PlayStation 4');
  });
});

// ── resolveCoverFromChollwebVps ───────────────────────────────────────────────

describe('resolveCoverFromChollwebVps', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('devuelve null si title está vacío', async () => {
    const result = await resolveCoverFromChollwebVps('', 'Switch');
    expect(result).toBeNull();
  });

  it('devuelve la coverUrl del primer resultado con buena similitud', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(makeBrowseResponse()), { status: 200 })
    );

    const result = await resolveCoverFromChollwebVps('Super Mario Odyssey', 'Switch');
    expect(result).toBe('https://covers.cholloweb.es/covers/switch/super-mario-odyssey.jpg');
  });

  it('devuelve null si coverUrl es null', async () => {
    const browseData = makeBrowseResponse({
      results: [{ ...makeBrowseResponse().results[0]!, coverUrl: null }],
    });
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(browseData), { status: 200 })
    );

    const result = await resolveCoverFromChollwebVps('Super Mario Odyssey', 'Switch');
    expect(result).toBeNull();
  });

  it('devuelve null si fetch falla', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('network'));
    const result = await resolveCoverFromChollwebVps('Mario', null);
    expect(result).toBeNull();
  });
});

// ── resolveValueFromChollwebVps ───────────────────────────────────────────────

describe('resolveValueFromChollwebVps', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('devuelve null si title está vacío', async () => {
    const result = await resolveValueFromChollwebVps('', 'Switch');
    expect(result).toBeNull();
  });

  it('devuelve cents y currency EUR cuando hay marketValueEUR', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(makeBrowseResponse()), { status: 200 })
    );

    const result = await resolveValueFromChollwebVps('Super Mario Odyssey', 'Switch');
    expect(result).not.toBeNull();
    expect(result!.cents).toBe(3995); // 39.95 * 100
    expect(result!.currency).toBe('EUR');
  });

  it('devuelve null si marketValueEUR es null', async () => {
    const browseData = makeBrowseResponse({
      results: [{ ...makeBrowseResponse().results[0]!, marketValueEUR: null }],
    });
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(browseData), { status: 200 })
    );

    const result = await resolveValueFromChollwebVps('Super Mario Odyssey', 'Switch');
    expect(result).toBeNull();
  });

  it('redondea correctamente a entero de centavos', async () => {
    const browseData = makeBrowseResponse({
      results: [{ ...makeBrowseResponse().results[0]!, marketValueEUR: 14.999 }],
    });
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(browseData), { status: 200 })
    );

    const result = await resolveValueFromChollwebVps('Super Mario Odyssey', 'Switch');
    expect(result!.cents).toBe(1500);
  });

  it('devuelve null si fetch falla', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('timeout'));
    const result = await resolveValueFromChollwebVps('Mario', 'Switch');
    expect(result).toBeNull();
  });
});
