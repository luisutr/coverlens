import { describe, expect, it } from 'vitest';
import { newGameFieldsFromMetadata, pickBarcodeForSave } from '../services/utils/metadataToGameInput';
import type { MetadataResult } from '../services/providers/types';

const baseResolved: MetadataResult = {
  title: 'Batman Arkham Asylum GOTY Edition',
  platform: 'Xbox 360',
  barcode: '5021290040632',
  publisher: 'Warner',
  status: 'resolved',
  source: 'coverlens',
};

describe('pickBarcodeForSave', () => {
  it('prioriza el código escaneado sobre el del servidor', () => {
    expect(
      pickBarcodeForSave('1111111111111', { barcode: '5021290040632' })
    ).toBe('1111111111111');
  });

  it('usa el barcode de metadatos si no hubo escaneo', () => {
    expect(pickBarcodeForSave(null, { barcode: '5021290040632' })).toBe('5021290040632');
    expect(pickBarcodeForSave(undefined, { barcode: '5021290040632' })).toBe('5021290040632');
  });

  it('devuelve null si no hay barcode en ningún lado', () => {
    expect(pickBarcodeForSave(null, { barcode: null })).toBeNull();
  });
});

describe('newGameFieldsFromMetadata', () => {
  it('incluye barcode y publisher del resolveMetadata en addGame', () => {
    const input = newGameFieldsFromMetadata(baseResolved, { favorite: 1, discOnly: 0 });

    expect(input.barcode).toBe('5021290040632');
    expect(input.publisher).toBe('Warner');
    expect(input.metadataSource).toBe('coverlens');
    expect(input.favorite).toBe(1);
  });
});
