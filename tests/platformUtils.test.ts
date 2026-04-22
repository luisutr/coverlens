import { describe, expect, it } from 'vitest';
import { canonicalizePlatform, splitTitleAndPlatform } from '../services/utils/platformUtils';

describe('platformUtils', () => {
  it('normaliza alias comunes a nombres consistentes', () => {
    expect(canonicalizePlatform('Nintendo GameCube')).toBe('GameCube');
    expect(canonicalizePlatform('PlayStation 4')).toBe('PlayStation 4');
    expect(canonicalizePlatform('Microsoft Windows')).toBe('PC');
    expect(canonicalizePlatform('Super Nintendo')).toBe('SNES');
    expect(canonicalizePlatform('Nintendo Switch')).toBe('Switch');
    expect(canonicalizePlatform('Nintendo Switch 2')).toBe('Switch 2');
  });

  it('mantiene el valor original si no reconoce plataforma', () => {
    expect(canonicalizePlatform('Plataforma Custom XYZ')).toBe('Plataforma Custom XYZ');
  });

  it('no interpreta subcadenas como NES (p. ej. genes)', () => {
    expect(canonicalizePlatform('genes')).toBe('genes');
  });

  it('splitTitleAndPlatform separa título y plataforma al final', () => {
    expect(splitTitleAndPlatform('Gears of War Xbox 360')).toEqual({
      titleHint: 'Gears of War',
      platformHint: 'Xbox 360',
    });
    expect(splitTitleAndPlatform('Stellar Blade PS5')).toEqual({
      titleHint: 'Stellar Blade',
      platformHint: 'PlayStation 5',
    });
  });

  it('splitTitleAndPlatform devuelve todo como título si no hay sufijo conocido', () => {
    expect(splitTitleAndPlatform('Metroid Prime')).toEqual({
      titleHint: 'Metroid Prime',
      platformHint: null,
    });
  });

  it('splitTitleAndPlatform reconoce NES y SNES al final', () => {
    expect(splitTitleAndPlatform('Super Mario Bros NES')).toEqual({
      titleHint: 'Super Mario Bros',
      platformHint: 'NES',
    });
    expect(splitTitleAndPlatform('F-Zero SNES')).toEqual({
      titleHint: 'F-Zero',
      platformHint: 'SNES',
    });
  });
});
