**GUÍA: Cómo determinar si un videojuego tiene formato físico usando IGDB**

Esta guía explica los pasos necesarios para deducir si un videojuego cuenta con una edición física en el mercado, utilizando la base de datos de **IGDB (Internet Game Database)**. Puedes aplicar este método tanto de forma manual en su página web como de forma automatizada a través de su API.

---

**MÉTODO 1: Consulta manual en la Web de IGDB**

Si estás revisando la ficha de un juego directamente en el navegador web, sigue estos pasos:

**Paso 1: Buscar el juego y acceder a su ficha**

1. Entra en igdb.com.
2. Escribe el nombre del juego en el buscador principal y selecciónalo.

**Paso 2: Ir a la pestaña de Lanzamientos (Release Dates)**

1. En la ficha principal del juego, desplázate hacia abajo hasta el menú de pestañas.
2. Haz clic en la pestaña **"Release Dates"** (Fechas de lanzamiento).

**Paso 3: Analizar la tabla de datos**

Verás una lista desglosada por columnas: **Platform** (Plataforma), **Region** (Región), **Date** (Fecha) y **Status/Type** (Estado/Tipo). Para deducir si es físico, aplica las siguientes tres reglas:

* **Regla del Año (Consolas Antiguas):** Si el lanzamiento es para consolas de sexta generación o anteriores (PlayStation 2, Xbox original, GameCube, Nintendo 64, etc.), cualquier registro que indique **"Full release"** significa automáticamente que el juego es **FÍSICO**. En esa época no existía la distribución digital en consolas.
* **Regla de la Plataforma PC:** Si el juego es de PC moderno (posterior a 2010), la inmensa mayoría de los lanzamientos son digitales (Steam, Epic Games). Solo será físico si se especifica explícitamente una edición "Collector's" o "Big Box".
* **Regla de Consolas Modernas (PS4, PS5, Switch, Xbox One/Series):** Observa la etiqueta del tipo de lanzamiento. Si solo aparece un registro que dice **"Digital"**, el juego es exclusivamente digital. Si el registro muestra una fecha completa (Día/Mes/Año) sin la etiqueta "Digital", o indica "Retail", confirma que existió un lanzamiento físico en tiendas.

---

**MÉTODO 2: Consulta automatizada a través de la API de IGDB**

Si estás desarrollando un script o aplicación, la API no te devolverá texto visual, sino datos estructurados (JSON). Estos son los pasos lógicos que debe seguir tu código:

**Paso 1: Realizar la petición al Endpoint de Juegos**

Debes hacer una consulta POST al endpoint `/v4/games` solicitando los campos clave de lanzamiento.

* **Campos obligatorios a pedir en la Query:** `game_release_formats.name`, `release_dates.category`, `release_dates.platform`.

**Paso 2: Evaluar el campo directo game\_release\_formats**

En las versiones recientes de la API, este es el método más rápido:

1. Comprueba el array `game_release_formats`.
2. **Resultado:** Si el campo `name` contiene el valor **"Physical"**, el juego tiene edición física confirmada. Si solo contiene **"Digital"**, es únicamente virtual.

**Paso 3: Evaluar el campo de respaldo release\_dates.category**

Si el campo anterior está vacío en juegos más antiguos, debes analizar el array de fechas de lanzamiento (`release_dates`). Cada objeto tiene un campo llamado **category** que utiliza un número entero (Enum).

Aplica esta lógica de filtrado en tu código:

* **category: 0** \\(\rightarrow \\) Significa **"YYYYMMDD"** (Fecha completa / Lanzamiento tradicional en tienda). **Es un indicador muy alto de formato Físico.**
* **category: 1** \\(\rightarrow \\) Significa **"YYYYMM"** (Mes de lanzamiento). Generalmente físico o lanzamiento estándar.
* **category: 2** \\(\rightarrow \\) Significa **"YYYY"** (Solo el año). Generalmente físico o ventana de lanzamiento clásica.
* **category: 5** \\(\rightarrow \\) Significa **"Digital"**. Si **todos** los registros de un juego tienen la categoría `5`, el juego es **100% digital**.

**Resumen de la lógica para tu código:**

text

```plaintext
SI (game_release_formats contiene "Physical") 
    RETORNAR "Es Físico"
SINO SI (Cualquier release_dates.category == 0 O 1 O 2) Y (release_dates.category NO es 5)
    RETORNAR "Es Físico"
SINO
    RETORNAR "Es Digital"
```

Usa el código con precaución.

 

---

**📌 Notas y Limitaciones a tener en cuenta**

1. **Ediciones limitadas:** Compañías como _Limited Run Games_ o _Super Rare Games_ hacen tiradas físicas muy pequeñas de juegos que nacieron digitales. IGDB suele actualizar estos datos añadiendo una nueva fila en `release_dates` cuando esto ocurre.
2. **Juegos Regionales:** Un juego puede ser digital en Europa (EU) pero haber tenido un disco físico en Japón (JP). Revisa siempre el campo `region` en la API (ID `1` es Europa, ID `2` es Norteamérica, ID `5` es Japón) para saber en qué parte del mundo se puede conseguir físicamente.

---