import { describe, expect, it } from 'vitest';
import { mergeMetadataLayers } from '../services/metadataLayerMerge';
import type { MetadataResult } from '../services/providers/types';

describe('mergeMetadataLayers barcode', () => {
  it('conserva barcode de la primera capa y rellena desde la segunda si falta', () => {
    const coverlens: MetadataResult = {
      title: 'Demo',
      platform: 'PS4',
      barcode: '5021290040632',
      publisher: 'Warner',
      status: 'partial',
      source: 'coverlens',
    };
    const gps: MetadataResult = {
      title: 'Demo',
      platform: 'PS4',
      barcode: '9999999999999',
      publisher: null,
      status: 'partial',
      source: 'gameplaystores',
    };

    const merged = mergeMetadataLayers(coverlens, gps);
    expect(merged.barcode).toBe('5021290040632');
    expect(merged.publisher).toBe('Warner');
  });
});
