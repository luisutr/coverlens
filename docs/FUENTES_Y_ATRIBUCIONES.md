# Fuentes externas y atribuciones (CoverLens)

## Aviso de no afiliacion

CoverLens es un proyecto independiente. No esta afiliado oficialmente, ni respaldado, ni patrocinado por GameplayStores, IGDB, Twitch, SteamGridDB, ScreenScraper o GameUPC.

## Licencia del codigo de la app

- Codigo de CoverLens: GNU GPL v3.0 (`LICENSE`).

## Proveedores externos usados por la app

### 1) GameplayStores

- Sitio: https://www.gameplaystores.es/
- Uso en la app: resolucion de titulo/plataforma y posible portada desde resultados de busqueda web.
- Estado recomendado para release: **solicitar permiso escrito previo** para uso en app publica (especialmente imagenes).

### 2) IGDB (Twitch)

- Sitio: https://api-docs.igdb.com/
- Uso en la app: metadatos de juegos e imagenes IGDB.
- Condicion: cumplir Twitch Developer Service Agreement y requisitos aplicables.

### 3) SteamGridDB

- Sitio: https://www.steamgriddb.com/
- Uso en la app: busqueda de portadas.
- Estado de permiso: respuesta positiva de SteamGridDB (Jozen) para este caso, con condiciones.
- Condiciones aplicables:
  - atribucion visible en la app,
  - enlace al asset concreto recomendado (no obligatorio),
  - si hay llamadas directas desde app cliente: cada usuario debe configurar su API key personal,
  - alternativa: usar proxy propio para una key unica y cachear respuesta JSON durante varias horas.

### 4) ScreenScraper

- Sitio: https://www.screenscraper.fr/
- Uso en la app: metadatos/portadas de respaldo.
- Nota de licencia visible en su sitio: contenido comunitario bajo CC BY-NC-SA 4.0 en varios contextos; validar alcance exacto para distribucion en stores.

### 5) GameUPC

- Sitio: https://www.gameupc.com/
- Uso en la app: fallback de informacion por barcode.
- Recomendacion: pedir confirmacion explicita de uso permitido en app distribuida.

## Reglas internas de publicacion

- Si no hay permiso/licencia clara para un proveedor, desactivarlo en release.
- Mantener este archivo actualizado cuando cambie una integracion o sus terminos.
- Mostrar en la app una pantalla de atribuciones equivalente.
