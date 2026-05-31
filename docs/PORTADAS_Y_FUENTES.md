# Portadas y fuentes de datos (CoverLens)

> Mantener alineado con `constants/documentation/portadasYFuentesDoc.ts` (la pantalla **Ajustes → Documentación: portadas y fuentes** lee ese módulo).
>
> Decisión de qué terceros integrar: [FUENTES_TERCEROS_DECISION.md](FUENTES_TERCEROS_DECISION.md)

## Qué resuelve esta app

CoverLens incorpora su **propio servicio de reconocimiento de juegos** (integrado, sin clave). Además puede conectar con fuentes externas **opcionales** que el usuario activa con sus credenciales para enriquecer metadatos, portadas o valoración económica.

**GameplayStores** está desactivado por defecto (nivel C — sin confirmación de uso por parte de la tienda).

## Orden al elegir la URL de portada

La función `resolvePreferredCoverUrl` (`services/coverPreferenceResolver.ts`) prueba en este orden (configurable en Ajustes → Catálogo):

1. **CoverLens (integrado)** — catálogo propio en `covers.cholloweb.es`; portadas curadas PAL/ESP. Sin clave.
2. **SteamGridDB** — grids de alta calidad; requiere API key del usuario.
3. **ScreenScraper** — portadas y cajas regionales; usuario/contraseña del usuario.
4. **IGDB** — URL de portada que ya venga del resultado de metadatos (si existe).

## Metadatos (título, ficha, estados)

`resolveMetadata` (`services/metadataResolver.ts`) encadena fuentes según **Ajustes → Catálogo → Orden de fuentes (metadatos)**. Por defecto: **CoverLens → ScreenScraper → IGDB**. La primera fuente con datos válidos prioriza título y plataforma; las siguientes solo rellenan campos vacíos.

- **CoverLens (integrado):** búsqueda por título+plataforma en `/api/browse.php`; sin clave.
- **ScreenScraper:** si está activo y hay usuario/contraseña.
- **IGDB:** si está activo y hay credenciales Twitch.

Tras fusionar metadatos, la **portada** del listado sigue la cadena de portadas (puede cambiar la URL que viniera del metadato).

## Valor económico

Por defecto: **CoverLens (integrado) → PriceCharting → eBay**. GameplayStores desactivado.

## Reconocimiento de barcode (EAN)

- **GameUPC:** fallback opcional con API key del usuario (Ajustes → APIs).
- **GameplayStores:** desactivado en `barcodeToTitle.ts` (código comentado, posible reactivación futura).

## Estado resolved / partial

`deriveMetadataStatusFromGameFields` (`services/utils/metadataCompleteness.ts`) define la regla única en catálogo:

- **resolved:** portada con URL `http(s)` + título válido + plataforma conocida + al menos uno entre: año, género, desarrollador, publisher, descripción (>24 caracteres) o versión/edición no vacía.
- **partial:** falta portada, plataforma/título inválidos o ningún dato de ficha extra.

## Dónde se usa en la UI

- Ficha: **Completar metadatos** y **Actualizar portada**. Etiquetas «Ficha · …» / «Portada · …» muestran la fuente (CoverLens, SteamGridDB, etc.).
- Ajustes → Catálogo: orden y activación de fuentes; GameplayStores no aparece en la UI.
- Ajustes → Créditos y legal: atribuciones IGDB, SteamGridDB, ScreenScraper, GameUPC.

## Créditos de terceros

Ver `constants/thirdPartyAttribution.ts` y [API_TERMS_COMPLIANCE.md](API_TERMS_COMPLIANCE.md).

## Archivos útiles para mantenimiento

| Área | Archivo |
|------|---------|
| CoverLens integrado | `services/providers/chollwebVpsProvider.ts` |
| Orden de portadas | `services/coverPreferenceResolver.ts` |
| Orden de metadatos | `services/metadataSourcePreferences.ts` |
| Orden de valor | `services/valueSourcePreferences.ts` |
| Barcode / GameUPC | `services/utils/barcodeToTitle.ts` |
| Flujo metadatos | `services/metadataResolver.ts` |
| SteamGridDB | `services/providers/steamGridDbProvider.ts` |
| ScreenScraper | `services/providers/screenScraperProvider.ts` |
| GameplayStores (desactivado) | `services/providers/gameplayStores*.ts` |
| Texto de esta doc en la app | `constants/documentation/portadasYFuentesDoc.ts` |
| Pantalla in-app | `app/documentacion-fuentes.tsx` |
