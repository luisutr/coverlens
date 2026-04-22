import { describe, expect, it } from 'vitest';
import {
  assessBarcode,
  computeGtinCheckDigit,
  isValidGtin,
} from '../services/utils/barcodeValidation';

describe('barcodeValidation', () => {
  it('calcula el dígito de control GTIN-13', () => {
    const body = '400638133393';
    const check = computeGtinCheckDigit(body);
    const full = `${body}${check}`;
    expect(full).toHaveLength(13);
    expect(isValidGtin(full)).toBe(true);
    expect(assessBarcode(full).ok).toBe(true);
  });

  it('rechaza GTIN con checksum incorrecto', () => {
    const body = '400638133393';
    const wrong = `${body}${(computeGtinCheckDigit(body) + 1) % 10}`;
    expect(isValidGtin(wrong)).toBe(false);
    const a = assessBarcode(wrong);
    expect(a.ok).toBe(false);
    if (!a.ok) expect(a.reason).toBe('bad_checksum');
  });

  it('rechaza longitud numérica no estándar', () => {
    const a = assessBarcode('12345');
    expect(a.ok).toBe(false);
    if (!a.ok) expect(a.reason).toBe('bad_length');
  });

  it('marca códigos no solo numéricos', () => {
    const a = assessBarcode('ABC1234567890');
    expect(a.ok).toBe(false);
    if (!a.ok) expect(a.reason).toBe('non_numeric');
  });

  it('acepta UPC-A (12 dígitos) válido', () => {
    const body = '01234567890';
    const check = computeGtinCheckDigit(body);
    const upc = `${body}${check}`;
    expect(upc).toHaveLength(12);
    expect(isValidGtin(upc)).toBe(true);
    expect(assessBarcode(upc).ok).toBe(true);
  });
});
