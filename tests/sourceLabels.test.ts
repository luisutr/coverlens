import { describe, expect, it } from 'vitest';
import {
  formatCoverProviderLabel,
  formatMetadataSourceLabel,
  formatValueSourceLabel,
  inferImageSourceLabel,
  resolveImageSourceUrl,
  resolveMetadataSourceUrl,
} from '../services/utils/sourceLabels';

describe('sourceLabels', () => {
  it('identifica CoverLens Resource por host cholloweb', () => {
    const url = 'https://covers.cholloweb.es/covers/switch/mario-kart-8-deluxe.jpg';
    expect(inferImageSourceLabel(url)).toBe('CoverLens Resource');
    expect(resolveImageSourceUrl(url)).toBe('https://covers.cholloweb.es/');
  });

  it('formatea metadataSource coverlens con etiqueta legible', () => {
    expect(formatMetadataSourceLabel('coverlens')).toBe('CoverLens Resource');
    expect(resolveMetadataSourceUrl('coverlens')).toBe('https://covers.cholloweb.es/');
  });

  it('formatea provider id de portada devuelto por la cadena', () => {
    expect(formatCoverProviderLabel('coverlens')).toBe('CoverLens Resource');
    expect(formatCoverProviderLabel('gameplaystores')).toBe('GameplayStores');
  });

  it('formatea valor con las mismas etiquetas que Ajustes', () => {
    expect(formatValueSourceLabel('coverlens')).toBe('CoverLens Resource (EUR)');
    expect(formatValueSourceLabel('manual')).toBe('Manual');
  });
});
