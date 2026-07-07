import * as cheerio from 'cheerio';
import { ProviderError } from '../lib/errors.js';
import type { FetchContext, LinkRef, PriceProvider, PriceResult, SearchResult } from './types.js';

interface WcPrices {
  price: string;
  currency_code: string;
  currency_minor_unit: number;
}

interface WcProduct {
  id: number;
  name: string;
  type?: string; // 'simple' | 'variable' | 'variation'
  variation?: string; // attribute summary on variation rows, e.g. "String: Set"
  permalink?: string;
  is_in_stock?: boolean;
  prices?: WcPrices;
  images?: { src: string }[];
}

/** Variable products to expand into variations per search (one request each). */
const EXPAND_LIMIT = 4;

/**
 * Generic provider for WooCommerce shops. Prefers the public Store API
 * (/wp-json/wc/store/v1) and falls back to scraping JSON-LD product schema.
 *
 * Variable products report the MINIMUM of their price range at the parent
 * level (e.g. a lone E string instead of the full set), so search expands
 * them into variations and links store the variation id as externalId —
 * /products/<variationId> then returns the true variant price.
 */
export class WooCommerceProvider implements PriceProvider {
  readonly kind = 'retailer' as const;
  private storeApi: string;

  constructor(
    readonly id: string,
    readonly label: string,
    private baseUrl: string,
    private defaultCurrency = 'USD',
  ) {
    this.storeApi = `${baseUrl}/wp-json/wc/store/v1/products`;
  }

  enabled(): boolean {
    return true;
  }

  async search(query: string, ctx: FetchContext): Promise<SearchResult[]> {
    if (await this.storeApiAvailable(ctx)) {
      const response = await ctx.fetch(`${this.storeApi}?search=${encodeURIComponent(query)}&per_page=25`);
      if (response.ok) {
        const products = (await response.json()) as WcProduct[];
        const results: SearchResult[] = [];
        let expansions = 0;
        for (const product of products) {
          if (product.type === 'variable' && expansions < EXPAND_LIMIT) {
            expansions++;
            const variations = await this.fetchVariations(product.id, ctx);
            if (variations.length) {
              for (const variation of variations) {
                results.push(this.wcToSearchResult(variation, product));
              }
              continue;
            }
          }
          results.push(this.wcToSearchResult(product));
        }
        return results;
      }
    }
    return this.searchViaHtml(query, ctx);
  }

  async fetchPrice(link: LinkRef, ctx: FetchContext): Promise<PriceResult> {
    if (link.externalId && (await this.storeApiAvailable(ctx))) {
      const response = await ctx.fetch(`${this.storeApi}/${link.externalId}`);
      if (response.ok) {
        const product = (await response.json()) as WcProduct;
        const price = wcPrice(product);
        if (price) {
          return {
            price: price.value,
            currency: price.currency,
            inStock: product.is_in_stock ?? null,
            title: joinTitle(product),
          };
        }
      }
    }
    return this.fetchPriceViaJsonLd(link.url, ctx);
  }

  private async fetchVariations(parentId: number, ctx: FetchContext): Promise<WcProduct[]> {
    try {
      const response = await ctx.fetch(`${this.storeApi}?type=variation&parent=${parentId}&per_page=25`);
      if (!response.ok) return [];
      return (await response.json()) as WcProduct[];
    } catch {
      return [];
    }
  }

  private async storeApiAvailable(ctx: FetchContext): Promise<boolean> {
    const cacheKey = `${this.id}:store-api-available`;
    const cached = ctx.cache.get(cacheKey);
    if (cached !== undefined) return cached as boolean;
    let available = false;
    try {
      const response = await ctx.fetch(`${this.storeApi}?per_page=1`);
      available = response.ok && (response.headers.get('content-type') ?? '').includes('json');
    } catch {
      available = false;
    }
    ctx.cache.set(cacheKey, available);
    return available;
  }

  private wcToSearchResult(product: WcProduct, parent?: WcProduct): SearchResult {
    const price = wcPrice(product);
    return {
      providerId: this.id,
      externalId: String(product.id),
      title: stripHtml(joinTitle(product, parent)),
      url: product.permalink ?? parent?.permalink ?? this.baseUrl,
      price: price?.value,
      currency: price?.currency,
      imageUrl: product.images?.[0]?.src ?? parent?.images?.[0]?.src,
    };
  }

  private async searchViaHtml(query: string, ctx: FetchContext): Promise<SearchResult[]> {
    const response = await ctx.fetch(`${this.baseUrl}/?s=${encodeURIComponent(query)}&post_type=product`);
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
      const offer = extractOffer(product);
      if (!offer) continue;
      return {
        price: offer.price,
        currency: offer.currency ?? this.defaultCurrency,
        inStock: offer.availability ? /InStock/i.test(offer.availability) : null,
        title: product.name ? String(product.name) : undefined,
      };
    }
    throw new ProviderError(this.id, `no JSON-LD product price on ${url}`);
  }
}

function joinTitle(product: WcProduct, parent?: WcProduct): string {
  const name = product.name || parent?.name || '';
  return product.variation ? `${name} — ${product.variation}` : name;
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

/**
 * JSON-LD can be a node, an array, or an @graph. Returns a Product node;
 * for ProductGroup (WooCommerce variable products), picks the best variant:
 * in-stock first, then lowest price.
 */
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
  const hasType = (t: string) => type === t || (Array.isArray(type) && type.includes(t));
  if (hasType('ProductGroup') && Array.isArray(node.hasVariant)) {
    return pickBestVariant(node.hasVariant);
  }
  if (hasType('Product')) return node;
  if (node['@graph']) return findProductNode(node['@graph']);
  return null;
}

function pickBestVariant(variants: any[]): any | null {
  const scored = variants
    .map((variant) => ({ variant, offer: extractOffer(variant) }))
    .filter((entry) => entry.offer !== null);
  if (!scored.length) return null;
  scored.sort((a, b) => {
    const aStock = a.offer!.availability && /InStock/i.test(a.offer!.availability) ? 0 : 1;
    const bStock = b.offer!.availability && /InStock/i.test(b.offer!.availability) ? 0 : 1;
    return aStock - bStock || a.offer!.price - b.offer!.price;
  });
  return scored[0].variant;
}

/**
 * Extracts price/currency/availability from a JSON-LD Product node.
 * Handles offers as object or array, and prices nested under
 * priceSpecification (itself object or array) as some WooCommerce
 * SEO plugins emit.
 */
function extractOffer(product: any): { price: number; currency: string | null; availability: string | null } | null {
  const offer = Array.isArray(product?.offers) ? product.offers[0] : product?.offers;
  if (!offer) return null;
  const spec = Array.isArray(offer.priceSpecification) ? offer.priceSpecification[0] : offer.priceSpecification;
  const raw = offer.price ?? offer.lowPrice ?? spec?.price;
  const price = parseFloat(String(raw ?? ''));
  if (!Number.isFinite(price)) return null;
  const currency = offer.priceCurrency ?? spec?.priceCurrency ?? null;
  return {
    price,
    currency: currency ? String(currency) : null,
    availability: offer.availability ? String(offer.availability) : null,
  };
}
