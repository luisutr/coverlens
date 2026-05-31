# Cumplimiento y aclaraciones — APIs de terceros (CoverLens)

Registro de solicitudes enviadas a proveedores antes de publicar en tiendas, y respuestas oficiales.
La app se publicará **gratuita** en tiendas. Integración de terceros según [FUENTES_TERCEROS_DECISION.md](FUENTES_TERCEROS_DECISION.md): confirmación explícita (ScreenScraper, SteamGridDB) o cumplimiento de ToS público (IGDB, GameUPC, PriceCharting, eBay); excluido GameplayStores.

**Fuente bruta (emails, ToS, notas):** [Permisos_servicios_terceros.txt](Permisos_servicios_terceros.txt)

**Decisión de integración (qué terceros usar):** [FUENTES_TERCEROS_DECISION.md](FUENTES_TERCEROS_DECISION.md)

**Política de privacidad pública:** [PRIVACY_POLICY_ES.md](PRIVACY_POLICY_ES.md)

**Última actualización:** 2026-05-31

---

## Resumen

| Proveedor | Uso en CoverLens | Estado legal / ToS | Atribución obligatoria |
|-----------|------------------|----------------------|-------------------------|
| **CoverLens VPS** | Metadatos, portadas y valor (`covers.cholloweb.es`) | Infraestructura propia | No aplica |
| **ScreenScraper** | Metadatos y portadas (opcional; credenciales usuario) | **Confirmado OK** (2026-05-11) | No |
| **SteamGridDB** | Portadas (opcional; API key usuario) | **Confirmado OK** (2026-04-30, Jozen) | Sí (en app) |
| **IGDB (Twitch)** | Metadatos y portadas/cabecera (opcional) | ToS público; app gratuita — ver [FUENTES_TERCEROS_DECISION.md](FUENTES_TERCEROS_DECISION.md) | Sí: *"Data freely provided by IGDB.com"* |
| **GameplayStores** | Metadatos, portadas, precio tienda vía buscador JSON | Sin API oficial; sin confirmación — **excluido** | — |
| **GameUPC** | Fallback barcode → título | ToS público; clave opcional del usuario | Sí (recomendada) |
| **PriceCharting** | Precio guía (opcional, API Pro usuario) | Token Pro del usuario; 1 req/s | — |
| **eBay Developers** | Precio orientativo (opcional) | App registrada por usuario | — |

---

## CoverLens VPS — infraestructura propia

**URL:** https://covers.cholloweb.es/

- Catálogo web en `/catalogo`; API para la app: `/api/browse.php`, `/games/{platform}/{slug}.json`, `/games/platforms.json`.
- Portadas en `/covers/{platform}/{slug}.*`.
- Fuente por defecto en preferencias de metadatos, portadas y valor (Ajustes → Catálogo).
- Sin ToS de tercero; datos agregados upstream (p. ej. RAWG, IGDB en fichas del VPS). La app consume el VPS, no esas fuentes directamente.
- Buen uso: evitar lotes masivos sin pausa (la app ya incluye delay en «Descargar portadas en lote»).

---

## ScreenScraper — **respondido**

**Contacto:** foro / Discord ScreenScraper (`#api` o canal de soporte).  
**Solicitud enviada:** 2026-05-10 (Luis Utrilla).  
**Respuesta:** 2026-05-11 — **MarbleMad** (equipo ScreenScraper).

### Preguntas y respuestas

| Pregunta | Respuesta oficial |
|----------|-------------------|
| ¿Uso de datos/medios de la API en app pública y gratuita? | **Sí** |
| ¿Caché local de miniaturas permitida? | **Sí** |
| ¿Texto y ubicación de atribución obligatorios? | **Nada es obligatorio** |
| ¿Restricciones App Store / Google Play? | **Ninguna**, siempre que la app **siga siendo gratuita** |

### Implicaciones para CoverLens

