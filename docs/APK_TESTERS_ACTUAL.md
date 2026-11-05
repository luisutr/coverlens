# APK actual para testers (Android)

> Actualizar el enlace **APK** cuando termine cada build `preview` en EAS.

## Estado de releases (2026-11-05)

### Producción Google Play (`.aab` + `eas submit` automático)

| Campo | Valor |
|-------|--------|
| **Build de producción (AAB)** | https://expo.dev/accounts/luisutr/projects/coverlens/builds/c9ebb105-e41d-4218-ba0f-fd146432b135 |
| **Envío a Google Play (`eas submit`)** | https://expo.dev/accounts/luisutr/projects/coverlens/submissions/08160cb3-8779-4f69-80aa-c0bf787ebf90 |
| **Versión / Version code** | `1.0.5` (`versionCode` remoto `12`) |
| **Commit** | `22b9a49` (main) — corrección definitiva del crash post-onboarding (`ReferenceError: Property 'CARD_H' doesn't exist` en `CatalogSlideDeck.tsx`) y limpieza de esquema `app.json` / dependencias (`mlkit`, `eas-cli`) |
| **Validación en dispositivo físico** | Validado por USB (`adb`) en Xiaomi Redmi Note 10 (`M2101K7AG`) |

### APK previa para testers (2026-11-05)

| Campo | Valor |
|-------|--------|
| **Página del build (seguimiento / descarga APK)** | https://expo.dev/accounts/luisutr/projects/coverlens/builds/541eae7d-61cb-475e-88f3-278f4564b83d |
| **Nota** | Las builds anteriores a `22b9a49` (`cc15ca0c` y `541eae7d`) aún tenían `CARD_H` fuera de ámbito en `CatalogSlideDeck.tsx`. Para un nuevo APK de testers con el fix incluido, lanzar `npx eas-cli build -p android --profile preview` sobre `22b9a49` o superior. |
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
