# Guía de usuario — CoverLens

> Mantener alineado con `constants/documentation/userGuideDoc.ts` (la pantalla **Ajustes → Cómo usar CoverLens** lee ese módulo).
>
> Documentación técnica de fuentes: [PORTADAS_Y_FUENTES.md](./PORTADAS_Y_FUENTES.md) · Privacidad: [PRIVACY_POLICY_ES.md](./PRIVACY_POLICY_ES.md)

CoverLens es un catálogo personal de videojuegos físicos en el móvil: portadas, metadatos y valoración económica **opcional**. Tu colección se guarda **en el dispositivo**.

---

## Qué incluye la app

| Función | Descripción |
|---------|-------------|
| **Catálogo local** | Lista con portadas, búsqueda, filtros y ordenación |
| **Servicio integrado CoverLens** | Metadatos y portadas desde `covers.cholloweb.es` — **sin clave** |
| **Escáner** | Código de barras, alta en lote con foto + Gemini, o entrada manual |
| **Ficha de juego** | Ver/editar datos, actualizar metadatos, portada y valor |
| **Ajustes** | Orden de fuentes, credenciales opcionales, import/export, herramientas de catálogo |

---

## Pestañas de la app

### Colección

- **Buscar** por título.
- **Filtrar** por plataforma, favoritos o «solo disco».
- **Ordenar** por fecha de alta, título, plataforma, año, puntuación o valor.
- **Tocar** una tarjeta → ficha del juego.

### Escáner

#### Barcode

1. Concede permiso de cámara.
2. Enfoca el EAN/UPC del juego.
3. Si se reconoce, CoverLens crea la ficha con metadatos y portada según tus fuentes activas.
4. Si no hay match, puedes guardar con título/plataforma manual y completar después.

#### Lote (IA)

1. **Foto** de los lomos alineados (ver pictograma en pantalla).
2. **Copiar prompt** → abrir **Gemini** → adjuntar foto y pegar prompt.
3. **Pegar el JSON** que devuelva Gemini en CoverLens → revisar lista → importar.
4. Opcional: resolver metadatos y portadas en lote desde Ajustes.

La imagen se analiza en Gemini, no en los servidores de CoverLens.

#### Manual

Escribe título y plataforma (ej. `God of War PS4`). La app busca en las fuentes configuradas.

### Ajustes

- **Orden de fuentes (portadas / metadatos / valor)** — activar, desactivar y reordenar.
- **APIs de metadatos** — IGDB, SteamGridDB, ScreenScraper, GameUPC, PriceCharting, eBay (opcional).
- **Catálogo** — exportar/importar JSON, reintentar metadatos, portadas en lote, limpiar duplicados.
- **Créditos y legal** — atribuciones y enlace a privacidad.
- **Guías** — repetir onboarding o guía del escáner.

---

## Ficha del juego

| Acción | Qué hace |
|--------|----------|
| **Completar metadatos** | Cadena de metadatos + portadas (Ajustes) |
| **Actualizar portada** | Solo imagen |
| **Actualizar valor** | Cadena de fuentes de precio |
| **Editar (lápiz)** | Cambiar campos a mano |
| **Favorito / Solo disco** | Marcas en la colección |

**Estados:** `pending`, `partial`, `resolved` indican cuánto está completa la ficha (portada + datos de texto). No son errores graves.

---

## Servicios integrados vs terceros

### Sin configurar nada

- **CoverLens (integrado)** — búsqueda por título, plataforma y barcode en el catálogo VPS; portadas y valor cuando existan en el catálogo.

### Opcionales (tus credenciales en Ajustes)

| Servicio | Uso típico |
|----------|------------|
| **IGDB** (Twitch) | Año, género, descripción, nota |
| **SteamGridDB** | Portadas de alta calidad |
| **ScreenScraper** | Metadatos y cajas regionales |
| **GameUPC** | Barcode → título (fallback) |
| **PriceCharting** | Precio guía USD (Pro) |
| **eBay** | Mediana de anuncios activos (orientativo) |

**GameplayStores** está desactivado por defecto (sin confirmación de uso por parte de la tienda).

Orden y activación: **Ajustes → Catálogo** (tres bloques: portadas, metadatos, valor).

---

## Valor económico

Los importes mostrados son **estimaciones orientativas**. Pueden no reflejar tu edición, región o estado del juego. **No son una tasación oficial.** Contrastar con otras fuentes antes de comprar, vender o valorar tu colección.

En la app verás el aviso en la **ficha del juego** (bloque «Valor estimado»), en **Ajustes → Cotización**, en el **listado** (prefijo «est.» en tarjetas con precio) y en la nota al pie del catálogo cuando haya valores guardados.

---

## Importar y exportar

- **Exportar catálogo (JSON)** — copia de seguridad o pasar a otro móvil.
- **Importar** — JSON de CoverLens o CSV de Playnite (extensión «Library Exporter Advanced»). Tras CSV, conviene «Reintentar metadatos» y «Descargar portadas en lote».

Ayuda detallada en Ajustes → sección colapsable «Ayuda: exportar, importar y Playnite».

---

## Privacidad

- Catálogo en SQLite local.
- Peticiones al VPS CoverLens: búsqueda (título, plataforma, barcode); sin cuenta ni credenciales personales.
- APIs de terceros: solo si las configuras; van con tus claves desde el móvil.

URL pública: https://covers.cholloweb.es/privacidad

---

## Dónde leer esto en la app

**Ajustes → Cómo usar CoverLens**

Para detalle técnico de fuentes: **Ajustes → Documentación: portadas y fuentes**.

Para testers y APIs paso a paso: [GUIA_TESTERS_CREDENCIALES.md](./GUIA_TESTERS_CREDENCIALES.md).
