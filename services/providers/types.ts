export type MetadataStatus = 'resolved' | 'partial' | 'error';

export type MetadataResult = {
  title: string;
  platform: string;
  version?: string | null;
  releaseYear?: number | null;
  genre?: string | null;
  developer?: string | null;
  publisher?: string | null;
  description?: string | null;
  rating?: number | null;
  franchise?: string | null;
  coverUrl?: string | null;
  /** Arte de cabecera ancha en la ficha (p. ej. carátula IGDB); opcional y no se toca al «Actualizar portada». */
  headerImageUrl?: string | null;
  status: MetadataStatus;
  source: string;
  error?: string;
  /** Precio en tienda GameplayStores al importar (se guarda en `games.value*` si la BD lo admite). */
  valueCents?: number | null;
  valueCurrency?: string | null;
  valueSource?: 'gameplaystores' | null;
};

export type ResolveInput = {
  barcode?: string | null;
  titleHint?: string | null;
  /** Si está definido, se usa para afinar la búsqueda en IGDB */
  platformHint?: string | null;
  /** Si está definido, se usa para filtrar por año en IGDB */
  yearHint?: number | null;
  /**
   * Por defecto true. Si es false, no se consultan fuentes externas de portada:
   * solo se devuelven metadatos de texto (y URLs de imagen que ya vinieran del proveedor de ficha).
   */
  fetchCovers?: boolean;
};
