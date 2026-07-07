import { ProviderError } from '../lib/errors.js';
import type { FetchContext, LinkRef, PriceProvider, PriceResult, SearchResult } from './types.js';

const API_URL = 'https://api.reverb.com/api/listings';

interface ReverbListing {
  id: number;
  title: string;
  state?: { slug?: string };
  price?: { amount: string; currency: string };
  _links?: { web?: { href?: string } };
  photos?: { _links?: { small_crop?: { href?: string } } }[];
}

/**
 * Reverb is a marketplace: listings churn, so links store a search query and
 * the tracked price is the lowest live listing for that query ("Reverb low").
 */
export class ReverbProvider implements PriceProvider {
  readonly id = 'reverb';
  readonly label = 'Reverb (marketplace low)';
  readonly kind = 'marketplace' as const;

  enabled(): boolean {
    return Boolean(process.env.REVERB_TOKEN);
  }

  async search(query: string, ctx: FetchContext): Promise<SearchResult[]> {
    const listings = await this.listings(query, ctx);
    return listings.slice(0, 25).map((listing) => ({
      providerId: this.id,
      externalId: null,
      query,
      title: listing.title,
      url: listing._links?.web?.href ?? `https://reverb.com/item/${listing.id}`,
      price: listing.price ? parseFloat(listing.price.amount) : undefined,
      currency: listing.price?.currency,
      imageUrl: listing.photos?.[0]?._links?.small_crop?.href,
    }));
  }

  async fetchPrice(link: LinkRef, ctx: FetchContext): Promise<PriceResult> {
    if (!link.query) throw new ProviderError(this.id, 'link has no stored query');
    const listings = await this.listings(link.query, ctx);

    let lowest: { price: number; currency: string; title: string } | null = null;
    for (const listing of listings) {
      if (!listing.price) continue;
      const price = parseFloat(listing.price.amount);
      if (!Number.isFinite(price)) continue;
      if (!lowest || price < lowest.price) {
        lowest = { price, currency: listing.price.currency, title: listing.title };
      }
    }
    if (!lowest) throw new ProviderError(this.id, `no live listings for "${link.query}"`);
    return { ...lowest, inStock: true };
  }

  private async listings(query: string, ctx: FetchContext): Promise<ReverbListing[]> {
    const url = `${API_URL}?query=${encodeURIComponent(query)}&per_page=50`;
    const response = await ctx.fetch(url, {
      headers: {
        Authorization: `Bearer ${process.env.REVERB_TOKEN}`,
        Accept: 'application/hal+json',
        'Accept-Version': '3.0',
        'Content-Type': 'application/hal+json',
      },
    });
    if (!response.ok) throw new ProviderError(this.id, `HTTP ${response.status} searching "${query}"`);
    const body = (await response.json()) as { listings?: ReverbListing[] };
    return body.listings ?? [];
  }
}
