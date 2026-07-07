import { describe, expect, it } from 'vitest';
import { ShopifyProvider } from '../../src/providers/shopify.js';
import { fakeCtx, fixture } from '../helpers.js';

const provider = new ShopifyProvider('fiddlershop', 'Fiddlershop', 'https://fiddlershop.com', 'USD');
const productJs = fixture('shopify-product.json');

const link = {
  providerId: 'fiddlershop',
  externalId: 'dominant-violin-set',
  variantId: '31569517838387',
  query: null,
  url: 'https://fiddlershop.com/products/dominant-violin-set',
};

describe('ShopifyProvider.fetchPrice', () => {
  it('extracts the chosen variant price in dollars with availability', async () => {
    const ctx = fakeCtx({ '/products/dominant-violin-set.js': productJs });
    const result = await provider.fetchPrice(link, ctx);
    expect(result.price).toBe(84.25);
    expect(result.currency).toBe('USD');
    expect(result.inStock).toBe(true);
    expect(result.title).toContain('Dominant Violin String Set');
  });

  it('throws when the variant has disappeared', async () => {
    const ctx = fakeCtx({ '/products/dominant-violin-set.js': productJs });
    await expect(
      provider.fetchPrice({ ...link, variantId: '999999' }, ctx),
    ).rejects.toThrow(/variant 999999 gone/);
  });

  it('throws on HTTP errors', async () => {
    const ctx = fakeCtx({ '/products/dominant-violin-set.js': { status: 500 } });
    await expect(provider.fetchPrice(link, ctx)).rejects.toThrow(/HTTP 500/);
  });

  it('throws on malformed body', async () => {
    const ctx = fakeCtx({ '/products/dominant-violin-set.js': '{"title":"x"}' });
    await expect(provider.fetchPrice(link, ctx)).rejects.toThrow(/no variants/);
  });
});

describe('ShopifyProvider.search', () => {
  it('expands suggestions into per-variant results', async () => {
    const suggest = JSON.stringify({
      resources: {
        results: {
          products: [{ handle: 'dominant-violin-set', title: 'Thomastik Dominant Violin String Set', price: '84.25' }],
        },
      },
    });
    const ctx = fakeCtx({
      '/search/suggest.json': suggest,
      '/products/dominant-violin-set.js': productJs,
    });
    const results = await provider.search('dominant violin set', ctx);
    expect(results.length).toBeGreaterThan(1);
    expect(results[0]).toMatchObject({
      providerId: 'fiddlershop',
      externalId: 'dominant-violin-set',
      currency: 'USD',
    });
    expect(results[0].variantId).toBeTruthy();
    expect(results[0].title).toMatch(/4\/4/);
  });
});
