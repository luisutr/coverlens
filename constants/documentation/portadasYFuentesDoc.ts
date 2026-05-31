/**
 * Documentación de portadas y fuentes (mantenimiento).
 * Pantalla: app/documentacion-fuentes.tsx
 * Fuentes activas: CoverLens (integrado), ScreenScraper, SteamGridDB, IGDB, GameUPC, PriceCharting, eBay.
 * GameplayStores desactivado (nivel C — sin confirmación de uso). Ver docs/FUENTES_TERCEROS_DECISION.md.
 */

export type PortadasDocSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export const PORTADAS_DOC_TITLE = 'Portadas y fuentes de datos';

export const PORTADAS_DOC_FOOTNOTE =
  'Código relevante: services/coverPreferenceResolver.ts, services/metadataSourcePreferences.ts, services/providers/chollwebVpsProvider.ts, services/metadataResolver.ts. Decisión de fuentes: docs/FUENTES_TERCEROS_DECISION.md.';

export const PORTADAS_Y_FUENTES_SECTIONS: PortadasDocSection[] = [
  {
    heading: 'Qué resuelve esta app',
    paragraphs: [
      'CoverLens incorpora su propio servicio de reconocimiento de juegos — funciona sin cuenta ni configuración. Además puede conectar con fuentes externas opcionales que el usuario activa con sus propias credenciales para obtener metadatos más completos, portadas de mayor calidad o valoración económica.',
    ],
  },
  {
    heading: 'Orden al elegir la URL de portada',
    paragraphs: [
      'La función resolvePreferredCoverUrl (services/coverPreferenceResolver.ts) prueba en este orden (configurable en Ajustes → Catálogo):',
    ],
    bullets: [
      'CoverLens (integrado) — catálogo propio; portadas curadas PAL/ESP. Primera en el orden; sin clave.',
      'SteamGridDB — grids de alta calidad; requiere API key del usuario.',
      'ScreenScraper — portadas y cajas regionales; usuario/contraseña del usuario.',
      'IGDB — URL de portada que ya venga del resultado de metadatos (si existe).',
    ],
  },
  {
    heading: 'Reconocimiento de barcode (EAN)',
    paragraphs: [
      'El escáner intenta resolver el EAN con GameUPC si el usuario ha configurado su clave en Ajustes → APIs. Sin clave, el barcode no genera título automático pero puede añadirse a mano.',
    ],
    bullets: [
      'GameUPC: fallback de barcode → título; requiere API key opcional del usuario.',
      'GameplayStores: desactivado (sin confirmación de uso por parte de la tienda).',
    ],
  },
  {
    heading: 'Metadatos (título, ficha, estados)',
    paragraphs: [
      'resolveMetadata (services/metadataResolver.ts) encadena fuentes según Ajustes → Catálogo → «Orden de fuentes (metadatos)» (services/metadataSourcePreferences.ts). Por defecto: CoverLens → ScreenScraper → IGDB. La primera fuente con datos válidos manda en título y plataforma; las siguientes solo rellenan campos vacíos (año, género, descripción…). ScreenScraper e IGDB son opcionales: el usuario los activa con sus credenciales.',
    ],
    bullets: [
      'CoverLens (integrado): búsqueda por título+plataforma en el catálogo propio; sin clave; primera en el orden.',
      'IGDB: si está activo y hay Client ID/Secret Twitch, busca por título y completa año, género, desarrollador y descripción.',
      'ScreenScraper: si está activo y hay usuario/contraseña, añade o completa datos y a veces portada regional.',
      'Tras fusionar metadatos, la portada del catálogo sigue la cadena de «Orden de fuentes (portadas)».',
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
      'En la ficha: «Completar metadatos» ejecuta la cadena de metadatos configurada y luego la de portadas; «Actualizar portada» solo la cadena de portadas (CoverLens → SteamGridDB → ScreenScraper → IGDB por defecto) sin tocar el resto de campos. La etiqueta «Portada · …» / «Ficha · …» se infiere del host de la URL o de la fuente que resolvió los metadatos. Reintentar metadatos en lote y descarga de portadas en lote recalculan el estado con la misma regla.',
    ],
  },
  {
    heading: 'Créditos de terceros',
    paragraphs: [
      'CoverLens muestra atribuciones cuando corresponde (Ajustes → Créditos y legal; ficha del juego). Solo se integran servicios con confirmación escrita o cuyos términos de uso CoverLens cumple con app gratuita y credenciales del usuario. Ver docs/FUENTES_TERCEROS_DECISION.md.',
    ],
    bullets: [
      'IGDB: «Data freely provided by IGDB.com» — obligatorio por ToS de Twitch/IGDB.',
      'SteamGridDB: enlace al proveedor — condición confirmada por escrito (Jozen, 2026-04-30).',
      'ScreenScraper: crédito voluntario — uso confirmado por escrito (MarbleMad, 2026-05-11).',
      'GameUPC: atribución recomendada — fallback de barcode con API key del usuario.',
      'Política de privacidad: https://covers.cholloweb.es/privacidad',
    ],
  },
  {
    heading: 'Archivos útiles para mantenimiento',
    paragraphs: [],
    bullets: [
      'services/coverPreferenceResolver.ts — orden de portadas.',
      'services/metadataSourcePreferences.ts — orden y activación de fuentes de metadatos.',
      'services/providers/chollwebVpsProvider.ts — CoverLens integrado.',
      'services/utils/barcodeToTitle.ts — resolución de EAN (GameUPC).',
      'services/metadataResolver.ts — fusión de metadatos y portada final.',
      'services/providers/steamGridDbProvider.ts — SteamGridDB.',
      'services/providers/screenScraperProvider.ts — ScreenScraper.',
    ],
  },
];
