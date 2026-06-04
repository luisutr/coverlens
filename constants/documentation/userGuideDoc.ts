/**
 * Guía de usuario CoverLens (in-app).
 * Pantalla: app/documentacion-usuario.tsx
 * Markdown alineado: docs/GUIA_USUARIO_COVERLENS.md
 */

export type UserGuideSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export const USER_GUIDE_TITLE = 'Cómo usar CoverLens';

export const USER_GUIDE_LEAD =
  'Manual de la aplicación: qué hace cada pestaña, cómo añadir juegos y cómo configurar fuentes opcionales. Tu catálogo se guarda en el móvil.';

export const USER_GUIDE_SECTIONS: UserGuideSection[] = [
  {
    heading: 'Qué es CoverLens',
    paragraphs: [
      'CoverLens es un catálogo personal de videojuegos físicos: portadas, metadatos (título, plataforma, año, género, descripción…) y, si lo activas, un valor económico orientativo por juego.',
      'Incluye un servicio integrado (catálogo en covers.cholloweb.es) que funciona sin cuenta ni claves. Las APIs de terceros son opcionales: las configuras tú en Ajustes con tus propias credenciales.',
    ],
  },
  {
    heading: 'Primer arranque',
    paragraphs: [
      'La primera vez verás una guía inicial: presentación de la app, APIs opcionales (IGDB, SteamGridDB, ScreenScraper, PriceCharting, eBay, GameUPC) y una guía práctica del escáner.',
      'Puedes saltarla y configurar todo después en Ajustes. En Ajustes también puedes repetir la guía inicial o la guía del escáner cuando quieras.',
    ],
  },
  {
    heading: 'Pestaña Colección',
    paragraphs: [
      'Lista todos tus juegos en tarjetas con portada. Toca una tarjeta para abrir la ficha del juego.',
    ],
    bullets: [
      'Buscar: filtra por texto en el título.',
      'Plataforma: filtra por consola (solo las que ya tienes en el catálogo).',
      'Favoritos / Solo disco: atajos para ver solo esos juegos.',
      'Ordenar: reciente, título, plataforma, año, puntuación o valor estimado.',
      'Mantén pulsado un juego (si está disponible) o usa la ficha para eliminar desde allí.',
    ],
  },
  {
    heading: 'Pestaña Escáner — Barcode',
    paragraphs: [
      'Apunta la cámara al código EAN/UPC del juego. Si el código es válido y no está duplicado, CoverLens busca metadatos y portada según el orden de fuentes en Ajustes.',
      'Si no encuentra el juego, puedes guardarlo con título y plataforma a mano y completar la ficha después.',
    ],
  },
  {
    heading: 'Pestaña Escáner — Lote (IA)',
    paragraphs: [
      'Para añadir muchos juegos de una estantería: fotografía los lomos, copia el prompt, abre Gemini, adjunta la foto y pega el prompt. Gemini devuelve un JSON con título y plataforma por juego.',
      'Pega ese JSON en CoverLens, revisa la lista, importa y opcionalmente resuelve metadatos y portadas en lote. La foto se procesa en Gemini, no en los servidores de CoverLens.',
    ],
    bullets: [
      'Consejo: una fila de lomos bien iluminados y la misma plataforma por foto mejora el resultado.',
      'Tras importar, usa Ajustes → «Reintentar metadatos» y «Descargar portadas en lote» si quieres completar fichas automáticamente.',
    ],
  },
  {
    heading: 'Pestaña Escáner — Manual',
    paragraphs: [
      'Escribe el título del juego y, si puedes, la plataforma (por ejemplo «Zelda Breath of the Wild Switch»). CoverLens normaliza el texto y busca la ficha en las fuentes activas.',
    ],
  },
  {
    heading: 'Ficha del juego',
    paragraphs: [
      'Desde la colección, abre un juego para ver portada, datos y valor. El icono de lápiz permite editar campos a mano.',
    ],
    bullets: [
      'Completar metadatos: ejecuta la cadena de fuentes de metadatos y luego la de portadas (según Ajustes).',
      'Actualizar portada: solo busca imagen, sin cambiar el resto de campos.',
      'Actualizar valor: prueba las fuentes de cotización activas (CoverLens integrado, PriceCharting, eBay…).',
      'Favorito y Solo disco: marcas rápidas en la ficha.',
      'Estado de la ficha (pending / partial / resolved): indica si faltan portada o datos de texto; no es un error grave, solo guía para completar.',
    ],
  },
  {
    heading: 'Pestaña Ajustes — Catálogo y fuentes',
    paragraphs: [
      'Aquí ordenas y activas las fuentes para portadas, metadatos y valor. Por defecto CoverLens (integrado) va primero y no requiere clave.',
    ],
    bullets: [
      'Orden de fuentes (portadas): CoverLens → SteamGridDB → ScreenScraper → IGDB (puedes cambiar orden e interruptores).',
      'Orden de fuentes (metadatos): CoverLens → ScreenScraper → IGDB (GameplayStores desactivado por defecto).',
      'Orden de fuentes (valor): CoverLens → PriceCharting → eBay (orientativo).',
      'Reintentar metadatos / Descargar portadas en lote: aplican la configuración actual a todo el catálogo.',
      'Exportar / Importar catálogo: copia de seguridad JSON o import desde Playnite (CSV) u otro export CoverLens.',
    ],
  },
  {
    heading: 'APIs opcionales (credenciales)',
    paragraphs: [
      'Despliega «APIs de metadatos» en Ajustes y guarda solo lo que uses. Las claves quedan en el dispositivo (almacenamiento seguro), no en servidores de CoverLens.',
    ],
    bullets: [
      'IGDB (Twitch): año, género, descripción, nota; muy recomendado si quieres fichas completas.',
      'SteamGridDB: portadas de alta calidad; requiere API key.',
      'ScreenScraper: metadatos y cajas regionales; usuario y contraseña.',
      'GameUPC: ayuda a resolver algunos códigos de barras en título (API key opcional).',
      'PriceCharting Pro: precio guía en USD (suscripción Pro con token).',
      'eBay Developers: mediana de anuncios activos (orientativo; no es precio de venta cerrada).',
    ],
  },
  {
    heading: 'Valor económico — importante',
    paragraphs: [
      'Los importes que ves son estimaciones orientativas a partir de fuentes públicas o de terceros. Pueden estar desactualizados o no coincidir con tu edición, región o estado del juego (nuevo, usado, precintado, solo disco…).',
      'No constituyen una tasación oficial ni un precio garantizado. Contrasta la información antes de comprar, vender o tomar decisiones económicas (también verás este aviso en la ficha de cada juego y en Ajustes → Cotización).',
    ],
  },
  {
    heading: 'Privacidad y datos',
    paragraphs: [
      'El catálogo vive en tu móvil (SQLite). Las búsquedas al servicio integrado CoverLens envían título, plataforma o código de barras, sin credenciales personales ni cuenta de usuario en ese servidor.',
      'Política de privacidad: https://covers.cholloweb.es/privacidad',
    ],
  },
  {
    heading: 'Documentación técnica de fuentes',
    paragraphs: [
      'Si quieres el detalle de cómo se eligen portadas y metadatos en el código (mantenimiento o pruebas avanzadas), abre Ajustes → «Documentación: portadas y fuentes».',
    ],
  },
];
