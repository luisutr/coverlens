# Portadas y fuentes de datos (CoverLens)

> Mantener alineado con `constants/documentation/portadasYFuentesDoc.ts` (la pantalla **Ajustes → Documentación: portadas y fuentes** lee ese módulo).

## Qué resuelve esta app

CoverLens combina varias fuentes externas. No hay un único proveedor oficial de «carátula por título»: cada uno tiene huecos (juegos viejos, regiones, ediciones). Por eso encadenamos varios pasos y preferimos cajas que coincidan con plataforma cuando es posible.

## Orden al elegir la URL de portada

La función `resolvePreferredCoverUrl` (`services/coverPreferenceResolver.ts`) prueba en este orden:

1. **GameplayStores** — solo si el juego tiene plataforma conocida y está mapeada a una categoría «Juegos …» de la tienda. Un GET JSON al buscador de PrestaShop con filtro `id_category`; elegimos el producto cuyo nombre (`Título - PS2`, etc.) encaja con el título y la plataforma. Suele acertar en stock PAL/español.

2. **SteamGridDB** — grids en tamaño moderado para ahorrar datos; buena cobertura pero a veces mezcla regiones o ediciones.

3. **IGDB** — URL de portada que ya venga del resultado de metadatos (si existe).

4. **ScreenScraper** — búsqueda por título/plataforma como último recurso; depende de credenciales y límites de la API.

## GameplayStores: por qué y cómo (sin API pública)

GameplayStores ([gameplaystores.es](https://www.gameplaystores.es/)) no publica una API documentada para la app. Reutilizamos el mismo mecanismo que el escáner de código de barras: peticiones al buscador con `Accept: application/json`.

- **EAN:** `busqueda?s=<codigo>` devuelve `products[]` con `name` tipo `Stellar Blade - PS5`.

- **Portada por título:** `busqueda?controller=search&s=<texto>&id_category=<id>` acota a la categoría de juegos de esa plataforma (p. ej. Juegos PS2 → `1246`). Así la primera página de resultados contiene candidatos de la plataforma correcta; el código filtra por similitud de título y por el sufijo de plataforma parseado con la misma lógica que el barcode (`parseGamePlayStoresName` en `services/utils/barcodeToTitle.ts`).

- La URL de la tienda con `mot_q` / `mot_s` en el navegador es el buscador Motive en la web; para la app se usa el flujo anterior porque es estable con JSON y categoría.

**Buenas prácticas:** cada resolución de portada puede implicar al menos un GET a la tienda; en lotes grandes («Descargar portadas en lote») conviene no saturar: ya hay timeouts; si hiciera falta, aumentar pausas entre ítems.

## Metadatos (título, ficha, estados)

`resolveMetadata` (`services/metadataResolver.ts`) encadena fuentes según **Ajustes → Catálogo → Orden de fuentes (metadatos)** (`services/metadataSourcePreferences.ts`). Por defecto: **GameplayStores → IGDB → ScreenScraper**. La primera fuente con datos válidos prioriza título y plataforma; las siguientes solo rellenan campos vacíos. IGDB y ScreenScraper se pueden desactivar; GameplayStores no requiere clave.

- **GameplayStores:** EAN (`busqueda?s=…`) o título+plataforma; `parseGamePlayStoresName`.
- **IGDB:** si está activo y hay credenciales Twitch, EAN en `external_games` y búsqueda por título.
- **ScreenScraper:** si está activo y hay usuario/contraseña.

Tras fusionar metadatos, la **portada** del listado sigue la cadena de portadas (puede cambiar la URL que viniera del metadato).

## Estado resolved / partial

`deriveMetadataStatusFromGameFields` (`services/utils/metadataCompleteness.ts`) define la regla única en catálogo:

- **resolved:** portada con URL `http(s)` + título válido + plataforma conocida + al menos uno entre: año, género, desarrollador, publisher, descripción (>24 caracteres) o versión/edición no vacía. No exige barcode ni precio.
- **partial:** falta portada, plataforma/título inválidos o ningún dato de ficha extra.

Las importaciones (Playnite JSON/CSV, export CoverLens) recalculan el estado; un juego solo con nombre y plataforma queda `partial` hasta tener imagen y un dato de ficha.

## Dónde se usa en la UI

- Ficha: **Completar metadatos** (`resolveMetadata`) y **Actualizar portada** (solo `resolvePreferredCoverWithSource` con `igdb` en null, misma prioridad: GameplayStores primero si aplica). La línea «Portada · …» infiere el origen por el host de la URL (`services/utils/coverUrlSource.ts`).
- Ajustes: reintento en lote y descarga de portadas en lote recalculan `metadataStatus` con la misma regla.

Credenciales: IGDB, SteamGridDB y ScreenScraper en Ajustes (`credentialsStore`). GameplayStores no requiere API key.

## Archivos útiles para mantenimiento

| Área | Archivo |
|------|---------|
| Regla resolved/partial | `services/utils/metadataCompleteness.ts` |
| Etiqueta «Portada ·» | `services/utils/coverUrlSource.ts` |
| Orden de portadas | `services/coverPreferenceResolver.ts` |
| Orden de metadatos | `services/metadataSourcePreferences.ts` |
| GameplayStores (categorías + matching) | `services/providers/gameplayStoresCoverProvider.ts` |
| Metadatos GPS | `services/providers/gameplayStoresMetadataProvider.ts` |
| Barcode / parseo nombres GPS | `services/utils/barcodeToTitle.ts` |
| Flujo metadatos | `services/metadataResolver.ts` |
| SteamGridDB | `services/providers/steamGridDbProvider.ts` |
| ScreenScraper | `services/providers/screenScraperProvider.ts` |
| Texto de esta doc en la app | `constants/documentation/portadasYFuentesDoc.ts` |
| Pantalla in-app | `app/documentacion-fuentes.tsx` |
