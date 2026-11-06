# iOS Readiness (TestFlight / App Store)

## Estado actual
- Configuración base lista en `app.json`:
  - `ios.bundleIdentifier = com.coverlens.app`
  - Permisos de cámara/fotos con textos de privacidad
- Pipeline EAS listo en `eas.json` (`preview`/`production`)

## Requisitos obligatorios
- [ ] Cuenta Apple Developer activa.
- [ ] App creada en App Store Connect (`CoverLens`).
- [ ] Certificados/profiles gestionados por EAS o manualmente.

## Build iOS para pruebas en iPhone sin cuenta de pago (AltStore / Sideloadly)
- [x] Workflow en GitHub Actions: `.github/workflows/ios-ipa.yml` (compila `Release` en `macos-15` con `CODE_SIGNING_ALLOWED=NO` y genera el artefacto `CoverLens-iOS-IPA` con `CoverLens.ipa`).
- [x] Corrección de compatibilidad con Xcode 26 / Swift 6.2 en CI actualizando `expo-modules-jsi` a `57.1.3`.
- [x] Generación verificada de `CoverLens.ipa` completa (~21.3 MB) en GitHub Actions (`Run 42088828176`).
- [ ] Instalación en iPhone con **AltStore Classic** (con AltServer y iTunes ejecutándose en Windows con cable USB) o **Sideloadly**.

## Build iOS recomendado para tienda (TestFlight / App Store, sin Mac moderno local)
- [ ] Login EAS: `npx eas login`
- [ ] Configurar credenciales automáticas: `npx eas credentials`
- [ ] Build TestFlight: `npx eas build --platform ios --profile production`
- [ ] Subida a App Store Connect: `npx eas submit --platform ios --profile production`

## Checklist funcional iOS
- [ ] Permisos de cámara solicitados correctamente.
- [ ] Escaneo barcode estable (no bloqueos de cámara).
- [ ] Modal de no encontrado usable con teclado iOS.
- [ ] Exportar JSON y compartir funciona con Share Sheet.
- [ ] Navegación tabs/detalle sin regresiones.

## Checklist App Store Connect
- [ ] Nombre app: CoverLens
- [ ] Subtítulo y descripción localizadas (es-ES)
- [ ] Keywords
- [ ] URL de soporte
- [ ] URL de política de privacidad
- [ ] Capturas iPhone (6.7" y 6.1" mínimo)
- [ ] Clasificación por edades
- [ ] Declaración de uso de datos (Privacy Nutrition Labels)

## Riesgos conocidos / mitigación
- Hardware local antiguo para build iOS nativo -> usar EAS Build en la nube.
- OCR nativo depende de build dev/production, no Expo Go -> validar en build EAS.
- Dependencia de APIs externas (IGDB/ScreenScraper) -> fallback y diagnósticos en Ajustes.

## Criterio de "iOS Ready"
- [ ] Build iOS de producción generado en EAS.
- [ ] Subida correcta a TestFlight.
- [ ] Smoke test ejecutado en iPhone real.
- [ ] Sin bloqueantes P0 abiertos.