- La integración actual (opcional en Ajustes, credenciales del usuario, cadena de metadatos/portadas) es compatible con lo confirmado.
- `services/storage/coverThumbCache.ts` (miniaturas en disco) está **explícitamente permitido**.
- **Condición clave:** mantener CoverLens **gratis** en tiendas.
- Pendiente **técnico** (no legal): registrar **Dev ID / Dev password** en [devzone](https://www.screenscraper.fr/devzone.php) — ver `ROADMAP.md`.

---

## SteamGridDB — **respondido**

**Contacto:** email a equipo SteamGridDB.  
**Respuesta:** 2026-04-30 — **Jozen Martinez**.

### Condiciones confirmadas

- Atribución en algún lugar de la app (enlace al asset concreto recomendado pero no obligatorio).
- Si la app llama a la API directamente: **cada usuario debe usar su propia API key** (CoverLens ya lo hace).
- Alternativa no usada: proxy con clave única + caché JSON (no imágenes) de al menos unas horas.

### Implicaciones para CoverLens

- Modelo actual (clave del usuario en Ajustes) cumple el requisito principal.
- Pendiente producto: añadir mención/enlace a SteamGridDB en UI o documentación. **Hecho** (Ajustes → Créditos y legal; ficha contextual).

---

## IGDB (Twitch Developer)

- Uso bajo OAuth/app del usuario en `dev.twitch.tv`.
- Atribución visible: *"Data freely provided by IGDB.com"*.
- Límite: 4 req/s, máx. 8 simultáneas; caché local permitido.
- ToS desaconseja secretos embebidos en app móvil; CoverLens usa credenciales del usuario en SecureStore.
- Uso comercial (anuncios, IAP, suscripción) requiere licencia con partner@igdb.com.
- Arquitectura recomendada por IGDB: proxy backend; CoverLens conecta directamente con claves del usuario (aceptable si cada usuario usa las suyas).
- Ver [Twitch Developer Agreement](https://dev.twitch.tv/docs/legal) e [IGDB API](https://api-docs.igdb.com/).

---

## GameplayStores

- Sin API documentada; peticiones al buscador JSON público (`/busqueda`) y parseo HTML de ficha de producto.
- Uso: barcode, metadatos, portadas, precio tienda EUR.
- **Contacto enviado 2 veces por email, sin respuesta.** Decisión: mantener como fuente **opcional y desactivable** en Ajustes; priorizar CoverLens VPS. Riesgo documentado; no bloquea publicación si la app sigue gratuita y el usuario puede desactivar GPS.
- Mitigación en producto: VPS primero en preferencias; GPS desactivable.
- Código: `gameplayStoresCoverProvider.ts`, `gameplayStoresMetadataProvider.ts`, `barcodeToTitle.ts`.
- No insistir salvo nuevo canal de contacto (formulario web, redes). Borrador tercer intento opcional en notas brutas si se desea.

---

## GameUPC

- API REST en `api.gameupc.com/upc/{ean}`; fallback de barcode cuando GameplayStores no resuelve el EAN.
- **Clave API opcional del usuario** en Ajustes (`gameUpcApiKey`); sin clave no se llama a la API (eliminada clave de test hardcodeada).
- Buen uso: no saturar el servidor; no extraer masivamente ni revender datos.
- Atribución en UI (Ajustes → Créditos y legal; ficha si `metadataSource === gameupc`).

---

## PriceCharting

- Requiere suscripción Pro activa y token del usuario.
- Límite: 1 solicitud por segundo.
- Uso permitido en app; no revender/republicar datos masivamente.
- Caché local de precios recomendado para no consultar en cada apertura de ficha.

---

## eBay Developers

- Browse API con OAuth client credentials; credenciales de app registrada por el usuario.
- Prohibido usar datos para entrenar IA generativa.
- Solo precio orientativo (mediana de anuncios activos); no perfil de otros vendedores.
- Cumplir [API License Agreement](https://developer.ebay.com/).

---

## Checklist pre-publicación (legal / producto)

- [x] ScreenScraper: uso en app gratuita + caché local confirmado por el equipo.
- [x] SteamGridDB: confirmado por escrito (Jozen, 2026-04-30); clave por usuario OK.
- [x] Atribución SteamGridDB en UI (Ajustes → Créditos y legal; ficha contextual).
- [x] Atribución IGDB visible (Ajustes + ficha cuando aplica).
- [x] Atribución GameUPC en UI (Ajustes + ficha si fuente gameupc).
- [x] Política de privacidad en `docs/PRIVACY_POLICY_ES.md`.
- [x] HTML generado en `docs/privacidad/index.html` (`node scripts/build-privacy-html.mjs`).
- [x] **Desplegado** HTML al VPS → `https://covers.cholloweb.es/privacidad` (301 → `/privacidad/`, 200, 6845 bytes; verificado 2026-05-31).
- [ ] Mantener app **gratuita** en Apple App Store y Google Play (requisito ScreenScraper).
- [x] Clave GameUPC de test eliminada; clave opcional del usuario.
- [x] GameplayStores: contacto x2 sin respuesta documentado; **desactivado** en app (nivel C).
- [x] Ficha de tienda alineada con `PRIVACY_APP_STORE_NOTES.md`.
