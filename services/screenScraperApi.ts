import { getApiCredentials } from './credentialsStore';
import { fetchWithTimeout } from './utils/networkUtils';

export type RecognizedGame = {
  title: string;
  barcode?: string;
  platform: string;
  version: string;
  releaseYear: number;
  genre: string;
  developer: string;
  source?: 'local' | 'screenscraper';
  lookupStatus?:
    | 'ok'
    | 'missing_credentials'
    | 'invalid_params'
    | 'request_failed'
    | 'not_found'
    | 'fallback_local';
};

type ScreenScraperAttempt = {
  data: RecognizedGame | null;
  error?: 'missing_credentials' | 'invalid_params' | 'request_failed' | 'not_found';
};

const barcodeCatalog: Record<string, RecognizedGame> = {
  '711719766003': {
    title: 'God of War Ragnarok',
    barcode: '711719766003',
    platform: 'PlayStation 5',
    version: 'PAL',
    releaseYear: 2022,
    genre: 'Action Adventure',
    developer: 'Santa Monica Studio',
  },
  '045496744625': {
    title: 'The Legend of Zelda: Tears of the Kingdom',
    barcode: '045496744625',
    platform: 'Switch',
    version: 'PAL',
    releaseYear: 2023,
    genre: 'Action Adventure',
    developer: 'Nintendo EPD',
  },
};

const fallbackCatalog: Record<string, RecognizedGame> = {
  'metal gear solid 3': {
    title: 'Metal Gear Solid 3: Snake Eater',
    platform: 'PlayStation 2',
    version: 'PAL',
    releaseYear: 2004,
    genre: 'Stealth',
    developer: 'Konami',
  },
  'final fantasy vii': {
    title: 'Final Fantasy VII',
    platform: 'PlayStation',
    version: 'PAL',
    releaseYear: 1997,
    genre: 'RPG',
    developer: 'Square',
  },
};

// MVP: simulamos el reconocimiento de caratula con una tabla local.
// En el siguiente paso se reemplaza por ScreenScraper/RAWG/IGDB.
export async function recognizeGameFromCover(inputTitle: string): Promise<RecognizedGame> {
  const normalized = inputTitle.trim().toLowerCase();
  const known = fallbackCatalog[normalized];

  if (known) {
    return known;
  }

  return {
    title: inputTitle.trim() || 'Juego sin titulo',
    platform: 'Plataforma desconocida',
    version: 'Unknown',
    releaseYear: new Date().getFullYear(),
    genre: 'Pendiente',
    developer: 'Pendiente',
    source: 'local',
  };
}

async function tryResolveWithScreenScraper(barcode: string): Promise<ScreenScraperAttempt> {
  const credentials = await getApiCredentials();
  if (
    !credentials.screenScraperUsername ||
    !credentials.screenScraperPassword ||
    !credentials.screenScraperDevId ||
    !credentials.screenScraperDevPassword
  ) {
    return { data: null, error: 'missing_credentials' };
  }

  const commonParams = new URLSearchParams({
    output: 'json',
    softname: 'CoverLens',
    ssid: credentials.screenScraperUsername,
    sspassword: credentials.screenScraperPassword,
    devid: credentials.screenScraperDevId,
    devpassword: credentials.screenScraperDevPassword,
  });

  const candidateUrls = [
    `https://www.screenscraper.fr/api2/jeuInfos.php?${commonParams.toString()}&barcode=${encodeURIComponent(
      barcode
    )}`,
    `https://www.screenscraper.fr/api2/jeuRecherche.php?${commonParams.toString()}&recherche=${encodeURIComponent(
      barcode
    )}`,
  ];

  let hadSuccessfulResponse = false;
  let hadInvalidParamsResponse = false;

  for (const candidate of candidateUrls) {
    try {
      const response = await fetchWithTimeout(candidate, undefined, 10000);
      const bodyText = await response.text();

      if (!response.ok) {
        if (response.status === 400) {
          hadInvalidParamsResponse = true;
          continue;
        }
        continue;
      }
      hadSuccessfulResponse = true;

      let payload: unknown = null;
      try {
        payload = JSON.parse(bodyText);
      } catch {
        continue;
      }

      const gameFromInfos = (payload as { response?: { jeu?: unknown } })?.response?.jeu;
      if (gameFromInfos && typeof gameFromInfos === 'object') {
        const game = gameFromInfos as {
          noms?: { nom_us?: string; nom_eu?: string; nom_jp?: string };
          genres?: { genre_1?: string };
          developpeur?: { text?: string };
          dates?: { date_us?: string; date_eu?: string; date_jp?: string };
          systeme?: { nom?: string };
        };
        const dateValue = game.dates?.date_eu ?? game.dates?.date_us ?? game.dates?.date_jp ?? '';
        const year = Number.parseInt(dateValue.slice(0, 4), 10);

        return {
          data: {
            title: game.noms?.nom_eu ?? game.noms?.nom_us ?? game.noms?.nom_jp ?? `Juego ${barcode}`,
            barcode,
            platform: game.systeme?.nom ?? 'Plataforma desconocida',
            version: 'Unknown',
            releaseYear: Number.isFinite(year) ? year : new Date().getFullYear(),
            genre: game.genres?.genre_1 ?? 'Pendiente',
            developer: game.developpeur?.text ?? 'Pendiente',
            source: 'screenscraper',
          },
        };
      }

      const gameListRaw = (payload as { response?: { jeux?: unknown[] | Record<string, unknown> } })?.response?.jeux;
      const gameList = Array.isArray(gameListRaw)
        ? gameListRaw
        : gameListRaw && typeof gameListRaw === 'object'
          ? Object.values(gameListRaw)
          : [];
      if (gameList.length > 0) {
        const first = gameList[0] as { nom?: string; systeme?: { nom?: string } };
        return {
          data: {
            title: first?.nom ?? `Juego ${barcode}`,
            barcode,
            platform: first?.systeme?.nom ?? 'Plataforma desconocida',
            version: 'Unknown',
            releaseYear: new Date().getFullYear(),
            genre: 'Pendiente',
            developer: 'Pendiente',
            source: 'screenscraper',
          },
        };
      }
    } catch {
      continue;
    }
  }

  if (hadInvalidParamsResponse && !hadSuccessfulResponse) {
    return { data: null, error: 'invalid_params' };
  }

  return { data: null, error: hadSuccessfulResponse ? 'not_found' : 'request_failed' };
}

export async function recognizeGameFromBarcode(barcode: string): Promise<RecognizedGame> {
  const normalized = barcode.trim();

  const fromApi = await tryResolveWithScreenScraper(normalized);
  if (fromApi.data) {
    return { ...fromApi.data, lookupStatus: 'ok' };
  }

  const known = barcodeCatalog[normalized];
  if (known) {
    return {
      ...known,
      source: 'local',
      lookupStatus: fromApi.error ?? 'fallback_local',
    };
  }

  return {
    title: `Juego ${normalized}`,
    barcode: normalized,
    platform: 'Plataforma desconocida',
    version: 'Unknown',
    releaseYear: new Date().getFullYear(),
    genre: 'Pendiente',
    developer: 'Pendiente',
    source: 'local',
    lookupStatus: fromApi.error ?? 'fallback_local',
  };
}
