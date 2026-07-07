import type { PriceProvider } from './types.js';
import { ShopifyProvider } from './shopify.js';
import { ThomannProvider } from './thomann.js';
import { SwStringsProvider } from './swstrings.js';
import { ReverbProvider } from './reverb.js';

// A paid Amazon provider (Rainforest/Keepa) slots in here as one more entry.
const allProviders: PriceProvider[] = [
  new ShopifyProvider('fiddlershop', 'Fiddlershop', 'https://fiddlershop.com', 'USD'),
  new ShopifyProvider('shar', 'Shar Music', 'https://www.sharmusic.com', 'USD'),
  new ThomannProvider(),
  new SwStringsProvider(),
  new ReverbProvider(),
];

export function getProviders(): PriceProvider[] {
  return allProviders.filter((p) => p.enabled());
}

export function getProvider(id: string): PriceProvider | undefined {
  return allProviders.find((p) => p.id === id && p.enabled());
}
