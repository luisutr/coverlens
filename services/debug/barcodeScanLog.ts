/**
 * Log temporal del flujo de escaneo por barcode (visible en Metro / Expo Go).
 * Ring buffer en memoria para depurar resolución de metadatos.
 */

export type BarcodeScanLogEntry = {
  ts: string;
  step: string;
  detail?: Record<string, unknown>;
};

const MAX_ENTRIES = 48;
const entries: BarcodeScanLogEntry[] = [];

export function clearBarcodeScanLog(): void {
  entries.length = 0;
}

export function logBarcodeScan(step: string, detail?: Record<string, unknown>): void {
  const entry: BarcodeScanLogEntry = {
    ts: new Date().toISOString().slice(11, 23),
    step,
    detail,
  };
  entries.unshift(entry);
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
  if (detail && Object.keys(detail).length > 0) {
    console.log(`[CoverLens:BarcodeScan] ${step}`, detail);
  } else {
    console.log(`[CoverLens:BarcodeScan] ${step}`);
  }
}

export function getBarcodeScanLog(): readonly BarcodeScanLogEntry[] {
  return entries;
}

export function formatBarcodeScanLogForDisplay(maxLines = 14): string {
  if (entries.length === 0) return '(sin entradas de log)';
  return entries
    .slice(0, maxLines)
    .map((e) => {
      const d = e.detail ? ` ${JSON.stringify(e.detail)}` : '';
      return `${e.ts} ${e.step}${d}`;
    })
    .join('\n');
}
