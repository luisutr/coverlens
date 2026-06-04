# Aviso legal y de usuario: valores económicos estimados

> **Estado:** implementado (2026-06-03)  
> **Prioridad sugerida:** alta (antes o junto a publicación en tiendas)  
> **Fecha de registro:** 2026-06-03

## Objetivo

Dejar **explícito** en la documentación del proyecto y en la **información visible al usuario** que los importes mostrados en CoverLens (valor de mercado, precio en tienda, mediana de anuncios, totales por plataforma, etc.) son **solo estimaciones orientativas**. La app **no garantiza** precisión al 100 % y se **recomienda contrastar** la información con otras fuentes antes de tomar decisiones de compra, venta o valoración patrimonial.

---

## Mensaje clave (copy base)

Texto propuesto para reutilizar en app, web y documentación (ajustar tono legal si hace falta revisión profesional):

> **Valor estimado — solo orientativo**  
> Los importes que muestra CoverLens proceden de fuentes públicas o de terceros (catálogo integrado, tiendas, guías de precios, anuncios activos en marketplaces, etc.) y pueden estar desactualizados, incompletos o no corresponder a tu edición, región o estado del juego (nuevo, usado, precintado, solo disco, etc.).  
> **No constituyen una tasación oficial ni un precio de venta garantizado.** Te aconsejamos **contrastar** esta información con otras referencias antes de comprar, vender o tomar cualquier decisión económica.

Versión corta (UI compacta):

> Estimación orientativa. Contrastar antes de decidir.

---

## Por qué hace falta

| Situación | Riesgo sin aviso claro |
|-----------|-------------------------|
| Precio del VPS (`marketValueEUR`) | Puede no reflejar el mercado real del usuario |
| PriceCharting (USD, CIB/suelto) | Condición y región distintas a la colección |
| eBay (mediana de anuncios activos) | No es precio de venta cerrada; varía por día |
| GameplayStores | Precio en tienda, no mercado de segunda mano |
| Valor manual editado por el usuario | Responsabilidad percibida como «dato de la app» |
| Totales por plataforma (mejora [LIMPIEZA_AJUSTES_VALORACION.md](./LIMPIEZA_AJUSTES_VALORACION.md)) | Suma de estimaciones ≠ valor real de la colección |

Hoy el proyecto ya usa términos como **«valor orientativo»** en onboarding y Ajustes, pero **no hay un aviso unificado** ni visible en ficha de juego, listado, privacidad ni documentación para desarrolladores/testers de forma consistente.

---

## Dónde debe aparecer (checklist)

### App móvil (usuario final)

- [x] **Ficha del juego** (`app/game/[id].tsx`) — texto corto + «Más información» (Alert con copy completo).
- [ ] **Primera vez que se muestra un valor** — tooltip o línea en tour (el tour actual no cubre valor; opcional).
- [x] **Onboarding** (`app/onboarding.tsx`) — párrafo de contrastar antes de decidir.
- [x] **Ajustes → Cotización** (`app/(tabs)/ajustes.tsx`) — aviso completo bajo la sección.
- [x] **Listado del catálogo** (`app/(tabs)/index.tsx`) — prefijo «est.» en tarjetas + nota al pie si hay valores.
- [ ] **Sección valoración total** (cuando exista según LIMPIEZA_AJUSTES_VALORACION) — pendiente de esa mejora.
- [x] **App Store / Play Store** — `PRIVACY_APP_STORE_NOTES.md` actualizado.

### Documentación del proyecto (desarrolladores, testers, legal)

- [x] **`docs/GUIA_USUARIO_COVERLENS.md`** y guía in-app — sección valor económico.
- [ ] **`docs/privacidad/index.html`** — regenerar desde Markdown (`node scripts/build-privacy-html.mjs`) tras desplegar.
- [x] **`docs/PRIVACY_POLICY_ES.md`** — párrafo estimaciones.
- [ ] **`docs/API_TERMS_COMPLIANCE.md`** — recordatorio opcional (ya menciona orientativo en eBay).
- [ ] **`docs/FUENTES_TERCEROS_DECISION.md`** — columna naturaleza del dato (opcional).
- [x] **`constants/documentation/portadasYFuentesDoc.ts`** — sección valor estimado.
- [x] **`constants/valueEstimateDisclaimer.ts`** — copy centralizado.
- [x] **`PRIVACY_APP_STORE_NOTES.md`** — sección valor económico.

### Web pública (VPS)

- [ ] **`https://covers.cholloweb.es/catalogo`** — si se muestra `marketValueEUR`, pie de página o tooltip «valor orientativo».
- [ ] **Política de privacidad web** — coherente con la app.

---

## Constante recomendada (implementación)

Centralizar el copy en un solo sitio para no divergir textos:

| Constante (propuesta) | Ubicación |
|----------------------|-----------|
| `VALUE_ESTIMATE_DISCLAIMER_SHORT` | `constants/valueEstimateDisclaimer.ts` |
| `VALUE_ESTIMATE_DISCLAIMER_FULL` | misma archivo |
| `VALUE_ESTIMATE_DISCLAIMER_URL` | opcional: ancla en doc in-app o `/privacidad#valoracion` |

La pantalla de documentación de fuentes y el modal de ayuda en ficha importan desde ahí.

---

## Relación con fuentes actuales

| Fuente | Qué muestra | Matiz para el usuario |
|--------|-------------|------------------------|
| CoverLens VPS | `marketValueEUR` en browse/ficha | Estimación del catálogo propio; puede ser null o antigua |
| GameplayStores | Precio en tienda EUR | Precio de venta nueva/reacondicionada en esa tienda |
| PriceCharting | Guía USD | Suscripción del usuario; condición CIB/suelto según API |
| eBay | Mediana anuncios activos | No incluye ventas cerradas; marketplace configurable |
| Manual | Valor editado | Responsabilidad del usuario; la app no valida |

El aviso **no sustituye** el cumplimiento de términos de eBay/PriceCharting; los complementa desde UX y expectativas del usuario final.

---

## Criterios de éxito

- Cualquier pantalla donde se vea un **importe en moneda** incluye al menos la versión corta del aviso o un acceso obvio a la versión completa.
- La política de privacidad y la guía de testers mencionan explícitamente **falta de garantía** y **recomendación de contrastar**.
- No se presenta CoverLens como herramienta de tasación profesional, inversión o asesoramiento financiero.

---

## Notas para implementación

1. Revisión legal opcional si el producto se comercializa en UE (cláusulas de exoneración de responsabilidad según uso previsto).
2. Priorizar **ficha de juego** + **privacidad** + **onboarding** en un primer PR; el resto en segundo.
3. Mantener tono claro y no alarmista; el objetivo es transparencia, no ocultar la función de valoración.

---

## Referencias en el repo

| Recurso | Ubicación |
|---------|-----------|
| Bloque valor en ficha | `app/game/[id].tsx` («Valor estimado») |
| Texto orientativo en Ajustes | `app/(tabs)/ajustes.tsx` (Cotización) |
| Onboarding | `app/onboarding.tsx` |
| Cadena de fuentes de valor | `services/valuePreferenceResolver.ts` |
| Mejora totales por plataforma | [LIMPIEZA_AJUSTES_VALORACION.md](./LIMPIEZA_AJUSTES_VALORACION.md) |
| Cumplimiento APIs precio | `docs/API_TERMS_COMPLIANCE.md` |
