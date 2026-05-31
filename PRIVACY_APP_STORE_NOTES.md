# Privacy Notes for Store Submission

Notas internas para rellenar App Store Connect y Google Play Console.
Política pública completa: [docs/PRIVACY_POLICY_ES.md](docs/PRIVACY_POLICY_ES.md)

## Datos que maneja la app

- Catálogo local de juegos (SQLite): título, plataforma, barcode, metadatos, URLs de portada/cabecera, valor estimado.
- Credenciales API opcionales (SecureStore), solo si el usuario las configura.
- Uso de cámara para escaneo de barcode y OCR local de portadas (procesamiento on-device con ML Kit).

## Datos enviados por internet

- **Servidor integrado CoverLens:** `https://covers.cholloweb.es/` — búsquedas de metadatos, portadas y valor (título, plataforma; sin credenciales ni cuenta de usuario). Fuente principal por defecto.
- **Terceros opcionales** (solo si el usuario activa la fuente y/o configura credenciales):
  - Metadatos/portadas: IGDB, ScreenScraper, SteamGridDB
  - Valor: PriceCharting, eBay
  - Barcode fallback: GameUPC
- **No integrado:** GameplayStores (desactivado; sin confirmación de uso por parte de la tienda).

## Datos que NO recopila el desarrollador

- No hay cuentas de usuario ni registro en servidores propios.
- No hay tracking publicitario ni analytics de terceros.
- No se venden datos personales.

## Declaración recomendada en tiendas

- **Data linked to user:** No (catálogo local; consultas a APIs no vinculan identidad del usuario salvo políticas propias de terceros).
- **Tracking:** No.
- **Data collection by app owner:** mínima (consultas de búsqueda de juegos al VPS; sin perfil de usuario).

## Permisos del dispositivo

- **Cámara:** escaneo de códigos de barras.
- **Fotos:** selección de imagen para OCR de portada (modo opcional).

## URL de política de privacidad

**URL pública para App Store / Play Console:** https://covers.cholloweb.es/privacidad

Fuente Markdown: `docs/PRIVACY_POLICY_ES.md`. HTML estático: `docs/privacidad/index.html` (regenerar con `node scripts/build-privacy-html.mjs`).

**Despliegue:** subir `docs/privacidad/index.html` al VPS LiteSpeed en `/privacidad/`. Si el host redirige todo al SPA de `/catalogo`, configurar excepción para servir el HTML estático.

## Referencia legal interna

- Cumplimiento APIs: [docs/API_TERMS_COMPLIANCE.md](docs/API_TERMS_COMPLIANCE.md)
- Notas brutas proveedores: [docs/Permisos_servicios_terceros.txt](docs/Permisos_servicios_terceros.txt)
