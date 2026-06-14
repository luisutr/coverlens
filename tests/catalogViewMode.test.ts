import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

import * as SecureStore from 'expo-secure-store';
import { getCatalogViewMode, setCatalogViewMode } from '../services/catalogViewMode';

describe('catalogViewMode', () => {
  beforeEach(() => {
    vi.mocked(SecureStore.getItemAsync).mockReset();
    vi.mocked(SecureStore.setItemAsync).mockReset();
  });

  it('devuelve grid por defecto', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
    await expect(getCatalogViewMode()).resolves.toBe('grid');
  });

  it('lee slide cuando está guardado', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue('slide');
    await expect(getCatalogViewMode()).resolves.toBe('slide');
  });

  it('persiste el modo elegido', async () => {
    await setCatalogViewMode('slide');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('coverlens_catalog_view_mode_v1', 'slide');
  });
});
