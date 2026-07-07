import { describe, expect, it } from 'vitest';
import { SwStringsProvider } from '../../src/providers/swstrings.js';
import { fakeCtx, fixture } from '../helpers.js';

const provider = new SwStringsProvider();
const storeApiBody = fixture('swstrings-storeapi.json');

describe('SwStringsProvider.search via Store API', () => {
  it('converts minor-unit prices to dollars', async () => {
    const ctx = fakeCtx({ '/wp-json/wc/store/v1/products': storeApiBody });
    const results = await provider.search('dominant violin', ctx);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].price).toBe(5.55); // fixture price "555" with minor unit 2
    expect(results[0].currency).toBe('USD');
    expect(results[0].externalId).toBeTruthy();
  });
});

describe('SwStringsProvider.fetchPrice via JSON-LD fallback', () => {
  const jsonLdPage = `<html><head>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@graph":[
        {"@type":"WebPage","name":"ignore me"},
        {"@type":"Product","name":"Thomastik Dominant Violin Set",
         "offers":{"@type":"Offer","price":"92.50","priceCurrency":"USD",
                   "availability":"https://schema.org/InStock"}}
      ]}
    </script></head><body></body></html>`;

  it('finds the Product node inside @graph', async () => {
    const ctx = fakeCtx({
      '/wp-json/wc/store/v1/products': { status: 404 },
      '/product/dominant': jsonLdPage,
    });
    const result = await provider.fetchPrice(
      {
        providerId: 'swstrings',
        externalId: null,
        variantId: null,
        query: null,
        url: 'https://www.swstrings.com/product/dominant',
      },
      ctx,
    );
    expect(result.price).toBe(92.5);
    expect(result.currency).toBe('USD');
    expect(result.inStock).toBe(true);
  });

  it('throws when no JSON-LD product exists', async () => {
    const ctx = fakeCtx({
      '/wp-json/wc/store/v1/products': { status: 404 },
      '/product/dominant': '<html><body>no structured data</body></html>',
    });
    await expect(
      provider.fetchPrice(
        {
          providerId: 'swstrings',
          externalId: null,
          variantId: null,
          query: null,
          url: 'https://www.swstrings.com/product/dominant',
        },
        ctx,
      ),
    ).rejects.toThrow(/no JSON-LD/);
  });
});
