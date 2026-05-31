# Decisión de fuentes de terceros — CoverLens

Documento de trabajo para fijar **qué servicios externos** (distintos del servidor propio) integraremos en la app para **metadatos**, **imágenes/portadas** y **valor económico**.

Este documento es la base para los cambios de producto y código que vengan después. No modifica la app por sí solo.

**Relacionado:** [API_TERMS_COMPLIANCE.md](API_TERMS_COMPLIANCE.md) · [Permisos_servicios_terceros.txt](Permisos_servicios_terceros.txt) · [PRIVACY_POLICY_ES.md](PRIVACY_POLICY_ES.md)

**Última actualización:** 2026-05-31

---

## Decisión del producto (fijada)

| Decisión | Detalle |
|----------|---------|
| **Modelo de publicación** | App **gratuita** en Apple App Store y Google Play (sin precio, suscripción ni paywall). Cumple el requisito confirmado por ScreenScraper y el uso no comercial de IGDB. |
| **Criterio de integración** | Integrar terceros que cumplan **al menos uno** de estos supuestos: (1) confirmación explícita por escrito (nivel A), o (2) ToS / programa de desarrollador público cuyas condiciones CoverLens cumple en app gratuita (nivel B). |
| **Fuente principal** | **CoverLens VPS** (`covers.cholloweb.es`) — infraestructura propia; primera en metadatos, portadas y valor. |
| **Terceros integrados** | **A:** ScreenScraper, SteamGridDB. **B (ToS cumplido):** IGDB, GameUPC, PriceCharting, eBay. Todos opcionales; credenciales del usuario cuando aplique. |
| **Excluido** | **GameplayStores** (nivel C): sin confirmación, sin API oficial, contacto x2 sin respuesta. |

---

## 1. Alcance

### Incluido en este documento

Servicios de terceros que la app puede consultar **directamente** desde el dispositivo (con o sin credenciales del usuario).

| Ámbito | Qué cubre en CoverLens |
|--------|-------------------------|
| **Metadatos** | Título, plataforma, género, desarrollador, descripción, barcode → título, etc. |
| **Imágenes** | Portada, cabecera/hero, miniaturas en caché local |
| **Valor económico** | Precio orientativo, precio en tienda, mediana de mercado |

### Fuera de alcance (referencia)

| Servicio | Motivo |
|----------|--------|
| **CoverLens VPS** (`covers.cholloweb.es`) | Infraestructura propia; fuente principal. No es tercero. |
| Fuentes upstream del VPS (RAWG, IGDB en fichas web, etc.) | La app no las llama; las consume indirectamente vía VPS si el catálogo las agrega. |

---

## 2. Criterio de clasificación

| Nivel | Definición | Decisión en CoverLens |
|-------|------------|------------------------|
| **A — Confirmación explícita** | Respuesta escrita del proveedor que autoriza el caso de uso. | **Integrar** — opcional; credenciales del usuario. |
| **B — ToS / programa público** | API o programa con condiciones publicadas; sin carta al proyecto, pero el uso previsto **cumple** esas condiciones. | **Integrar** — opcional; credenciales del usuario; atribución y límites según ToS. |
| **C — Sin base de uso** | Contacto sin respuesta, endpoints no destinados a integradores, o incumplimiento claro de condiciones. | **No integrar**. |

Condiciones transversales:

- App **gratuita** en tiendas (compromiso de producto + requisito ScreenScraper + uso no comercial IGDB).
- Credenciales del usuario en SecureStore; nada embebido en el binario.
- Atribución donde ToS o confirmación lo exijan (IGDB, SteamGridDB, GameUPC).
- Caché local y rate limits respetados en todos los proveedores.

---

## 3. Inventario y clasificación

| Proveedor | Metadatos | Imágenes | Valor | Nivel | Decisión |
|-----------|:---------:|:--------:|:-----:|-------|----------|
| **CoverLens VPS** | ✓ | ✓ | ✓ | — (propio) | **Usar** — prioridad 1 |
| **ScreenScraper** | ✓ | ✓ | — | **A** | **Usar** — opcional |
| **SteamGridDB** | — | ✓ | — | **A** | **Usar** — opcional |
| **IGDB (Twitch)** | ✓ | ✓ | — | **B** | **Usar** — opcional; ToS cumplido |
| **GameUPC** | ✓ (barcode) | — | — | **B** | **Usar** — opcional; ToS cumplido |
| **PriceCharting** | — | — | ✓ | **B** | **Usar** — opcional; ToS cumplido |
| **eBay Developers** | — | — | ✓ | **B** | **Usar** — opcional; ToS cumplido |
| **GameplayStores** | ✓ | ✓ | ✓ | **C** | **No usar** |

Código de referencia: `services/metadataSourcePreferences.ts`, `coverSourcePreferences.ts`, `valueSourcePreferences.ts`, `barcodeToTitle.ts`.

---

## 4. Fuentes aprobadas — nivel A (confirmación explícita)

### ScreenScraper — confirmado (MarbleMad, 2026-05-11)

| Ámbito | Integración |
|--------|-------------|
| Metadatos | Sí — usuario/contraseña del usuario |
| Imágenes | Sí — portadas vía API |
| Valor | No |

**Condiciones:** app pública **gratuita**; caché local OK; atribución no obligatoria.

