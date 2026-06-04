# Limpieza de Ajustes y Valoración Económica de la Colección

> **Estado:** idea / especificación de diseño  
> **Prioridad sugerida:** media  
> **Fecha de registro:** 2026-06-03

---

## 1. Limpieza de Ajustes (Preparación para Producción)

### Objetivo
Simplificar y limpiar la pestaña **Ajustes** (`app/(tabs)/ajustes.tsx`) para la versión final del producto, ocultando o eliminando herramientas técnicas destinadas a desarrollo y pruebas que no aportan valor al usuario final y pueden confundirle.

### Acciones propuestas
* **Sección de Diagnóstico de APIs (Ocultar/Retirar)**:
  * El botón «Ejecutar diagnóstico» que realiza peticiones de prueba a IGDB, PriceCharting y eBay debe ocultarse de la vista estándar.
  * Opcional: Se puede habilitar un "Modo Desarrollador" (p. ej. pulsando 7 veces sobre el título "Ajustes") para mostrar este bloque solo cuando sea necesario depurar.
* **Sección de Pruebas de Proveedores**:
  * Ocultar/retirar la acción «Prueba de portadas» (que ejecuta `runCoverSourcesProbeLogLines`).
* **Simplificación de Herramientas**:
  * Mantener visible únicamente:
    * **Importación/Exportación** del catálogo (JSON).
    * **Limpieza de duplicados**.
    * **Reintento de metadatos** y **Descarga de portadas en lote**.
    * **Vaciar catálogo** (con sus correspondientes modales de doble confirmación).

---

## 2. Sección Colapsable de Valoración Económica

### Objetivo
Añadir una sección colapsable (acordeón) en **Ajustes** que muestre estadísticas económicas de la colección del usuario: el valor total del catálogo y el desglose de valor económico acumulado por cada plataforma.

### Requisitos Funcionales

1. **Sección colapsable (UI)**:
   * Un panel tipo acordeón rotulado como **«Valor económico de la colección»**.
   * Al estar colapsado, muestra un resumen rápido del total (ej: `Total: 154,20 €`).
   * Al expandirse, muestra una lista ordenada de mayor a menor con el valor acumulado por cada plataforma.

2. **Cálculos y Base de Datos**:
   * Implementar una consulta optimizada en `database/dbConfig.ts` (ej: `getCollectionEconomicSummary()`):
     ```sql
     SELECT 
       platform,
       COUNT(*) as totalGames,
       SUM(CASE WHEN valueCents IS NOT NULL THEN 1 ELSE 0 END) as pricedGames,
       SUM(COALESCE(valueCents, 0)) as totalPlatformCents
     FROM games
     GROUP BY platform
     ORDER BY totalPlatformCents DESC;
     ```
   * En JS/TS, formatear el resultado:
     * Sumar los céntimos totales de todas las plataformas para obtener el valor global de la colección.
     * Dividir entre 100 para mostrar en formato decimal con el símbolo de divisa correspondiente (por defecto `€`).
     * Mostrar el ratio de cobertura de precios (ej: *«Precios disponibles para 45 de 60 juegos»*).

### UI Mockup (Líneas de Diseño)
```
[>] Valor económico de la colección           Total: 425,50 €
-------------------------------------------------------------
(Al expandir)
 • Nintendo Switch: 210,00 € (10/12 juegos con precio)
 • PlayStation 4: 150,50 € (8/10 juegos con precio)
 • Xbox 360: 65,00 € (5/5 juegos con precio)

 Cobertura total de precios: 23 de 27 juegos (85%)
```

---

## Criterios de Aceptación
* El panel colapsable responde suavemente y recuerda o mantiene su estado abierto/cerrado.
* Las consultas no bloquean el hilo principal de la interfaz de usuario (uso de `useFocusEffect` o carga asíncrona tras expandir).
* Los datos económicos son consistentes con el campo `valueCents` almacenado en SQLite.
