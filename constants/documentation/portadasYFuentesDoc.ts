/**
 * Documentación de portadas y fuentes (mantenimiento).
 * Pantalla: app/documentacion-fuentes.tsx
 * Copia en Markdown: docs/PORTADAS_Y_FUENTES.md (mantener alineados si cambia la lógica).
 */

export type PortadasDocSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export const PORTADAS_DOC_TITLE = 'Portadas y fuentes de datos';

export const PORTADAS_DOC_FOOTNOTE =
  'Copia para lectura en IDE o Git: docs/PORTADAS_Y_FUENTES.md. Código: services/coverPreferenceResolver.ts, services/metadataSourcePreferences.ts, services/providers/gameplayStoresCoverProvider.ts, services/providers/gameplayStoresMetadataProvider.ts, services/metadataResolver.ts.';

export const PORTADAS_Y_FUENTES_SECTIONS: PortadasDocSection[] = [
  {
    heading: 'Qué resuelve esta app',
    paragraphs: [
      'CoverLens combina varias fuentes externas. No hay un único proveedor oficial de “carátula por título”: cada uno tiene huecos (juegos viejos, regiones, ediciones). Por eso encadenamos varios pasos y preferimos cajas que coincidan con plataforma cuando es posible.',
    ],
  },
  {
    heading: 'Orden al elegir la URL de portada',
    paragraphs: [
      'La función resolvePreferredCoverUrl (services/coverPreferenceResolver.ts) prueba en este orden:',
    ],
    bullets: [
      'GameplayStores — solo si el juego tiene plataforma conocida y está mapeada a una categoría «Juegos …» de la tienda. Un GET JSON al buscador de PrestaShop con filtro id_category; elegimos el producto cuyo nombre (Título - PS2, etc.) encaja con el título y la plataforma. Suele acertar en stock PAL/espanol.',
      'SteamGridDB — grids en tamaño moderado para ahorrar datos; buena cobertura pero a veces mezcla regiones o ediciones.',
      'IGDB — URL de portada que ya venga del resultado de metadatos (si existe).',
      'ScreenScraper — búsqueda por título/plataforma como último recurso; depende de credenciales y límites de la API.',
    ],
  },
  {
    heading: 'GameplayStores: por qué y cómo (sin API pública)',
    paragraphs: [
      'GameplayStores (gameplaystores.es) no publica una API documentada para nosotros. Reutilizamos el mismo mecanismo que el escáner de código de barras: peticiones al buscador con Accept: application/json.',
      'Para EAN: busqueda?s=<codigo> devuelve products[] con name tipo «Stellar Blade - PS5».',
      'Para portada por título: busqueda?controller=search&s=<texto>&id_category=<id> acota a la categoría de juegos de esa plataforma (p. ej. Juegos PS2 → 1246). Así la primera página de resultados contiene candidatos de la plataforma correcta; el código filtra por similitud de título y por el sufijo de plataforma parseado con la misma lógica que el barcode (parseGamePlayStoresName en services/utils/barcodeToTitle.ts).',
      'La URL de la tienda con mot_q / mot_s en el navegador es el buscador Motive en la web; para la app usamos el flujo anterior porque es estable con JSON y categoría.',
      'Buenas prácticas: cada resolución de portada puede implicar al menos un GET a la tienda; en lotes grandes (Descargar portadas en lote) conviene no saturar: ya hay timeouts; si hiciera falta, aumentar pausas entre ítems.',
    ],
  },
  {
    heading: 'Metadatos (título, ficha, estados)',
    paragraphs: [
      'resolveMetadata (services/metadataResolver.ts) encadena fuentes según Ajustes → Catálogo → «Orden de fuentes (metadatos)» (services/metadataSourcePreferences.ts). Por defecto: GameplayStores → IGDB → ScreenScraper. La primera fuente con datos válidos manda en título y plataforma; las siguientes solo rellenan campos vacíos (año, género, descripción…). IGDB y ScreenScraper son opcionales si el usuario las desactiva o no tiene credenciales.',
    ],
    bullets: [
      'GameplayStores: EAN en busqueda?s=… o título+plataforma (findBestGameplayStoresProduct); parseGamePlayStoresName; no requiere API key.',
      'IGDB: si está activo y hay Client ID/Secret Twitch, intenta EAN en external_games y luego búsqueda por título.',
      'ScreenScraper: si está activo y hay usuario/contraseña, añade o completa datos y a veces portada.',
      'Tras fusionar metadatos, la portada del catálogo sigue la cadena de «Orden de fuentes (portadas)» (puede sustituir la URL que trajera el metadato).',
    ],
  },
  {
    heading: 'Estado resolved / partial en el catálogo',
    paragraphs: [
      'deriveMetadataStatusFromGameFields (services/utils/metadataCompleteness.ts) unifica la regla: resolved = URL de portada http(s) + título válido + plataforma conocida + al menos uno entre año, género, desarrollador, publisher, descripción (>24 caracteres) o versión/edición no vacía. No exige barcode ni precio. Importaciones Playnite/CSV/JSON recalculan el estado; un juego con nombre y plataforma pero sin imagen o sin dato de ficha queda partial hasta completar.',
    ],
  },
  {
    heading: 'Dónde se usa en la UI',
    paragraphs: [
      'En la ficha: «Completar metadatos» ejecuta la cadena de metadatos configurada y luego la de portadas; «Actualizar portada» solo la cadena de portadas (GameplayStores → SteamGrid → IGDB → ScreenScraper por defecto) sin tocar el resto de campos. La etiqueta «Portada · …» se infiere del host de la URL. Reintentar metadatos en lote y descarga de portadas en lote recalculan el estado con la misma regla.',
    ],
  },
  {
    heading: 'Archivos útiles para mantenimiento',
    paragraphs: [],
    bullets: [
      'services/coverPreferenceResolver.ts — orden de portadas.',
      'services/metadataSourcePreferences.ts — orden y activación de fuentes de metadatos.',
      'services/providers/gameplayStoresCoverProvider.ts — mapa plataforma → id_category y matching.',
      'services/providers/gameplayStoresMetadataProvider.ts — metadatos desde listado GPS.',
      'services/utils/barcodeToTitle.ts — parseo de nombres GPS y búsqueda por EAN.',
      'services/metadataResolver.ts — fusión de metadatos y portada final.',
      'services/providers/steamGridDbProvider.ts — SteamGridDB.',
      'services/providers/screenScraperProvider.ts — ScreenScraper.',
    ],
  },
];
