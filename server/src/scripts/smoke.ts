import 'dotenv/config';
import { createPoliteFetch } from '../lib/politeFetch.js';
import { getProviders } from '../providers/registry.js';
import type { FetchContext, LinkRef } from '../providers/types.js';

// One live search + one live price fetch per enabled provider.
// Respects politeFetch spacing; run manually, not in CI.
const KNOWN_LINKS: Record<string, LinkRef> = {
  fiddlershop: {
    providerId: 'fiddlershop',
    externalId: 'dominant-violin-set',
    variantId: '31569517838387',
    query: null,
    url: 'https://fiddlershop.com/products/dominant-violin-set',
  },
  shar: {
    providerId: 'shar',
    externalId: 'thomastik-dominant-violin-set-ball-e-4-4-medium',
    variantId: '45603396485351',
    query: null,
    url: 'https://www.sharmusic.com/products/thomastik-dominant-violin-set-ball-e-4-4-medium',
  },
  thomann: {
    providerId: 'thomann',
    externalId: '/intl/thomastik_dominant_633628.htm',
    variantId: null,
    query: null,
    url: 'https://www.thomann.de/intl/thomastik_dominant_633628.htm',
  },
  swstrings: {
    providerId: 'swstrings',
    externalId: null,
    variantId: null,
    query: null,
    // resolved during the smoke run from search results
    url: '',
  },
  reverb: {
    providerId: 'reverb',
    externalId: null,
    variantId: null,
    query: 'thomastik dominant violin strings 135',
    url: 'https://reverb.com',
  },
};

const ctx: FetchContext = { fetch: createPoliteFetch(), cache: new Map() };

for (const provider of getProviders()) {
  console.log(`\n=== ${provider.id} (${provider.label}) ===`);
  try {
    const results = await provider.search('dominant violin', ctx);
    console.log(`search: ${results.length} results`);
    for (const r of results.slice(0, 3)) {
      console.log(`  - ${r.title} | ${r.price ?? '?'} ${r.currency ?? ''} | ${r.url}`);
    }

    let link = KNOWN_LINKS[provider.id];
    if (provider.id === 'swstrings') {
      const first = results.find((r) => r.url);
      if (!first) throw new Error('no search result to fetch');
      link = { ...link, externalId: first.externalId, url: first.url };
    }
    const price = await provider.fetchPrice(link, ctx);
    console.log(`fetchPrice: ${price.price} ${price.currency} inStock=${price.inStock} (${price.title ?? 'no title'})`);
  } catch (err) {
    console.error(`FAILED: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  }
}
