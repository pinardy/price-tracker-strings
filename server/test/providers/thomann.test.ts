import { describe, expect, it } from 'vitest';
import { ThomannProvider, parsePriceText } from '../../src/providers/thomann.js';
import { fakeCtx, fixture } from '../helpers.js';

const provider = new ThomannProvider();

describe('ThomannProvider.fetchPrice', () => {
  it('reads microdata price and currency from the product page', async () => {
    const ctx = fakeCtx({ 'thomastik_dominant_633628.htm': fixture('thomann-product.html') });
    const result = await provider.fetchPrice(
      {
        providerId: 'thomann',
        externalId: '/intl/thomastik_dominant_633628.htm',
        variantId: null,
        query: null,
        url: 'https://www.thomann.de/intl/thomastik_dominant_633628.htm',
      },
      ctx,
    );
    // Fixture was captured from an SGD-localized viewer; the provider must
    // report the page's own currency, not assume EUR.
    expect(result.price).toBe(63);
    expect(result.currency).toBe('SGD');
    expect(result.title).toContain('Dominant');
  });

  it('throws when no microdata price exists', async () => {
    const ctx = fakeCtx({ 'thomastik_dominant_633628.htm': '<html><body>nope</body></html>' });
    await expect(
      provider.fetchPrice(
        {
          providerId: 'thomann',
          externalId: '/intl/thomastik_dominant_633628.htm',
          variantId: null,
          query: null,
          url: 'https://www.thomann.de/intl/thomastik_dominant_633628.htm',
        },
        ctx,
      ),
    ).rejects.toThrow(/no microdata price/);
  });
});

describe('ThomannProvider.search', () => {
  it('parses result cards with normalized titles and /intl/ paths', async () => {
    const ctx = fakeCtx({ 'search_dir.html': fixture('thomann-search.html') });
    const results = await provider.search('dominant violin', ctx);
    expect(results.length).toBeGreaterThan(5);
    for (const result of results) {
      expect(result.externalId).toMatch(/^\/intl\//);
      expect(result.externalId).not.toContain('?');
      expect(result.title).not.toMatch(/\s{2}/);
      expect(result.url).toMatch(/^https:\/\/www\.thomann\.de\/intl\//);
    }
    expect(results.some((r) => /dominant/i.test(r.title))).toBe(true);
  });
});

describe('parsePriceText', () => {
  it('parses EU format', () => expect(parsePriceText('1.234,56 €')).toBe(1234.56));
  it('parses US format', () => expect(parsePriceText('$1,234.56')).toBe(1234.56));
  it('parses bare integers', () => expect(parsePriceText('63')).toBe(63));
  it('rejects empty strings', () => expect(parsePriceText('  ')).toBeNull());
  it('rejects undefined', () => expect(parsePriceText(undefined)).toBeNull());
});
