# PokedexGamer — Roadmap y pendientes

## Estado actual (funciona en Expo Go)
- Catálogo local con SQLite
- Escáner de barcode (EAN/UPC) → búsqueda automática en IGDB
- Búsqueda manual por título → IGDB
- Metadatos completos: título, plataforma, año, género, desarrollador, publisher, descripción, puntuación, franquicia
- Carátulas via IGDB + SteamGridDB como fallback
- Pantalla de detalle con portada a pantalla completa
- Edición manual de todos los campos (icono lápiz)
- Favorito / Solo disco toggles
- Exportación del catálogo en JSON
- Ajustes con diagnóstico de APIs

---

## Pendientes de desarrollo

### Alta prioridad
- [ ] Búsqueda/filtro en el catálogo (por título, plataforma, estado metadata)
- [ ] Ordenar catálogo (por nombre, plataforma, fecha de añadido, puntuación)
- [ ] Mostrar puntuación (rating) visualmente en la tarjeta (estrellas o barra)

### Media prioridad
- [ ] Pantalla de estadísticas (total juegos, por plataforma, favoritos, etc.)
- [ ] Filtro de favoritos y solo disco en el catálogo
- [ ] Mejoras visuales: animaciones al abrir tarjeta, transiciones
- [ ] Icono de la app y splash screen personalizados

### Baja prioridad / futuro
- [ ] Exportación compatible con Playnite (formato XML/JSON de Playnite)

---

## Alta en lote por foto (Gemini) y OCR futuro

### Estado actual (implementado en producción)
En `app/(tabs)/escaner.tsx` está activo el flujo **Lote IA — Estantería + Gemini**:
1. Captura/selección de foto de los lomos con `expo-image-picker`.
2. Copia del prompt estructurado (`constants/shelfBatchPrompt.ts`).
3. Apertura de Gemini para procesar la foto y devolver el bloque JSON (`formatVersion: 1`, `purpose: "shelf_batch"`).
4. Importación y previsualización del lote JSON en CoverLens.

### OCR nativo (`@infinitered/react-native-mlkit-text-recognition`) — aparcado
Se retiró la dependencia `@infinitered/react-native-mlkit-text-recognition` de `package.json` al no estar en uso activo y sustituirse por el flujo con Gemini. Se conserva `services/utils/ocrParser.ts` por si en el futuro se retoma OCR directo en dispositivo o vía API.

---

## ScreenScraper como proveedor secundario — pendiente

Playnite embebe su propio devid/devpassword en el plugin.
Para replicarlo en PokedexGamer:
1. Registrar la app en https://www.screenscraper.fr/devzone.php
2. Recibir devid + devpassword por email
3. Hardcodearlos en `services/providers/screenScraperProvider.ts` → buildBaseParams()
4. Eliminar campos Dev ID / Dev Password de la pantalla Ajustes
5. Resultado: usuarios solo ponen usuario + password, igual que en Playnite

---

## Notas de arquitectura
- Proveedor principal: IGDB (Twitch) — igual que Playnite
- Fallback: ScreenScraper (cuando tenga devid propio)
- Carátulas adicionales: SteamGridDB
- Algoritmo de scoring: Playnite-style (cleanGameTitle + scoreMatch + bestMatchIndex)
  en `services/utils/titleUtils.ts`
- Base de datos local: SQLite via expo-sqlite
- Credenciales: expo-secure-store (cifrado en dispositivo)
