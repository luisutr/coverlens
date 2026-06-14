import * as SecureStore from 'expo-secure-store';

export type CatalogViewMode = 'grid' | 'slide';

const STORAGE_KEY = 'coverlens_catalog_view_mode_v1';

export async function getCatalogViewMode(): Promise<CatalogViewMode> {
  const raw = await SecureStore.getItemAsync(STORAGE_KEY);
  return raw === 'slide' ? 'slide' : 'grid';
}

export async function setCatalogViewMode(mode: CatalogViewMode): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEY, mode);
}
