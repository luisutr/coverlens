export const SHELF_BATCH_GEMINI_URL = 'https://gemini.google.com/app';

export const SHELF_BATCH_GEMINI_PROMPT = `Eres un asistente que extrae juegos de videojuegos físicos a partir de una FOTO DE LOMOS en una estantería.

Instrucciones:
1. Mira solo los lomos visibles (cantos estrechos con título y a menudo plataforma).
2. Por cada juego detectado, devuelve título comercial en español o inglés (el que se lee mejor) y plataforma/consola.
3. Normaliza plataforma a uno de estos nombres cuando aplique: Nintendo Switch, PlayStation 5, PlayStation 4, PlayStation 3, Xbox Series X|S, Xbox One, Xbox 360, Wii U, Wii, Nintendo 3DS, Nintendo DS, PC, GameCube, Nintendo 64.
4. Si no puedes leer un lomo con confianza, omítelo (no inventes).
5. Si un mismo título aparece dos veces, inclúyelo solo una vez.
6. Responde ÚNICAMENTE con un bloque JSON válido, sin markdown ni explicación.

Formato exacto:
{
  "app": "CoverLens",
  "formatVersion": 1,
  "purpose": "shelf_batch",
  "items": [
    { "title": "Nombre del juego", "platform": "Nintendo Switch" }
  ]
}

Reglas del JSON:
- "items" es un array; cada elemento debe tener "title" y "platform" (strings no vacíos).
- No incluyas comentarios, campos extra ni texto fuera del JSON.`;
