# Guía para testers — APIs, portadas y cotización (opcional)

## Es normal que sin credenciales veas menos cosas

CoverLens guarda tu catálogo **en el móvil**. Los **metadatos base** (título, plataforma, edición) pueden resolverse con **GameplayStores** sin ninguna clave. Para **más datos de ficha** (género, año, descripción, nota) y **más portadas**, puedes activar APIs opcionales.

Si **no configuras** IGDB, SteamGridDB, ScreenScraper, etc.:

- Puedes **añadir juegos** (escáner, título manual, import CSV/JSON) y obtener título/plataforma desde GameplayStores cuando el listado lo tenga.
- Las **portadas** siguen la cadena de Ajustes (GameplayStores, SteamGridDB…); puede haber más huecos sin SteamGridDB/IGDB.
- **IGDB** completa mucho la parte de texto y cabeceras; sin él las fichas suelen quedar «parciales» hasta que haya portada + un dato extra (p. ej. edición desde GPS).

**No es un fallo de la beta**: es el diseño (local-first + APIs opcionales).

---

## Qué es obligatorio, recomendado u opcional

| Prioridad | Servicio | Para qué sirve |
|-----------|----------|----------------|
| **Sin clave** | **GameplayStores** | Metadatos de ficha por EAN o título+plataforma (orden en **«Orden de fuentes (metadatos)»**). |
| **Muy recomendado** | **IGDB** (vía Twitch) | Año, género, descripción, nota, portada/cabecera IGDB cuando existan. |
| **Recomendado** | **SteamGridDB** | Más aciertos en portadas/rejillas cuando el título no coincide a la primera. |
| **Opcional** | **ScreenScraper** | Metadatos y portadas de respaldo si lo activas en las cadenas de Ajustes. |
| **Opcional** | **PriceCharting Pro** | Precio guía en USD en la ficha (requiere suscripción Pro con API). |
| **Opcional** | **eBay Developers** | Mediana de anuncios activos (orientativo; no es precio de venta cerrada). |

Puedes dejar solo GameplayStores, o añadir IGDB + SteamGridDB, y activar ScreenScraper u otras cuando quieras (todo configurable por orden y interruptores en Ajustes → Catálogo).

---

## Dónde poner las claves en la app

1. Abre **Ajustes** (última pestaña).
2. Toca **«APIs de metadatos»** para desplegar el bloque.
3. Rellena solo lo que quieras usar (no hace falta todo).
4. Pulsa **«Guardar credenciales»** al final de ese bloque.

Las claves se guardan en el dispositivo (almacenamiento seguro), no en nuestros servidores.

---

## 1. IGDB — Twitch Developer Console (muy recomendado, opcional)

IGDB se usa con una **aplicación** creada en la consola de desarrollador de **Twitch** (gratis). La cuenta de Twitch es la misma que usarás en `dev.twitch.tv`.

### Si no tienes cuenta Twitch

1. Entra en **https://www.twitch.tv** y pulsa **Registrarse** (Sign up). Completa email, usuario y contraseña.
2. Si piden verificación, revisa el correo y confirma la cuenta.

### Crear la aplicación y obtener Client ID y Secret

1. Abre **https://dev.twitch.tv/console** e inicia sesión con tu cuenta Twitch.
2. En el panel, pulsa **Register Your Application** (Registrar aplicación).
3. **Name**: un nombre cualquiera (ej. `CoverLens` o tu nick).
4. **OAuth Redirect URLs**: escribe exactamente **`http://localhost`**. Si el formulario solo acepta HTTPS, prueba **`https://localhost`**.
5. **Category**: elige **Application Integration** (o la opción equivalente que muestre el desplegable).
6. Pulsa **Create** / **Create Application**.
7. En la página de tu aplicación verás el **Client ID**. Cópialo.
8. Pulsa **New Secret** (o **Manage** → generar secret). Copia el **Client Secret** en ese momento: **solo se muestra una vez**; guárdalo en un sitio seguro.
9. En CoverLens → Ajustes → APIs de metadatos → **IGDB**: pega **Client ID** y **Client Secret** y guarda.

