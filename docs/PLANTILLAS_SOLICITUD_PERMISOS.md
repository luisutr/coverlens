# Plantillas para solicitar permisos a proveedores

Usa estas plantillas por email o formulario web. Sustituye los campos entre `<>`.

---

## 1) GameplayStores (prioridad alta)

Asunto: Solicitud de autorizacion para uso de datos e imagenes en app gratuita de catalogacion

Hola equipo de GameplayStores,

Soy <NOMBRE>, desarrollador de la app CoverLens (proyecto personal, gratuito y de codigo abierto) para catalogar colecciones de videojuegos.

Queremos solicitar autorizacion expresa para usar informacion publica de su web en la app, concretamente:

- titulo/plataforma de juegos en busquedas,
- URL de imagen de portada de producto,
- enlace a ficha de producto para que el usuario pueda visitar su tienda.

Uso previsto:

- app gratuita (sin compras in-app),
- sin reventa de sus datos,
- mostrando atribucion y enlace a gameplaystores.es,
- posibilidad de desactivar su fuente inmediatamente si ustedes lo solicitan.

Nos gustaria confirmar por escrito:

1. Si autorizan este uso en una app movil publica (App Store/Google Play).
2. Si permiten cache local de miniaturas para rendimiento.
3. Si requieren texto de atribucion especifico, logo o condiciones adicionales.

Gracias por vuestro tiempo. Quedamos atentos para adaptar todo a vuestras condiciones.

Un saludo,
<NOMBRE>
<EMAIL>
<URL REPO O WEB>

---

## 2) SteamGridDB

Asunto: Permission request for public mobile app usage of SteamGridDB assets

Hello SteamGridDB team,

I am <NAME>, developer of CoverLens, a free and open-source mobile app for personal game collection cataloging.

I would like to request written permission/clarification to use SteamGridDB API/image assets in a publicly distributed mobile app (Apple App Store and Google Play), specifically:

- fetching cover images for user-selected games,
- displaying attribution inside the app,
- optional local thumbnail caching for performance.

Project context:

- free app, no subscription/paywall,
- open-source codebase,
- willing to comply with any attribution or technical requirements you specify.

Could you confirm whether this use is allowed and under which conditions?

Best regards,
<NAME>
<EMAIL>
<REPO URL>

---

## 3) ScreenScraper

Asunto: Clarification request for ScreenScraper API/media usage in free mobile app

Bonjour / Hello ScreenScraper team,

I am <NAME>, developer of CoverLens, a free and open-source app for personal videogame cataloging.

Before publishing on app stores, I want to ensure compliance with ScreenScraper terms and media licensing.

Could you please confirm:

1. Whether CoverLens may use ScreenScraper API data/media in a public free app.
2. Whether local thumbnail caching is permitted.
3. Required attribution text and placement.
4. Any specific restrictions for distribution on Apple App Store / Google Play.

We will follow your requirements and can disable integration if needed.

Thank you for your guidance.

<NAME>
<EMAIL>
<REPO URL>

---

## 4) GameUPC

Asunto: API usage permission for free/open-source mobile app

Hello GameUPC team,

I am <NAME>, developer of CoverLens, a free and open-source mobile app for game cataloging.

We use barcode lookup as a fallback and would like to confirm permitted usage for:

- public app distribution (App Store / Google Play),
- non-commercial/free app context,
- local caching of minimal lookup results for app performance.

Could you share applicable API terms/licensing and whether this usage is allowed?

Kind regards,
<NAME>
<EMAIL>
<REPO URL>

---

## 5) IGDB (Twitch) — por qué no hay plantilla de email aquí

**IGDB no se incluye como "solicitud de permiso por correo"** porque el uso oficial del API no pasa por un email tipo GameplayStores/ScreenScraper: el acceso es **registro de aplicación en [Twitch Developer Console](https://dev.twitch.tv/console/apps/create)** y aceptación del **[Twitch Developer Services Agreement](https://www.twitch.tv/p/legal/developer-agreement/)** (así lo indica la documentación de IGDB). Es un marco contractual público (Twitch/IGDB), no una autorización puntual por escrito a un dominio concreto.

**Política pública resumida (según [FAQ de api-docs.igdb.com](https://api-docs.igdb.com/#faq)):**

- Uso **no comercial**: el API se describe como gratuito bajo los términos del acuerdo de Twitch con desarrolladores (enlace arriba).
- **Comercial / producto monetizado**: IGDB indica programa de **partnership** y contacto **[partner@igdb.com](mailto:partner@igdb.com)**; como parte del partnership piden **atribución visible al usuario hacia IGDB.com** ("fair attribution", en ubicación estática, no solo en un changelog).
- **Caché local**: en el FAQ indican que **sí** se permite almacenar/servir datos localmente y que lo prefieren para aliviar carga en el API.

**Conclusión operativa:** no sustituye asesoramiento legal, pero para CoverLens la pista es: **cumplir Twitch Developer + credenciales propias + atribución en app** (ya alineado con la pantalla de fuentes). Si en algún momento la app se considera **comercial** respecto a IGDB, conviene el canal **partner@igdb.com** en lugar de una plantilla genérica de "permiso".

---

## 6) Nota operativa

- Guarda todas las respuestas (email/PDF/capturas) en una carpeta "legal" privada.
- Si no hay respuesta clara, trata la fuente como "no autorizada para release".
