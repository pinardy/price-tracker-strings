import { describe, expect, it } from 'vitest';
import { WooCommerceProvider } from '../../src/providers/woocommerce.js';
import { fakeCtx, fixture } from '../helpers.js';

const swstrings = new WooCommerceProvider('swstrings', 'Southwest Strings', 'https://www.swstrings.com', 'USD');
const synwin = new WooCommerceProvider('synwin', 'Synwin Music', 'https://www.synwin.com.sg', 'SGD');
const lvl = new WooCommerceProvider('lvl', 'LVL Music Academy', 'https://www.lvlmusicacademy.com', 'SGD');

describe('Store API search (swstrings fixture)', () => {
  it('converts minor-unit prices to dollars', async () => {
    const ctx = fakeCtx({ 'swstrings.com/wp-json/wc/store/v1/products': fixture('swstrings-storeapi.json') });
    const results = await swstrings.search('dominant violin', ctx);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].price).toBe(5.55); // "555" with minor unit 2
    expect(results[0].currency).toBe('USD');
  });
});

describe('variable-product variation expansion (synwin fixtures)', () => {
  it('expands variable parents so the true variant price is tracked, not the range minimum', async () => {
    const parents = JSON.stringify([
      {
        id: 3474,
        name: 'Dominant Violin Strings with Perlon E',
        type: 'variable',
        permalink: 'https://www.synwin.com.sg/product/dominant-violin-strings-with-perlon-e/',
        is_in_stock: true,
        prices: { price: '1482', currency_code: 'SGD', currency_minor_unit: 2 }, // range MIN — the trap
      },
    ]);
    const ctx = fakeCtx({
      'type=variation&parent=3474': fixture('synwin-variations.json'),
      'synwin.com.sg/wp-json/wc/store/v1/products': parents,
    });
    const results = await synwin.search('dominant', ctx);

    const set = results.find((r) => r.title.includes('String: Set'));
    expect(set).toBeDefined();
    expect(set!.externalId).toBe('3475'); // variation id, not parent 3474
    expect(set!.price).toBe(88.84);
    expect(set!.currency).toBe('SGD');
    // no result should carry the parent id — it would report the E-string price
    expect(results.some((r) => r.externalId === '3474')).toBe(false);
  });

  it('fetchPrice on a variation id returns the variant price and stock', async () => {
    const variation = JSON.stringify({
      id: 3475,
      name: 'Dominant Violin Strings with Perlon E',
      variation: 'String: Set',
      is_in_stock: true,
      prices: { price: '8884', currency_code: 'SGD', currency_minor_unit: 2 },
    });
    const ctx = fakeCtx({
      '/wp-json/wc/store/v1/products/3475': variation,
      'synwin.com.sg/wp-json/wc/store/v1/products': '[]',
    });
    const result = await synwin.fetchPrice(
      { providerId: 'synwin', externalId: '3475', variantId: null, query: null, url: 'https://www.synwin.com.sg/product/x' },
      ctx,
    );
    expect(result.price).toBe(88.84);
    expect(result.currency).toBe('SGD');
    expect(result.inStock).toBe(true);
    expect(result.title).toContain('String: Set');
  });
});

describe('JSON-LD fallback', () => {
  const link = (url: string) => ({ providerId: 'x', externalId: null, variantId: null, query: null, url });

  it('reads offers[].priceSpecification (synwin real page)', async () => {
    const ctx = fakeCtx({
      'synwin.com.sg/wp-json/wc/store/v1/products': { status: 404 },
      '/product/dominant-violin-strings-with-perlon-e': fixture('synwin-product.html'),
    });
    const result = await synwin.fetchPrice(
      link('https://www.synwin.com.sg/product/dominant-violin-strings-with-perlon-e/'),
      ctx,
    );
    expect(result.currency).toBe('SGD');
    expect(result.price).toBeGreaterThan(0);
  });

  it('traverses ProductGroup → hasVariant and prefers in-stock lowest (lvl real page)', async () => {
    const ctx = fakeCtx({
      'lvlmusicacademy.com/wp-json/wc/store/v1/products': { status: 404 },
      '/shop/violin-strings/thomastik-dominant-violin-strings': fixture('lvl-productgroup.html'),
    });
    const result = await lvl.fetchPrice(
      link('https://www.lvlmusicacademy.com/shop/violin-strings/thomastik-dominant-violin-strings/'),
      ctx,
    );
    expect(result.currency).toBe('SGD');
    expect(result.price).toBeGreaterThan(0);
    expect(result.inStock).toBe(true);
  });

  it('handles @graph with priceSpecification arrays (synthetic)', async () => {
    const page = `<html><head><script type="application/ld+json">
      {"@graph":[{"@type":"Product","name":"Test Set","offers":[{"@type":"Offer",
        "priceSpecification":[{"price":"114.34","priceCurrency":"SGD"}],
        "availability":"https://schema.org/InStock"}]}]}
    </script></head><body></body></html>`;
    const ctx = fakeCtx({
      'example.com/wp-json': { status: 404 },
      'example.com/product/test': page,
    });
    const provider = new WooCommerceProvider('test', 'Test', 'https://example.com', 'SGD');
    const result = await provider.fetchPrice(link('https://example.com/product/test'), ctx);
    expect(result.price).toBe(114.34);
    expect(result.currency).toBe('SGD');
    expect(result.inStock).toBe(true);
  });

  it('throws when no JSON-LD product exists', async () => {
    const ctx = fakeCtx({
      'swstrings.com/wp-json/wc/store/v1/products': { status: 404 },
      '/product/dominant': '<html><body>no structured data</body></html>',
    });
    await expect(
      swstrings.fetchPrice(link('https://www.swstrings.com/product/dominant'), ctx),
    ).rejects.toThrow(/no JSON-LD/);
  });
});
