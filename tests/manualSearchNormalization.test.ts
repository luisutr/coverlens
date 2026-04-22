import { describe, expect, it } from 'vitest';
import {
  canonicalizePlatform,
  cleanTitleRetailNoise,
  normalizeManualGameSearch,
  splitTitleAndPlatform,
} from '../services/utils/platformUtils';

describe('normalizeManualGameSearch', () => {
  it('colapsa espacios y normaliza guiones y comas', () => {
    expect(normalizeManualGameSearch('  Halo   3  ')).toBe('Halo 3');
    expect(normalizeManualGameSearch('Zelda – Switch')).toBe('Zelda Switch');
    expect(normalizeManualGameSearch('God of War, PS4')).toBe('God of War PS4');
  });
});

describe('cleanTitleRetailNoise', () => {
  it('elimina palabras de anuncio sin romper el título', () => {
    expect(cleanTitleRetailNoise('mario bro caja')).toBe('mario bro');
    expect(cleanTitleRetailNoise('Metroid CIB')).toBe('Metroid');
    expect(cleanTitleRetailNoise('Castlevania PAL')).toBe('Castlevania');
  });
});

describe('canonicalizePlatform (tokens cortos sin falsos positivos)', () => {
  it('no confunde subcadenas con la plataforma NES', () => {
    expect(canonicalizePlatform('genes')).toBe('genes');
    expect(canonicalizePlatform('business')).toBe('business');
  });
});

describe('splitTitleAndPlatform — casos de usuario reales', () => {
  it('variantes NES / Nintendo NES y ruido «caja»', () => {
    expect(splitTitleAndPlatform('Super Mario Bros 3 NES')).toEqual({
      titleHint: 'Super Mario Bros 3',
      platformHint: 'NES',
    });
    expect(splitTitleAndPlatform('mario bro caja nes')).toEqual({
      titleHint: 'mario bro',
      platformHint: 'NES',
    });
    expect(splitTitleAndPlatform('Zelda nintendo nes')).toEqual({
      titleHint: 'Zelda',
      platformHint: 'NES',
    });
  });

  it('Xbox 360 explícito o solo «360» al final', () => {
    expect(splitTitleAndPlatform('Gears of War xbox 360')).toEqual({
      titleHint: 'Gears of War',
      platformHint: 'Xbox 360',
    });
    expect(splitTitleAndPlatform('Halo 3 360')).toEqual({
      titleHint: 'Halo 3',
      platformHint: 'Xbox 360',
    });
    expect(splitTitleAndPlatform('Call of Duty Black Ops, 360')).toEqual({
      titleHint: 'Call of Duty Black Ops',
      platformHint: 'Xbox 360',
    });
  });

  it('PlayStation y Nintendo Switch', () => {
    expect(splitTitleAndPlatform('Bloodborne PS4')).toEqual({
      titleHint: 'Bloodborne',
      platformHint: 'PlayStation 4',
    });
    expect(splitTitleAndPlatform('Zelda BOTW Switch')).toEqual({
      titleHint: 'Zelda BOTW',
      platformHint: 'Switch',
    });
    expect(splitTitleAndPlatform('Mario Kart 8 Deluxe nintendo switch')).toEqual({
      titleHint: 'Mario Kart 8 Deluxe',
      platformHint: 'Switch',
    });
  });

  it('SNES y GameCube', () => {
    expect(splitTitleAndPlatform('Chrono Trigger SNES')).toEqual({
      titleHint: 'Chrono Trigger',
      platformHint: 'SNES',
    });
    expect(splitTitleAndPlatform('Resident Evil 4 GameCube')).toEqual({
      titleHint: 'Resident Evil 4',
      platformHint: 'GameCube',
    });
  });

  it('PC y portátiles', () => {
    expect(splitTitleAndPlatform('Half-Life 2 PC')).toEqual({
      titleHint: 'Half-Life 2',
      platformHint: 'PC',
    });
    expect(splitTitleAndPlatform('Pokemon Ruby GBA')).toEqual({
      titleHint: 'Pokemon Ruby',
      platformHint: 'Game Boy Advance',
    });
  });

  it('sin sufijo reconocible: todo va al título', () => {
    expect(splitTitleAndPlatform('Metroid Prime 4')).toEqual({
      titleHint: 'Metroid Prime 4',
      platformHint: null,
    });
  });
});
