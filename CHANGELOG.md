# Changelog

Registro de cambios de `CoverLens / PokedexGamer`.

Este archivo sigue un formato inspirado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y usa versionado por fecha cuando no haya etiqueta semantica publicada.

## [Unreleased]

### Regla de mantenimiento (obligatoria)
- Cualquier PR o commit funcional debe incluir su entrada en este archivo.
- Si el cambio no impacta a usuario final, documentarlo en `Changed` o `Fixed` igualmente.
- No cerrar una tarea sin actualizar `Unreleased`.

### Added
- Escáner: modo `Lote IA` para flujo asistido con Gemini externo (app/web), prompt guiado y pegado de JSON (`games[]`) para procesar en CoverLens.
- Importación por lote pegado con deduplicado y resolución de metadatos reutilizando la lógica de alta manual.
- Modo barcode permite **elegir una foto** con el código (Android/iOS; en iOS la lectura EAN desde imagen puede ser limitada según el sistema).

### Changed
- Escáner simplificado para uso sin credenciales: se priorizan `Barcode` y `Manual`; lote pasa a integración externa por pegado.
- Onboarding y Ajustes actualizados para aclarar que las APIs son opcionales y que el lote recomendado no requiere guardar API keys en CoverLens.

## [2026-04-14]

### Added
- Capa de metadatos con `GameplayStores`, preferencias de fuente y validacion de EAN.
- Flujo de onboarding corporativo, prioridad de credenciales y guia practica.

### Changed
- Resolucion de valor por cadena (`GameplayStores` + preferencias) y precio de tienda en EUR.
- `app.json` actualizado con permisos para `expo-image-picker` y ajuste de dependencias asociadas.
- `android` actualizado con `versionCode 2` tras build de produccion en EAS.

### Documentation
- Protocolo de actualizacion APK/EAS anadido y enlazado desde el workflow Android+iOS.

---

> Nota: Este bloque inicial se ha creado a partir del historial reciente de commits en `main`.
