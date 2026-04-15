import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

/** Modelos Flash (cuenta Google AI Studio gratuita; sin Gemini Pro). */
const MODEL_CANDIDATES = ['gemini-2.0-flash', 'gemini-1.5-flash'] as const;

export type GeminiShelfGame = {
  title: string;
  platform: string;
  confidence: number;
};

async function imageToJpegBase64(uri: string): Promise<{ mimeType: string; data: string }> {
  const out = await manipulateAsync(uri, [{ resize: { width: 1400 } }], {
    compress: 0.68,
    format: SaveFormat.JPEG,
  });
  const data = await FileSystem.readAsStringAsync(out.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return { mimeType: 'image/jpeg', data };
}

async function generateContentJson(
  apiKey: string,
  model: string,
  parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.12,
        responseMimeType: 'application/json',
      },
    }),
  });
  const raw = await res.text();
  if (!res.ok) {
    let msg = raw.slice(0, 240);
    try {
      const j = JSON.parse(raw) as { error?: { message?: string; status?: string } };
      msg = j.error?.message ?? msg;
    } catch {
      /* ignore */
    }
    throw new Error(`gemini_http_${res.status}: ${msg}`);
  }
  const data = JSON.parse(raw) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
    promptFeedback?: { blockReason?: string };
    error?: { message?: string };
  };
  if (data.error?.message) throw new Error(data.error.message);
  if (!data.candidates?.length) {
    const br = data.promptFeedback?.blockReason ?? 'unknown';
    throw new Error(`gemini_blocked:${br}`);
  }
  const text = data.candidates[0]?.content?.parts?.[0]?.text;
  if (!text || typeof text !== 'string') throw new Error('gemini_empty_response');
  return text;
}

function parseJsonObject<T>(raw: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(cleaned) as T;
}

/**
 * Foto de estantería (varios lomos): devuelve candidatos con título y plataforma.
 * Pensado para API key gratuita de Google AI Studio (modelos Flash).
 */
export async function extractShelfGamesWithGemini(imageUri: string, apiKey: string): Promise<GeminiShelfGame[]> {
  const key = apiKey.trim();
  if (!key) throw new Error('gemini_api_key_missing');

  const { mimeType, data } = await imageToJpegBase64(imageUri);
  const prompt = `You are helping catalog video games from a photo of game box SPINES on a shelf (vertical text, possibly multiple rows or slight blur).
Return ONLY a JSON object (no markdown fences) exactly in this shape:
{"games":[{"title":"string","platform":"string","confidence":number}]}

Rules:
- Each entry is ONE game a collector could add to a library.
- "title": text as on the spine (any language on the box). Do NOT use marketing lines alone (e.g. "ONLY ON PLAYSTATION", "DAY ONE EDITION") as titles.
- "platform": short token if visible or clearly implied (PS4, PS5, Xbox One, Xbox 360, Switch, Wii, Wii U, 3DS, PC, Vita, etc.). Use "" if unknown.
- "confidence": integer 0-100 for that row.
- Reading order: roughly left-to-right / top-to-bottom as in the photo.
- Remove duplicates (same title + same platform).
- At most 30 games.`;

  let lastErr: Error = new Error('gemini_all_models_failed');
  for (const model of MODEL_CANDIDATES) {
    try {
      const jsonText = await generateContentJson(key, model, [
        { text: prompt },
        { inlineData: { mimeType, data } },
      ]);
      const parsed = parseJsonObject<{
        games?: Array<{ title?: string; platform?: string; confidence?: number }>;
      }>(jsonText);
      const games = Array.isArray(parsed.games) ? parsed.games : [];
      const out: GeminiShelfGame[] = [];
      for (const g of games) {
        const title = String(g.title ?? '').trim();
        const platform = String(g.platform ?? '').trim();
        let c = 72;
        if (typeof g.confidence === 'number' && !Number.isNaN(g.confidence)) {
          c = Math.min(100, Math.max(0, Math.round(g.confidence)));
        }
        if (title.length < 2) continue;
        out.push({ title, platform, confidence: c });
      }
      if (out.length === 0) throw new Error('gemini_no_games');
      return out;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      const m = lastErr.message;
      if (m.includes('404') || m.includes('NOT_FOUND') || m.includes('not found')) continue;
      throw lastErr;
    }
  }
  throw lastErr;
}

/** Un solo lomo: título + plataforma vía visión. */
export async function extractSingleLomoWithGemini(
  imageUri: string,
  apiKey: string
): Promise<{ title: string; platform: string; rawText: string; confidence: number }> {
  const key = apiKey.trim();
  if (!key) throw new Error('gemini_api_key_missing');

  const { mimeType, data } = await imageToJpegBase64(imageUri);
  const prompt = `Photo of ONE physical video game box SPINE (narrow side with title text).
Return ONLY JSON (no markdown) exactly:
{"title":"string","platform":"string","confidence":number}
- platform: short token if readable (PS4, PS5, Switch, Xbox 360, etc.) else "".
- confidence: 0-100.`;

  let lastErr: Error = new Error('gemini_all_models_failed');
  for (const model of MODEL_CANDIDATES) {
    try {
      const jsonText = await generateContentJson(key, model, [
        { text: prompt },
        { inlineData: { mimeType, data } },
      ]);
      const parsed = parseJsonObject<{
        title?: string;
        platform?: string;
        confidence?: number;
      }>(jsonText);
      const title = String(parsed.title ?? '').trim();
      const platform = String(parsed.platform ?? '').trim();
      let c = 80;
      if (typeof parsed.confidence === 'number' && !Number.isNaN(parsed.confidence)) {
        c = Math.min(100, Math.max(0, Math.round(parsed.confidence)));
      }
      if (title.length < 2) throw new Error('gemini_no_title');
      return { title, platform, rawText: jsonText.slice(0, 1200), confidence: c };
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      const m = lastErr.message;
      if (m.includes('404') || m.includes('NOT_FOUND') || m.includes('not found')) continue;
      throw lastErr;
    }
  }
  throw lastErr;
}
