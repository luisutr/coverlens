import { getApiCredentials } from './credentialsStore';
import { parseImageWithOcrSpace } from './ocrSpaceApi';

let recognizeText: ((path: string) => Promise<{ text: string }>) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mlkit = require('@infinitered/react-native-mlkit-text-recognition');
  recognizeText = mlkit.recognizeText;
} catch {
  recognizeText = null;
}

export type OcrEngineAvailability = {
  canNative: boolean;
  canCloud: boolean;
  /** Google AI Studio (Gemini Flash); prioridad sobre OCR.space en flujos de lomo/lote. */
  canGemini: boolean;
};

export async function getOcrEngineAvailability(): Promise<OcrEngineAvailability> {
  const creds = await getApiCredentials();
  const canCloud = creds.ocrSpaceApiKey.trim().length > 0;
  const canGemini = creds.geminiApiKey.trim().length > 0;
  return { canNative: Boolean(recognizeText), canCloud, canGemini };
}

/** Texto crudo de la imagen (ML Kit o OCR.space). */
export async function runOcrVisionOnImage(uri: string): Promise<string> {
  const creds = await getApiCredentials();
  const ocrSpaceApiKey = creds.ocrSpaceApiKey.trim();
  const canUseNative = Boolean(recognizeText);
  const canUseCloud = ocrSpaceApiKey.length > 0;
  if (!canUseNative && !canUseCloud) {
    throw new Error('ocr_no_engine');
  }
  if (canUseNative && recognizeText) {
    const native = await recognizeText(uri);
    return native.text ?? '';
  }
  return parseImageWithOcrSpace(uri, ocrSpaceApiKey);
}
