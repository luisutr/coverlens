# Checklist de prepublicacion (App Store + Google Play)

Documento operativo para reducir riesgo de rechazo antes de enviar CoverLens a revision.

## 1) Legal y licencias (bloqueante)

- [ ] Confirmar licencia del codigo (actualmente GPL-3.0 en `LICENSE`).
- [ ] Publicar atribuciones de proveedores de datos/imagenes en la app y en el repo.
- [ ] Revisar terminos de cada proveedor activo en release:
  - [ ] GameplayStores
  - [ ] IGDB/Twitch
  - [ ] SteamGridDB
  - [ ] ScreenScraper
  - [ ] GameUPC
- [ ] Pedir permiso por escrito cuando los terminos no permitan claramente uso en app publica.
- [ ] Guardar pruebas (emails, respuestas, capturas de terminos) en una carpeta legal interna.

## 2) Privacidad y cumplimiento (bloqueante)

- [ ] Publicar una Privacy Policy accesible por URL publica estable.
- [ ] Incluir en la policy:
  - servicios de terceros usados,
  - datos tratados,
  - finalidad,
  - retencion,
  - contacto.
- [ ] Configurar en App Store Connect "App Privacy" segun lo que realmente hace la app.
- [ ] Configurar en Google Play "Data safety" de forma consistente con la policy.

## 3) Transparencia en la app (muy recomendado)

- [ ] Pantalla "Fuentes y atribucion" con:
  - no afiliacion oficial,
  - listado de proveedores,
  - enlaces a sus terminos.
- [ ] Texto visible: "CoverLens no esta afiliada oficialmente a GameplayStores, IGDB, SteamGridDB ni ScreenScraper."
- [ ] Si aplica, añadir enlace "Ver en tienda" para productos de terceros.

## 4) Riesgo de contenido (review stores)

- [ ] No incluir contenido que viole derechos de terceros.
- [ ] Evitar branding confuso o logos oficiales sin permiso.
- [ ] Si hay portadas de terceros, verificar permiso/licencia para mostrar y cachear.
- [ ] Tener plan de contingencia: desactivar proveedor en build de release si no hay permiso.

## 5) Calidad minima release

- [ ] Build Android e iOS release funcional.
- [ ] Test de flujo principal: barcode, manual, lote IA.
- [ ] Test offline/errores de red.
- [ ] Sin crashes en arranque, escaner y ficha.
- [ ] Metadatos y portadas se guardan sin bloquear UI.

## 6) Materiales de publicacion

- [ ] Descripcion de app sin claims engañosos.
- [ ] Capturas reales de la app.
- [ ] URL de soporte.
- [ ] URL de privacidad.
- [ ] Version notes claras (que usa fuentes externas opcionales).

## 7) Decision go/no-go

No enviar a revision hasta cumplir:

- bloqueantes legales/licencias,
- privacy policy publica,
- declaracion de privacidad en stores consistente,
- pruebas basicas de calidad.
