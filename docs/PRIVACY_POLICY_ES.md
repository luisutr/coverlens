# Política de privacidad de CoverLens

Última actualización: 2026-05-31

## 1. Responsable

Responsable del proyecto: Luis Utrilla del Castillo.

CoverLens es una app de catalogación de videojuegos.

Contacto de privacidad y soporte: luisutr+coverlens@gmail.com.

## 2. Qué datos trata la app

CoverLens guarda principalmente datos de catálogo introducidos por el usuario:

- títulos de juegos,
- plataforma,
- código de barras (si se usa escáner),
- metadatos asociados (género, año, descripción, etc.),
- URLs de portada/cabecera cuando se resuelven desde proveedores configurados,
- valor estimado del juego (si el usuario activa fuentes de valor).

También puede almacenar credenciales de APIs de terceros si el usuario las configura voluntariamente en Ajustes.

La app **no crea cuentas de usuario** ni recopila nombre, email ni identificadores personales propios del servicio.

## 3. Origen de los datos

Los datos pueden venir de:

- entrada manual del usuario,
- lectura de código de barras,
- OCR local de portadas (procesamiento en el dispositivo),
- importación de archivos (JSON/CSV),
- **CoverLens (integrado)** (`https://covers.cholloweb.es/`) — catálogo del desarrollador; fuente por defecto para metadatos, portadas y valor de mercado,
- proveedores externos **opcionales** activados por el usuario: IGDB, ScreenScraper, SteamGridDB, GameUPC, PriceCharting, eBay.

GameplayStores **no está integrado** en la versión publicada (sin confirmación de uso por parte de la tienda).

## 4. Para qué se usan

Los datos se usan para:

- crear y mantener el catálogo personal del usuario,
- completar metadatos de fichas,
- mostrar imágenes de portada/cabecera cuando existan,
- calcular valor estimado del catálogo si el usuario activa fuentes de valor.

## 5. Base legal

- Ejecución del servicio solicitado por el usuario (funcionalidad de catalogación).
- Consentimiento del usuario para configurar credenciales externas y activar integraciones opcionales.

## 6. Almacenamiento y seguridad

- La app guarda el catálogo en almacenamiento local del dispositivo (SQLite).
- Las credenciales sensibles se guardan mediante almacenamiento seguro del sistema (`expo-secure-store`) cuando está disponible.
- Las miniaturas de portadas pueden guardarse en caché local del dispositivo para mejorar el rendimiento.
- No se vende información personal de usuarios.

## 7. Comunicaciones con terceros y servidor del desarrollador

### Servidor CoverLens VPS

La app consulta un servidor del desarrollador en `https://covers.cholloweb.es/` para buscar metadatos, portadas y valores de mercado del catálogo. Las peticiones incluyen términos de búsqueda (título, plataforma) y, en algunos casos, identificadores de juego en el catálogo del VPS. **No se envían credenciales del usuario ni datos de identificación personal** al VPS. No hay registro ni inicio de sesión en el VPS.

Endpoints principales: `/api/browse.php`, `/games/{platform}/{slug}.json`.

### Proveedores externos opcionales

Si el usuario activa fuentes externas o configura credenciales, la app realiza solicitudes de red a esos servicios. Cada proveedor tiene sus propios términos y políticas de privacidad:

- CoverLens VPS: https://covers.cholloweb.es/
- GameplayStores: https://www.gameplaystores.es/
- IGDB/Twitch: https://api-docs.igdb.com/ y https://www.twitch.tv/p/legal/developer-agreement/
- SteamGridDB: https://www.steamgriddb.com/terms
- ScreenScraper: https://www.screenscraper.fr/
- GameUPC: https://www.gameupc.com/
- PriceCharting: https://www.pricecharting.com/
- eBay Developers: https://developer.ebay.com/

El usuario puede activar o desactivar cada fuente en Ajustes → Catálogo.

## 8. Menores de edad

La app no está orientada específicamente a menores de 13 años.

## 9. Derechos de las personas usuarias

El usuario puede:

- borrar su catálogo local desde la app,
- limpiar credenciales guardadas desde Ajustes,
- desactivar fuentes externas en Ajustes,
- solicitar información o eliminación adicional escribiendo al contacto de soporte.

## 10. Cambios en esta política

Esta política puede actualizarse para reflejar cambios funcionales, legales o de proveedores. La fecha de «Última actualización» se modificará en cada cambio relevante.

Cambio reciente (2026-05-31): integración del catálogo CoverLens VPS como fuente principal de metadatos, portadas y valor de mercado.

Publicada en: https://covers.cholloweb.es/privacidad