Con esto mejoran búsquedas de metadatos, portada por URL de IGDB y la **cabecera** ancha en la ficha cuando haya datos.

---

## 2. SteamGridDB (recomendado)

1. Entra en **https://www.steamgriddb.com** y crea cuenta (**Register** / **Sign up**).
2. Si piden confirmar el correo, abre el enlace del email.
3. Inicia sesión. Abre tu **perfil** o **Settings** (menú de usuario / avatar).
4. Busca la sección **API** o **API Keys** y genera una **API Key** nueva.
5. Cópiala y pégala en CoverLens → **SteamGridDB** → **Guardar credenciales**.

Ayuda cuando la cadena de portadas elige SteamGridDB (orden configurable en **«Orden de fuentes (portadas)»** en Ajustes).

---

## 3. ScreenScraper (opcional)

1. Regístrate en el foro: **https://www.screenscraper.fr** (sigue el enlace de registro que indique la web).
2. Completa la verificación de correo si la piden.
3. **Usuario y contraseña del foro** son los mismos que pondrás en CoverLens.
4. **Opcional**: si el foro te asigna **Dev ID** y **Dev Password** (o los obtienes en la zona de desarrollador), puedes añadirlos en Ajustes para mejor cuota en algunos casos.

---

## 4. Cotización — PriceCharting y eBay (opcional)

No son necesarios para catalogar, escanear ni para la mayoría de portadas. Solo añaden **valor orientativo** en la ficha del juego.

### PriceCharting Pro

- Requiere suscripción **Pro** que incluya acceso a la **API** (consulta en **https://www.pricecharting.com** la opción Pro con API).
- Obtén el **token** de API desde tu cuenta Pro y pégalo en CoverLens → **PriceCharting token**.

### eBay Developers (gratis a nivel de registro de app)

- No uses tu contraseña de compras de eBay. Creas una **aplicación** en el portal de desarrolladores.
1. Entra en **https://developer.ebay.com** e inicia sesión (puedes usar tu cuenta de eBay de usuario).
2. Ve a **My Account** → **Application Keys** (o **Keys**).
3. Crea un keyset de **Production** (o Sandbox si quieres probar; la app detecta `-SBX-` en el Client ID).
4. Copia **App ID (Client ID)** y **Cert ID / Client Secret** según muestre el panel.
5. En CoverLens, rellena **eBay Client ID**, **eBay Client Secret** y el **marketplace** (p. ej. `EBAY_ES` o `EBAY_US`).

---

## Enlaces rápidos

- Twitch / IGDB: https://dev.twitch.tv/console  
- SteamGridDB: https://www.steamgriddb.com  
- ScreenScraper: https://www.screenscraper.fr  
- PriceCharting Pro / API: https://www.pricecharting.com/pricecharting-pro?f=api  
- eBay Developers: https://developer.ebay.com  

---

## Si algo «no encuentra» juego o portada

- Revisa **título y plataforma** (y código de barras si aplica).
- En **Ajustes** → **Ejecutar diagnóstico** o **Probar portadas** para ver si las APIs responden con tus credenciales.
- Las APIs tienen **límites** y a veces fallan por red; prueba otra red o más tarde.

---

## Resumen

| Situación | Qué esperar |
|-----------|--------------|
| Sin ninguna API | Catálogo con GPS; fichas más «parciales» si falta portada o datos extra |
| Solo GameplayStores (metadatos + portadas) | Título/plataforma desde tienda; portada si el JSON la trae |
| + IGDB | Fichas de texto mucho mejores + portada/cabecera IGDB cuando existan |
| + SteamGridDB (+ opcional ScreenScraper) | Mejor cobertura de portadas en el grid |
| + PriceCharting y/o eBay | Valor orientativo en la ficha (opcional) |

Cualquier duda sobre la beta, anótala con **pasos para reproducir** y modelo de móvil; eso ayuda mucho.
