# APK actual para testers (Android)

> Actualizar el enlace **APK** cuando termine cada build `preview` en EAS.

## APK actual (2026-06-04)

| Campo | Valor |
|-------|--------|
| **APK (compartir con amigos)** | https://expo.dev/artifacts/eas/dQC3hTZcehjDT3LtpQNism.apk |
| **Página del build** | https://expo.dev/accounts/luisutr/projects/coverlens/builds/67f79334-21f9-48ad-8fd0-41e9c308e7ac |
| **Commit** | `01faaa4` (main) — lote IA, guía usuario, barcode VPS, aviso valores |
| **Perfil** | `preview` (APK instalable, `versionCode` 3) |
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
