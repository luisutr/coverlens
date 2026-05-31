import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/utils/networkUtils', () => ({
  fetchWithTimeout: vi.fn(),
}));

vi.mock('../services/credentialsStore', () => ({
  getApiCredentials: vi.fn(),
}));

import { barcodeToTitle } from '../services/utils/barcodeToTitle';
import { getApiCredentials } from '../services/credentialsStore';
import { fetchWithTimeout } from '../services/utils/networkUtils';

function jsonResponse(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('barcodeToTitle GameUPC fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getApiCredentials).mockResolvedValue({
      igdbClientId: '',
      igdbClientSecret: '',
      steamGridDbApiKey: '',
      screenScraperUser: '',
      screenScraperPassword: '',
      gameUpcApiKey: '',
    });
  });

  it('GPS desactivado — no llama a gameplaystores.es; con clave vacía devuelve null', async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValue(
      jsonResponse({ products: [{ name: 'Stellar Blade - PS5' }] })
    );

    const result = await barcodeToTitle('1234567890123');

    // GPS comentado en barcodeToTitle — no se llama a gameplaystores.es
    expect(result).toBeNull();
    expect(fetchWithTimeout).not.toHaveBeenCalledWith(
      expect.stringContaining('gameplaystores.es'),
      expect.anything(),
      expect.anything()
    );
    expect(fetchWithTimeout).not.toHaveBeenCalledWith(
      expect.stringContaining('api.gameupc.com'),
      expect.anything(),
      expect.anything()
    );
    expect(getApiCredentials).toHaveBeenCalledTimes(1);
  });

  it('sin clave GameUPC no llama a api.gameupc.com tras fallo GPS', async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValue(jsonResponse({ products: [] }));

    const result = await barcodeToTitle('1234567890123');

    expect(result).toBeNull();
    expect(getApiCredentials).toHaveBeenCalledTimes(1);
    expect(fetchWithTimeout).not.toHaveBeenCalledWith(
      expect.stringContaining('api.gameupc.com'),
      expect.anything(),
      expect.anything()
    );
  });

  it('con clave GameUPC llama a api.gameupc.com si GPS no resuelve', async () => {
    vi.mocked(getApiCredentials).mockResolvedValue({
      igdbClientId: '',
      igdbClientSecret: '',
      steamGridDbApiKey: '',
      screenScraperUser: '',
      screenScraperPassword: '',
      gameUpcApiKey: 'user-key-abc',
    });

    vi.mocked(fetchWithTimeout).mockImplementation(async (url) => {
      if (String(url).includes('gameplaystores.es')) {
        return jsonResponse({ products: [] });
      }
      if (String(url).includes('api.gameupc.com')) {
        return jsonResponse({ searched_for: 'Hollow Knight' });
      }
      return jsonResponse({}, 404);
    });

    const result = await barcodeToTitle('4006381333931');

    expect(result).toEqual({
      title: 'Hollow Knight',
      platformHint: null,
      editionHint: null,
    });
    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.gameupc.com/upc/4006381333931?search_mode=quality',
      expect.objectContaining({
        headers: { 'x-api-key': 'user-key-abc' },
      }),
      10000
    );
  });
});
