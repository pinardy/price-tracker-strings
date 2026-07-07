import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ReverbProvider } from '../../src/providers/reverb.js';
import { fakeCtx } from '../helpers.js';

const provider = new ReverbProvider();

const listings = JSON.stringify({
  listings: [
    { id: 1, title: 'Dominant 135B set (new)', price: { amount: '99.00', currency: 'USD' } },
    { id: 2, title: 'Dominant 135B set (used)', price: { amount: '45.50', currency: 'USD' } },
    { id: 3, title: 'Dominant set, no price' },
    { id: 4, title: 'Dominant set, bad price', price: { amount: 'oops', currency: 'USD' } },
  ],
});

beforeEach(() => {
  process.env.REVERB_TOKEN = 'test-token';
});
afterEach(() => {
  delete process.env.REVERB_TOKEN;
});

describe('ReverbProvider', () => {
  it('is disabled without a token', () => {
    delete process.env.REVERB_TOKEN;
    expect(provider.enabled()).toBe(false);
  });

  it('fetchPrice returns the lowest live listing price', async () => {
    const ctx = fakeCtx({ 'api.reverb.com/api/listings': listings });
    const result = await provider.fetchPrice(
      { providerId: 'reverb', externalId: null, variantId: null, query: 'dominant 135', url: 'https://reverb.com' },
      ctx,
    );
    expect(result.price).toBe(45.5);
    expect(result.currency).toBe('USD');
    expect(result.title).toContain('used');
  });

  it('fetchPrice throws with no stored query', async () => {
    const ctx = fakeCtx({});
    await expect(
      provider.fetchPrice(
        { providerId: 'reverb', externalId: null, variantId: null, query: null, url: 'https://reverb.com' },
        ctx,
      ),
    ).rejects.toThrow(/no stored query/);
  });

  it('search returns results carrying the query for link storage', async () => {
    const ctx = fakeCtx({ 'api.reverb.com/api/listings': listings });
    const results = await provider.search('dominant 135', ctx);
    expect(results.length).toBe(4);
    expect(results[0].query).toBe('dominant 135');
    expect(results[0].providerId).toBe('reverb');
  });
});
