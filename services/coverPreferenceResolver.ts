import type { CoverSourcePreferences } from './coverSourcePreferences';
import { loadCoverSourcePreferences } from './coverSourcePreferences';
import { resolveCoverFromCoverLensResource } from './providers/coverLensResourceProvider';
import { resolveCoverFromGameplayStoresSearch } from './providers/gameplayStoresCoverProvider';
import { resolveCoverFromScreenScraperSearch } from './providers/screenScraperProvider';
import { resolveCoverFromSteamGridDb } from './providers/steamGridDbProvider';

export type CoverResolution = { url: string | null; source: string | null };

/**
 * Portada del catálogo: orden y fuentes activas vienen de preferencias (Ajustes).
 * Por defecto: CoverLens Resource → GameplayStores → SteamGridDB → URL IGDB → ScreenScraper.
 */
export async function resolvePreferredCoverWithSource(
  title: string,
  platformHint: string | null | undefined,
  igdbOrOtherFallback: string | null | undefined,
  prefsOverride?: CoverSourcePreferences | null
): Promise<CoverResolution> {
  const t = title.trim();
  const igdb = igdbOrOtherFallback?.trim() || null;

  const prefs = prefsOverride ?? (await loadCoverSourcePreferences());

  if (!t) {
    if (igdb && prefs.enabled.igdb) return { url: igdb, source: 'igdb' };
    return { url: null, source: null };
  }

  for (const id of prefs.order) {
    if (!prefs.enabled[id]) continue;
    switch (id) {
      case 'coverlens': {
        const u = await resolveCoverFromCoverLensResource(t, platformHint);
        if (u) return { url: u, source: 'coverlens' };
        break;
      }
      case 'gameplaystores': {
        const u = await resolveCoverFromGameplayStoresSearch(t, platformHint);
        if (u) return { url: u, source: 'gameplaystores' };
        break;
      }
      case 'steamgriddb': {
        const u = await resolveCoverFromSteamGridDb(t);
        if (u) return { url: u, source: 'steamgriddb' };
        break;
      }
      case 'igdb': {
        if (igdb) return { url: igdb, source: 'igdb' };
        break;
      }
      case 'screenscraper': {
        const u = await resolveCoverFromScreenScraperSearch(t, platformHint);
        if (u) return { url: u, source: 'screenscraper' };
        break;
      }
    }
  }

  return { url: null, source: null };
}

export async function resolvePreferredCoverUrl(
  title: string,
  platformHint: string | null | undefined,
  igdbOrOtherFallback: string | null | undefined,
  prefsOverride?: CoverSourcePreferences | null
): Promise<string | null> {
  const { url } = await resolvePreferredCoverWithSource(
    title,
    platformHint,
    igdbOrOtherFallback,
    prefsOverride
  );
  return url;
}