### SteamGridDB — confirmado (Jozen Martinez, 2026-04-30)

| Ámbito | Integración |
|--------|-------------|
| Metadatos | No |
| Imágenes | Sí — API key del usuario |
| Valor | No |

**Condiciones:** atribución en la app; cada usuario con su propia API key.

---

## 5. Fuentes aprobadas — nivel B (ToS cumplido, sin carta)

Sin confirmación escrita al proyecto, pero CoverLens cumple las políticas publicadas con app gratuita y credenciales del usuario.

| Proveedor | Ámbito | Cumplimiento en CoverLens |
|-----------|--------|---------------------------|
| **IGDB** | Metadatos + cabecera/portada | App gratuita (no comercial); atribución *"Data freely provided by IGDB.com"*; credenciales del usuario; límite 4 req/s; caché local |
| **GameUPC** | Barcode → título | Clave opcional del usuario; buen uso; atribución en UI; sin clave no se llama a la API |
| **PriceCharting** | Valor (USD) | Token Pro del usuario; 1 req/s; no revender datos; caché local recomendada |
| **eBay** | Valor (mediana anuncios) | App OAuth del usuario; precio orientativo; sin entrenar IA; sin datos de otros vendedores |

**Nota:** si la app dejara de ser gratuita o incorporara anuncios/IAP, habría que revisar ScreenScraper (confirmación exige app gratis) e IGDB (requeriría licencia comercial con `partner@igdb.com`).

---

## 6. Fuente descartada — nivel C

### GameplayStores (`gameplaystores.es`)

**Estado:** contacto enviado **2 veces por email**, **sin respuesta**. No hay API documentada; la app usa buscador JSON público y parseo HTML de ficha.

**Decisión:** **no integrar** en metadatos, portadas, valor ni barcode. No cumple el criterio A ni B (sin ToS de integrador ni confirmación).

**Mitigación:** CoverLens VPS + resto de fuentes aprobadas cubren los tres ámbitos.

**Acción en código (pendiente):** desactivar `gameplaystores` por defecto; retirar GPS de `barcodeToTitle.ts`.

---

## 7. CoverLens VPS (infraestructura propia)

- Metadatos, portadas y valor de mercado EUR.
- Sin clave; primera en orden de preferencias.
- API: `/api/browse.php`, `/games/{platform}/{slug}.json`, portadas en `/covers/...`.

---

## 8. Configuración objetivo (tras cambios de código)

### Metadatos

| Fuente | Activo | Prioridad |
|--------|:------:|-----------|
| CoverLens VPS | ✓ | 1 |
| ScreenScraper | ✓ (si hay credenciales) | 2 |
| IGDB | ✓ (si hay credenciales) | 3 |
| GameplayStores | ✗ | — |

### Imágenes / portadas

| Fuente | Activo | Prioridad |
|--------|:------:|-----------|
| CoverLens VPS | ✓ | 1 |
| SteamGridDB | ✓ (si hay API key) | 2 |
| ScreenScraper | ✓ (si hay credenciales) | 3 |
| IGDB | ✓ (si hay credenciales) | 4 |
| GameplayStores | ✗ | — |

### Valor económico

| Fuente | Activo | Prioridad |
|--------|:------:|-----------|
| CoverLens VPS | ✓ | 1 |
| PriceCharting | ✓ (si hay token Pro) | 2 |
| eBay | ✓ (si hay credenciales app) | 3 |
| GameplayStores | ✗ | — |

### Barcode → título

| Paso | Fuente | Decisión |
|------|--------|----------|
| 1 | CoverLens VPS | Usar cuando la API lo exponga |
| 2 | GameUPC | ✓ — fallback con clave del usuario |
| 3 | GameplayStores | ✗ — eliminar de la cadena |

---

## 9. Estado de implementación (2026-05-31)

| Preferencia | Estado |
|-------------|--------|
| `metadataSourcePreferences` | **VPS + SS + IGDB** activos; GPS **off** |
| `coverSourcePreferences` | **VPS + SGDB + SS + IGDB** activos; GPS **off** |
| `valueSourcePreferences` | **VPS + PC + eBay** activos; GPS **off** |
| `barcodeToTitle` | **GameUPC** (con clave); GPS comentado |
| Ajustes / onboarding | GPS oculto en listas; CoverLens como fuente integrada |
| Atribuciones UI | IGDB, SteamGridDB, ScreenScraper, GameUPC en Créditos y legal |

---

## 10. Próximos pasos (opcional)

1. Exponer resolución de EAN en el catálogo CoverLens (barcode sin depender de GameUPC).
2. Solicitar confirmación escrita a proveedores B para promoverlos a nivel A.
3. Eliminar código muerto de GameplayStores si no se reactiva en 12 meses.

---

## 11. Registro de cambios

| Fecha | Cambio |
|-------|--------|
| 2026-05-31 | Documento inicial: criterios A/B/C. |
| 2026-05-31 | Decisión: app gratuita; solo VPS + ScreenScraper + SteamGridDB. |
| 2026-05-31 | **Revisión:** incluir también nivel B (IGDB, GameUPC, PriceCharting, eBay) al cumplir ToS; excluir solo GameplayStores (C). |
| 2026-05-31 | **Implementado:** branding CoverLens en UI, GPS desactivado, onboarding/docs/atribuciones actualizados. |
