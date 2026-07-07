import type { PriceProvider } from './types.js';
import { ShopifyProvider } from './shopify.js';
import { ThomannProvider } from './thomann.js';
import { WooCommerceProvider } from './woocommerce.js';
import { ReverbProvider } from './reverb.js';

// A paid Amazon provider (Rainforest/Keepa) slots in here as one more entry.
const allProviders: PriceProvider[] = [
  new ShopifyProvider('fiddlershop', 'Fiddlershop', 'https://fiddlershop.com', 'USD'),
  new ShopifyProvider('shar', 'Shar Music', 'https://www.sharmusic.com', 'USD'),
  new ShopifyProvider('gramercy', 'Gramercy Music', 'https://gramercy.com.sg', 'SGD'),
  new ThomannProvider(),
  new WooCommerceProvider('swstrings', 'Southwest Strings', 'https://www.swstrings.com', 'USD'),
  new WooCommerceProvider('synwin', 'Synwin Music', 'https://www.synwin.com.sg', 'SGD'),
  new WooCommerceProvider('lvl', 'LVL Music Academy', 'https://www.lvlmusicacademy.com', 'SGD'),
  new ReverbProvider(),
];

export function getProviders(): PriceProvider[] {
  return allProviders.filter((p) => p.enabled());
}

export function getProvider(id: string): PriceProvider | undefined {
  return allProviders.find((p) => p.id === id && p.enabled());
}
