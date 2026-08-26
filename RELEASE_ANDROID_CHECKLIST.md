# Android Release Checklist (CoverLens)

## 1) Configuración técnica
- [x] `app.json` con nombre/slug/scheme finales (`CoverLens`, `coverlens`, `coverlens`).
- [x] `android.package` definido: `com.coverlens.app`.
- [x] Iconos/splash actualizados en `assets/images`.
- [x] `eas.json` con perfiles `preview` y `production`.
- [x] Lint/typecheck/tests en verde.

## 2) Build release
- [ ] Login EAS: `npx eas login`
- [ ] Config proyecto: `npx eas init`
- [ ] Build preview (APK): `npx eas build --platform android --profile preview`
- [ ] Build producción (AAB): `npx eas build --platform android --profile production`

## 3) Validación en dispositivo real
- [ ] Instalación APK preview.
- [ ] Escaneo barcode (alta, duplicado, no encontrado).
- [ ] Alta manual / edición / borrado.
- [ ] Ajustes (guardar credenciales, diagnóstico, reintento metadatos).
- [ ] Exportación JSON y compartir archivo.
- [ ] Sesión de 15 min sin crash.

## 4) Play Console (EAS Submit)
> Si no has vinculado Expo con tu cuenta de Google Cloud, consulta la [GUIA_EAS_SUBMIT_PLAY_STORE.md](docs/GUIA_EAS_SUBMIT_PLAY_STORE.md)
- [ ] Crear app (nombre: CoverLens).
- [ ] Subir AAB firmado.
- [ ] Ficha de tienda (descripción corta/larga, categoría, contacto, privacidad).
- [ ] 512x512 icono + feature graphic + screenshots.
- [ ] Data safety y permisos (cámara).
- [ ] Clasificación de contenido.
- [ ] Política de privacidad pública (URL).

## 5) Go/No-Go Android
- [ ] 0 bloqueantes P0.
- [ ] QA matrix ejecutada y documentada.
- [ ] Build producción validada y subida correctamente.
