import { vi } from 'vitest';

/** Evita cargar React Native vía expo-secure-store en entorno Vitest (node). */
vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn(async () => {}),
  deleteItemAsync: vi.fn(async () => {}),
}));
