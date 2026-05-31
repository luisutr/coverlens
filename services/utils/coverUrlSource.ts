/**
 * Etiqueta legible de la fuente de la imagen según el host de la URL (sin columna extra en BD).
 */

export function inferCoverSourceLabel(coverUrl: string | null | undefined): string | null {
  const u = coverUrl?.trim().toLowerCase() ?? '';
  if (!u || !/^https?:\/\//i.test(u)) return null;
  if (u.includes('cholloweb.es')) return 'CoverLens VPS';
  if (u.includes('gameplaystores.es') || u.includes('media.gameplaystores')) return 'GameplayStores';
  if (u.includes('steamgriddb.com')) return 'SteamGridDB';
  if (u.includes('igdb.com')) return 'IGDB';
  if (u.includes('screenscraper.fr')) return 'ScreenScraper';
  return 'Web';
}
