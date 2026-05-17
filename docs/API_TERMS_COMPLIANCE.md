# Cumplimiento y aclaraciones — APIs de terceros (CoverLens)

Registro de solicitudes enviadas a proveedores antes de publicar en tiendas, y respuestas oficiales.
La app es **gratuita y open source**; las credenciales las aporta cada usuario en su dispositivo.

**Última actualización:** 2026-05-17

---

## Resumen

| Proveedor | Uso en CoverLens | Estado legal / ToS | Atribución obligatoria |
|-----------|------------------|----------------------|-------------------------|
| **ScreenScraper** | Metadatos y portadas (opcional; credenciales usuario) | **Confirmado OK** (2026-05-11) | No |
| IGDB (Twitch) | Metadatos y portadas | Pendiente / revisar ToS público | — |
| SteamGridDB | Portadas | Pendiente / revisar ToS público | — |
| GameplayStores | Metadatos/portadas vía buscador web JSON | Sin API oficial; uso de listado público | — |
| PriceCharting | Precio guía (opcional, API Pro usuario) | Cuenta Pro del usuario | — |
| eBay Developers | Precio orientativo (opcional) | App registrada por usuario | — |

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
- No hace falta añadir crédito obligatorio en UI; se puede mencionar ScreenScraper de forma informativa en documentación o Ajustes si se desea.
- **Condición clave:** mantener CoverLens **gratis** en tiendas (sin versión de pago, suscripciones in-app ni modelo que deje de ser “free” según su criterio).
- Pendiente **técnico** (no legal): registrar **Dev ID / Dev password** de aplicación en [devzone](https://www.screenscraper.fr/devzone.php) para cuotas y `softname` — ver `ROADMAP.md`.

### Texto de la solicitud (referencia)

> Clarification request for ScreenScraper API/media usage in free mobile app — CoverLens, free OSS videogame cataloging; uso en tiendas, caché local, atribución, restricciones iOS/Android.

---

## Otros proveedores

### IGDB (Twitch Developer)

- Uso bajo OAuth/app del usuario en `dev.twitch.tv`.
- Revisar [Twitch Developer Agreement](https://dev.twitch.tv/docs/legal) e [IGDB API](https://api-docs.igdb.com/) antes de publicar.
- Sin respuesta escrita del equipo en este registro.

### SteamGridDB

- API key del usuario; revisar términos en [steamgriddb.com](https://www.steamgriddb.com).
- Sin respuesta escrita del equipo en este registro.

### GameplayStores

- Sin API documentada; peticiones al buscador público (mismo patrón que navegador). Valorar contacto con la tienda si se quiere confirmación explícita.

### PriceCharting / eBay

- Opcionales; cada usuario usa su token/app registrada. Cumplir ToS de cada servicio al usar sus claves.

---

## Checklist pre-publicación (legal / producto)

- [x] ScreenScraper: uso en app gratuita + caché local confirmado por el equipo.
- [ ] Mantener app **gratuita** en Apple App Store y Google Play (requisito ScreenScraper).
- [ ] Revisar o solicitar aclaración IGDB / SteamGridDB si se quiere el mismo nivel de confirmación por escrito.
- [ ] Política de privacidad publicada (ver commits `docs/PRIVACY_POLICY_ES.md` en remoto si aplica).
- [ ] Ficha de tienda: declarar consulta a APIs de terceros (`PRIVACY_APP_STORE_NOTES.md`).
