/**
 * Validación de códigos de barras GTIN (EAN-8, UPC-A, EAN-13, GTIN-14)
 * para detectar lecturas truncadas o dígito de control incorrecto antes de guardar.
 */

export type BarcodeAssessment =
  | { ok: true }
  | { ok: false; reason: 'bad_checksum' | 'bad_length' | 'non_numeric'; message: string };

const GTIN_LENGTHS = [8, 12, 13, 14] as const;

/** Cuerpo numérico sin dígito de control (GS1). */
export function computeGtinCheckDigit(body: string): number {
  let sum = 0;
  for (let i = body.length - 1, m = 0; i >= 0; i--, m++) {
    const d = parseInt(body[i]!, 10);
    sum += d * (m % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidGtin(code: string): boolean {
  if (!/^\d+$/.test(code)) return false;
  if (!GTIN_LENGTHS.includes(code.length as (typeof GTIN_LENGTHS)[number])) return false;
  const body = code.slice(0, -1);
  const check = parseInt(code[code.length - 1]!, 10);
  return computeGtinCheckDigit(body) === check;
}

/**
 * Evalúa el código tras normalizar (solo dígitos o alfanumérico según escáner).
 * - Solo dígitos, longitud GTIN → debe cumplir checksum.
 * - Solo dígitos, otra longitud → rechazo (posible truncado).
 * - Con letras/símbolos → aviso (Code128, etc.); el llamador puede permitir override.
 */
export function assessBarcode(barcode: string): BarcodeAssessment {
  const b = barcode.trim();
  if (!b) {
    return { ok: false, reason: 'bad_length', message: 'Código vacío.' };
  }

  if (!/^\d+$/.test(b)) {
    return {
      ok: false,
      reason: 'non_numeric',
      message:
        'Este código no es un EAN/UPC numérico estándar. Si es correcto, puedes usarlo igualmente; si no, reescanea o corrígelo.',
    };
  }

  if (!GTIN_LENGTHS.includes(b.length as (typeof GTIN_LENGTHS)[number])) {
    return {
      ok: false,
      reason: 'bad_length',
      message: `El código tiene ${b.length} dígitos; los productos suelen usar 8, 12, 13 o 14 (EAN/UPC). Puede faltar un número o sobrar uno.`,
    };
  }

  if (!isValidGtin(b)) {
    return {
      ok: false,
      reason: 'bad_checksum',
      message:
        'El dígito de control no cuadra con el resto del código. Suele indicar una mala lectura: reescanea o corrige el número.',
    };
  }

  return { ok: true };
}
