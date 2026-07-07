import * as cheerio from 'cheerio';
import { ProviderError } from '../lib/errors.js';
import type { FetchContext, LinkRef, PriceProvider, PriceResult, SearchResult } from './types.js';

const BASE_URL = 'https://www.swstrings.com';
const STORE_API = `${BASE_URL}/wp-json/wc/store/v1/products`;
const PROBE_CACHE_KEY = 'swstrings:store-api-available';

interface WcProduct {
  id: number;
  name: string;
  permalink: string;
  is_in_stock?: boolean;
  prices?: {
    price: string;
    currency_code: string;
    currency_minor_unit: number;
  };
  images?: { src: string }[];
}

/**
 * Southwest Strings runs WooCommerce. Preferred path is the public Store API;
 * if it's closed, fall back to scraping JSON-LD product schema from pages.
 */
export class SwStringsProvider implements PriceProvider {
  readonly id = 'swstrings';
  readonly label = 'Southwest Strings';
  readonly kind = 'retailer' as const;

  enabled(): boolean {
    return true;
  }

  async search(query: string, ctx: FetchContext): Promise<SearchResult[]> {
    if (await this.storeApiAvailable(ctx)) {
      const response = await ctx.fetch(`${STORE_API}?search=${encodeURIComponent(query)}&per_page=25`);
      if (response.ok) {
        const products = (await response.json()) as WcProduct[];
        return products.map((p) => this.wcToSearchResult(p)).filter((r): r is SearchResult => r !== null);
      }
    }
    return this.searchViaHtml(query, ctx);
  }

  async fetchPrice(link: LinkRef, ctx: FetchContext): Promise<PriceResult> {
    if (link.externalId && (await this.storeApiAvailable(ctx))) {
      const response = await ctx.fetch(`${STORE_API}/${link.externalId}`);
      if (response.ok) {
        const product = (await response.json()) as WcProduct;
        const price = wcPrice(product);
        if (price) {
          return {
            price: price.value,
            currency: price.currency,
            inStock: product.is_in_stock ?? null,
            title: product.name,
          };
        }
      }
    }
    return this.fetchPriceViaJsonLd(link.url, ctx);
  }

  private async storeApiAvailable(ctx: FetchContext): Promise<boolean> {
    const cached = ctx.cache.get(PROBE_CACHE_KEY);
    if (cached !== undefined) return cached as boolean;
    let available = false;
    try {
      const response = await ctx.fetch(`${STORE_API}?per_page=1`);
      available = response.ok && (response.headers.get('content-type') ?? '').includes('json');
    } catch {
      available = false;
    }
    ctx.cache.set(PROBE_CACHE_KEY, available);
    return available;
  }

  private wcToSearchResult(p: WcProduct): SearchResult | null {
    const price = wcPrice(p);
    return {
      providerId: this.id,
      externalId: String(p.id),
      title: stripHtml(p.name),
      url: p.permalink,
      price: price?.value,
      currency: price?.currency,
      imageUrl: p.images?.[0]?.src,
    };
  }

  private async searchViaHtml(query: string, ctx: FetchContext): Promise<SearchResult[]> {
    const response = await ctx.fetch(`${BASE_URL}/?s=${encodeURIComponent(query)}&post_type=product`);
    if (!response.ok) throw new ProviderError(this.id, `search HTTP ${response.status}`);
    const $ = cheerio.load(await response.text());
    const results: SearchResult[] = [];
    $('li.product, .product').each((_, el) => {
      const $el = $(el);
      const link = $el.find('a[href*="/product/"], a.woocommerce-LoopProduct-link').first();
      const href = link.attr('href');
      const title = $el.find('.woocommerce-loop-product__title, h2, h3').first().text().trim();
      if (!href || !title) return;
      results.push({
        providerId: this.id,
        externalId: null,
        title,
        url: href,
        imageUrl: $el.find('img').first().attr('src') ?? undefined,
      });
    });
    return results.slice(0, 25);
  }

  private async fetchPriceViaJsonLd(url: string, ctx: FetchContext): Promise<PriceResult> {
    const response = await ctx.fetch(url);
    if (!response.ok) throw new ProviderError(this.id, `HTTP ${response.status} for ${url}`);
    const $ = cheerio.load(await response.text());

    for (const el of $('script[type="application/ld+json"]').toArray()) {
      const parsed = tryParseJson($(el).text());
      if (!parsed) continue;
      const product = findProductNode(parsed);
      if (!product) continue;
      const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
      const price = parseFloat(String(offer?.price ?? offer?.lowPrice ?? ''));
      if (!Number.isFinite(price)) continue;
      return {
        price,
        currency: String(offer?.priceCurrency ?? 'USD'),
        inStock: offer?.availability ? /InStock/i.test(String(offer.availability)) : null,
        title: product.name ? String(product.name) : undefined,
      };
    }
    throw new ProviderError(this.id, `no JSON-LD product price on ${url}`);
  }
}

function wcPrice(p: WcProduct): { value: number; currency: string } | null {
  if (!p.prices?.price) return null;
  const minor = p.prices.currency_minor_unit ?? 2;
  const value = parseInt(p.prices.price, 10) / 10 ** minor;
  if (!Number.isFinite(value)) return null;
  return { value, currency: p.prices.currency_code || 'USD' };
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim();
}

function tryParseJson(text: string): any | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** JSON-LD can be a node, an array, or an @graph — find the Product node. */
function findProductNode(node: any): any | null {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findProductNode(item);
      if (found) return found;
    }
    return null;
  }
  const type = node['@type'];
  if (type === 'Product' || (Array.isArray(type) && type.includes('Product'))) return node;
  if (node['@graph']) return findProductNode(node['@graph']);
  return null;
}
