/**
 * Textos y URLs de atribución a proveedores de terceros (ToS / cumplimiento).
 * Solo incluye servicios activos según docs/FUENTES_TERCEROS_DECISION.md.
 */
export const ATTRIBUTIONS = {
  igdb: {
    text: 'Data freely provided by IGDB.com',
    url: 'https://www.igdb.com/',
  },
  steamGridDb: {
    text: 'Portadas vía SteamGridDB',
    url: 'https://www.steamgriddb.com/',
  },
  screenScraper: {
    text: 'Metadatos y portadas vía ScreenScraper',
    url: 'https://www.screenscraper.fr/',
  },
  gameUpc: {
    text: 'Datos de barcode vía GameUPC',
    url: 'https://www.gameupc.com/',
  },
} as const;

export const PRIVACY_POLICY_URL = 'https://covers.cholloweb.es/privacidad';
