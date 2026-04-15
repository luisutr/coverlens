import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

type OcrSpaceParsedResult = {
  ParsedText?: string | null;
  ErrorMessage?: string | string[] | null;
  ErrorDetails?: string | null;
};

type OcrSpaceResponse = {
  OCRExitCode?: number | string;
  IsErroredOnProcessing?: boolean;
  ErrorMessage?: string | string[] | null;
  ErrorDetails?: string | null;
  ProcessingTimeInMilliseconds?: string;
  ParsedResults?: OcrSpaceParsedResult[];
};

const OCR_SPACE_FREE_MAX_BYTES = 950 * 1024;

function normalizeErrorMessage(value: string | string[] | null | undefined): string {
  if (Array.isArray(value)) return value.filter(Boolean).join(' · ').trim();
  return (value ?? '').trim();
}

async function getFileSize(uri: string): Promise<number> {
  const info = (await FileSystem.getInfoAsync(uri)) as { size?: number };
  return typeof info.size === 'number' ? info.size : 0;
}

async function compressForOcrSpace(sourceUri: string): Promise<string> {
  const originalSize = await getFileSize(sourceUri);
  if (originalSize > 0 && originalSize <= OCR_SPACE_FREE_MAX_BYTES) return sourceUri;

  const candidates: Array<{ width: number; compress: number }> = [
    { width: 1600, compress: 0.7 },
    { width: 1400, compress: 0.6 },
    { width: 1280, compress: 0.5 },
    { width: 1152, compress: 0.45 },
    { width: 1024, compress: 0.4 },
    { width: 900, compress: 0.35 },
  ];

  let bestUri = sourceUri;
  let bestSize = originalSize > 0 ? originalSize : Number.MAX_SAFE_INTEGER;

  for (const option of candidates) {
    const out = await manipulateAsync(
      sourceUri,
      [{ resize: { width: option.width } }],
      { compress: option.compress, format: SaveFormat.JPEG }
    );
    const size = await getFileSize(out.uri);
    if (size > 0 && size < bestSize) {
      bestSize = size;
      bestUri = out.uri;
    }
    if (size > 0 && size <= OCR_SPACE_FREE_MAX_BYTES) {
      return out.uri;
    }
  }

  throw new Error(`ocr_space_file_too_large_${bestSize}`);
}

export async function parseImageWithOcrSpace(imageUri: string, apiKey: string): Promise<string> {
  const safeKey = apiKey.trim();
  if (!safeKey) {
    throw new Error('ocr_space_api_key_missing');
  }

  const optimizedUri = await compressForOcrSpace(imageUri);
  const form = new FormData();
  form.append('language', 'spa');
  form.append('OCREngine', '2');
  form.append('detectOrientation', 'true');
  form.append('scale', 'true');
  form.append('isOverlayRequired', 'false');
  form.append('file', {
    uri: optimizedUri,
    name: 'coverlens-ocr.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);

  const response = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    headers: {
      apikey: safeKey,
    },
    body: form,
  });

  if (!response.ok) {
    throw new Error(`ocr_space_http_${response.status}`);
  }

  const data = (await response.json()) as OcrSpaceResponse;
  if (data.IsErroredOnProcessing) {
    const msg = normalizeErrorMessage(data.ErrorMessage);
    const details = (data.ErrorDetails ?? '').trim();
    throw new Error(msg || details || 'ocr_space_processing_error');
  }

  const parsed = (data.ParsedResults ?? [])
    .map((item) => item.ParsedText?.trim() ?? '')
    .filter((line) => line.length > 0)
    .join('\n')
    .trim();

  if (!parsed) {
    const firstErr = data.ParsedResults?.[0];
    const msg = normalizeErrorMessage(firstErr?.ErrorMessage) || normalizeErrorMessage(data.ErrorMessage);
    throw new Error(msg || firstErr?.ErrorDetails || data.ErrorDetails || 'ocr_space_empty_text');
  }

  return parsed;
}
