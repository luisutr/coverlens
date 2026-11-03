# APK actual para testers (Android)

> Actualizar el enlace **APK** cuando termine cada build `preview` en EAS.

## APK actual (2026-11-03)

| Campo | Valor |
|-------|--------|
| **Página del build (seguimiento / descarga APK)** | https://expo.dev/accounts/luisutr/projects/coverlens/builds/cc15ca0c-2991-4e57-b34b-89d5a854d1ad |
| **Commit** | `7a33e67` (main) — corrección crash post-onboarding (ProGuard disabled, v1.0.5, versionCode 6) |
| **Perfil** | `preview` (APK instalable directamente en móvil y tablet) |
| **Caducidad artefacto** | ~14 días desde la fecha del build (política EAS) |

## Cómo instalar

1. Abre el enlace del build en el móvil Android (o escanea el QR en expo.dev).
2. Descarga el `.apk` y permite «Instalar apps desconocidas» si el sistema lo pide.
3. **iPhone:** no instala APK; usar Expo Go o TestFlight (flujo aparte).

## Qué probar en esta versión

- Escáner: barcode, **Lote (IA)** con Gemini, manual.
- Ajustes → **Cómo usar CoverLens**.
- Valor estimado en ficha (aviso «est.» / contrastar).
- Import/export catálogo JSON.

## Limpieza de builds antiguas en EAS

```bash
npx eas-cli build:list --platform android --limit 20
npx eas-cli build:delete <BUILD_ID> --non-interactive
```

La build del 2026-04-22 (`44aabf6f-…`) ya estaba **caducada** (expiración 2026-05-06) y fue eliminada.

## Generar otra APK

Ver [PROTOCOLO_ACTUALIZACION_APK_EAS.md](./PROTOCOLO_ACTUALIZACION_APK_EAS.md):

```bash
npx --yes npm@10.9.3 install --package-lock-only   # si cambió package.json
npx --yes npm@10.9.3 ci --include=dev
npm test
npx eas-cli build -p android --profile preview --non-interactive
```
