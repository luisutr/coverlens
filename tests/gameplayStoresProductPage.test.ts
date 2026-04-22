import { describe, expect, it } from 'vitest';
import {
  parseGameplayStoresProductPageHtml,
  parseOgImageUrlFromGpsProductHtml,
  resolveGpsProductAbsoluteUrl,
} from '../services/providers/gameplayStoresProductPage';
import { parseGpsEuroPriceString } from '../services/providers/gameplayStoresPriceProvider';

describe('parseGpsEuroPriceString', () => {
  it('entiende comas y apóstrofo como decimal (listado / ficha GPS)', () => {
    expect(parseGpsEuroPriceString('7,95 €')).toEqual({ cents: 795, currency: 'EUR' });
    expect(parseGpsEuroPriceString("29'95 €")).toEqual({ cents: 2995, currency: 'EUR' });
    expect(parseGpsEuroPriceString('29\u201995 €')).toEqual({ cents: 2995, currency: 'EUR' });
  });
});

describe('parseOgImageUrlFromGpsProductHtml', () => {
  it('lee og:image de la ficha', () => {
    const html = '<head><meta property="og:image" content="https://media.gameplaystores.es/1.jpg" /></head>';
    expect(parseOgImageUrlFromGpsProductHtml(html)).toBe('https://media.gameplaystores.es/1.jpg');
  });
});

describe('resolveGpsProductAbsoluteUrl', () => {
  it('normaliza enlaces relativos y //', () => {
    expect(resolveGpsProductAbsoluteUrl({ url: '/juegos-nes/37875-x.html' })).toBe(
      'https://www.gameplaystores.es/juegos-nes/37875-x.html'
    );
    expect(resolveGpsProductAbsoluteUrl({ link: '//www.gameplaystores.es/a.html' })).toBe(
      'https://www.gameplaystores.es/a.html'
    );
  });

  it('construye URL por id_product si faltan enlaces', () => {
    expect(resolveGpsProductAbsoluteUrl({ id_product: 37875 })).toBe(
      'https://www.gameplaystores.es/index.php?id_product=37875&controller=product'
    );
  });
});

describe('parseGameplayStoresProductPageHtml', () => {
  it('extrae descripción, género, año y precio de la ficha HTML', () => {
    const html = `
      <div class="product-sheet-price-display">
        <span class="price-amount-integer">29</span>
        <span class="price-amount-decimal-separator">'</span>
        <span class="price-amount-decimal">95</span>
        <span class="price-currency-sign">€</span>
      </div>
      <dt class="name">Género</dt><dd class="value">Plataforma</dd>
      <dt>Lanzamiento:</dt><dd class="value">15/05/1987</dd>
      <div id="description"><div class="product-description"><div class="rte-content"><p>¿Tienes lo que se necesita para salvar a la Princesa Champiñón?</p>
      <p>Texto largo de descripción del producto en la tienda.</p></div></div></div>
    `;
    const r = parseGameplayStoresProductPageHtml(html);
    expect(r.genre).toBe('Plataforma');
    expect(r.releaseYear).toBe(1987);
    expect(r.priceCents).toBe(2995);
    expect(r.priceCurrency).toBe('EUR');
    expect(r.description).toContain('Princesa Champiñón');
    expect(r.description).toContain('descripción del producto');
  });
});
