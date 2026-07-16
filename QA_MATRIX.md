# QA Matrix - CoverLens (Mobile Hardening)

## Scope
- Plataforma objetivo principal: Android (release)
- Plataforma secundaria: iOS (ready for TestFlight/App Store)
- Áreas: Colección, Escáner, Ajustes, Detalle de juego, Metadatos, Exportación

## Smoke técnico (ejecutado)
| Check | Command | Resultado |
|---|---|---|
| Lint | `npm run lint` | ✅ PASS |
| Typecheck | `npx tsc --noEmit` | ✅ PASS |
| Config Expo | `npx expo config --type public` | ✅ PASS |
| Parse config | `node -e JSON.parse(app.json)` | ✅ PASS |
| Tests unitarios | `npm test` (181 tests) | ✅ PASS |
| app.json permisos | CAMERA sin duplicar, sin RECORD_AUDIO | ✅ PASS |

## Mejoras de producción aplicadas (2026-07-13)
| Área | Cambio | Estado |
|---|---|---|
| Permisos Android | Eliminado CAMERA duplicado y RECORD_AUDIO sin uso | ✅ |
| Ajustes | Diagnóstico y prueba de portadas ocultos (modo dev: 7 taps en título) | ✅ |
| Onboarding | Accesibilidad en todos los botones/enlaces + checkbox de privacidad | ✅ |
| Ficha juego | Accesibilidad en volver, editar, favorito, disco, actualizar | ✅ |
| Vista Slide | accessibilityRole, label dinámico y hint de gestos | ✅ |
| BotonAzul | Acepta accessibilityLabel/Hint como props | ✅ |
| Código | Eliminados console.log de debug y archivo backup con nombre de Mac | ✅ |

## Matriz funcional de regresión
> Verificado extensivamente en iPhone (Expo Go) y Android en sesiones reales de uso — 2026-07-13

### 1) Colección
- [x] Abre app con catálogo vacío y muestra estado vacío correctamente.
- [x] Tocar tarjeta abre detalle full-screen.
- [x] Eliminar juego desde tarjeta pide confirmación y elimina.
- [x] FAB abre escáner siempre.
- [x] Vista Slide: swipe ←/→ cambia de juego sin abrir ficha.
- [x] Vista Slide: toque simple abre ficha; doble toque alterna favorito.

### 2) Escáner barcode
- [x] Escanear barcode válido crea juego automáticamente.
- [x] Escanear barcode duplicado no crea duplicado ni rompe flujo.
- [x] Si barcode no encontrado, abre modal manual.
- [x] Confirmar título manual guarda juego correctamente.
- [x] Cancelar modal reactiva escáner.

### 3) OCR y alta manual
- [x] OCR sin librería instalada muestra mensaje informativo.
- [x] OCR con título detectado permite editar y guardar.
- [x] Alta manual por título guarda en catálogo.

### 4) Ajustes y mantenimiento
- [x] Guardar credenciales persiste tras reiniciar app.
- [x] Diagnóstico IGDB oculto por defecto; visible tras 7 taps en «Ajustes».
- [x] Reintento masivo de metadatos procesa pendientes.
- [x] Limpieza de duplicados elimina entradas repetidas.
- [x] Exportar JSON genera y comparte archivo.

### 5) Metadatos y consistencia
- [x] Status `resolved/partial/error` se refleja en tarjetas.
- [x] No degrade en reintento (no pisa datos buenos con desconocidos).
- [x] Plataforma consistente (GameCube, PlayStation 4, etc.).
- [x] Versión especial detectada (Hits/Player's Choice/Platinum).

### 6) Accesibilidad básica
- [x] Botones principales con etiquetas en lector de pantalla (onboarding, ficha, ajustes).
- [x] Acciones pequeñas (trash/FAB) tienen área táctil suficiente.
- [x] Contraste correcto en textos secundarios y estados.
- [x] Flujo usable con tamaño de fuente aumentado.
- [x] Vista Slide anunciada como control ajustable con posición y nombre del juego.

## Criterios de salida QA
- [x] 0 bloqueantes P0 abiertos.
- [x] Flujos críticos (scan → save → open → retry → export) verificados en dispositivo real.
- [x] Sin crashes en sesión de 15+ minutos de uso continuo.

## Resultado final
> **✅ QA SUPERADO** — App lista para build de producción (2026-07-13)
>
> Verificado en: iPhone con Expo Go + dispositivo Android.  
> Pendiente antes de release: build EAS production + bundle ID iOS unificado en App Store Connect.
