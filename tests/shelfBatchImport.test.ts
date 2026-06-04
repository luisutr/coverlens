import { describe, expect, it } from 'vitest';
import { parseCatalogImport } from '../services/import/catalogImport';

describe('shelfBatchImport parsing tests', () => {
  it('debe parsear el formato JSON estandar de lote de Gemini con purposed=shelf_batch', () => {
    const json = JSON.stringify({
      app: 'CoverLens',
      formatVersion: 1,
      purpose: 'shelf_batch',
      items: [
        { title: 'The Legend of Zelda: Tears of the Kingdom', platform: 'Nintendo Switch' },
        { title: 'Super Mario Odyssey', platform: 'Nintendo Switch' },
        { title: 'Gears of War', platform: 'Xbox 360' }
      ]
    });
    
    const parsed = parseCatalogImport(json);
    expect(parsed.source).toBe('coverlens');
    expect(parsed.rows).toHaveLength(3);
    expect(parsed.rows[0].title).toBe('The Legend of Zelda: Tears of the Kingdom');
    expect(parsed.rows[0].platform).toBe('Switch');
    expect(parsed.rows[2].title).toBe('Gears of War');
    expect(parsed.rows[2].platform).toBe('Xbox 360');
  });

  it('debe parsear un array de objetos JSON crudo devuelto por Gemini', () => {
    const json = JSON.stringify([
      { title: 'Metroid Dread', platform: 'Nintendo Switch' },
      { title: 'Halo Infinite', platform: 'Xbox Series X|S' }
    ]);
    
    const parsed = parseCatalogImport(json);
    expect(parsed.source).toBe('coverlens');
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0].title).toBe('Metroid Dread');
    expect(parsed.rows[0].platform).toBe('Switch');
    expect(parsed.rows[1].title).toBe('Halo Infinite');
    expect(parsed.rows[1].platform).toBe('Xbox Series X');
  });
  
  it('debe fallar o retornar vacio ante un JSON invalido o estructura incorrecta', () => {
    const json = JSON.stringify({
      somethingElse: 'not_coverlens',
      data: []
    });
    
    const parsed = parseCatalogImport(json);
    expect(parsed.rows).toHaveLength(0);
  });
});
