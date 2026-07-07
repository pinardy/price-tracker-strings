import type { PoliteFetch } from '../lib/politeFetch.js';

export interface SearchResult {
  providerId: string;
  externalId: string | null;
  variantId?: string | null;
  /** Marketplace providers (reverb) return the query to store instead of a fixed listing. */
  query?: string | null;
  title: string;
  url: string;
  price?: number;
  currency?: string;
  imageUrl?: string;
}

export interface PriceResult {
  price: number;
  currency: string;
  inStock: boolean | null;
  /** Current source title, used to warn when a link drifts to a different product. */
  title?: string;
}

export interface LinkRef {
  providerId: string;
  externalId: string | null;
  variantId: string | null;
  query: string | null;
  url: string;
}

export interface FetchContext {
  fetch: PoliteFetch;
  /** Per-run cache, e.g. full Shopify catalogs keyed by host. */
  cache: Map<string, unknown>;
}

export interface PriceProvider {
  id: string;
  label: string;
  kind: 'retailer' | 'marketplace';
  enabled(): boolean;
  search(query: string, ctx: FetchContext): Promise<SearchResult[]>;
  fetchPrice(link: LinkRef, ctx: FetchContext): Promise<PriceResult>;
}
