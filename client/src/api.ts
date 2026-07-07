export interface ProviderInfo {
  id: string;
  label: string;
  kind: 'retailer' | 'marketplace';
}

export interface ProductLink {
  id: number;
  product_id: number;
  provider_id: string;
  external_id: string | null;
  variant_id: string | null;
  query: string | null;
  url: string;
  title: string | null;
  is_active: number;
  latest_price: number | null;
  latest_currency: string | null;
  latest_price_sgd: number | null;
  latest_in_stock: number | null;
  latest_scraped_at: string | null;
}

export interface Product {
  id: number;
  name: string;
  instrument: 'violin' | 'viola' | 'cello' | 'bass';
  brand: string | null;
  variant_desc: string | null;
  target_price: number | null;
  target_currency: string;
  is_active: number;
  created_at: string;
  rating_avg: number | null;
  rating_count: number;
  links: ProductLink[];
  lowest: {
    price: number;
    currency: string;
    price_sgd: number | null;
    provider_id: string;
    url: string;
  } | null;
}

export interface SearchResult {
  providerId: string;
  externalId: string | null;
  variantId?: string | null;
  query?: string | null;
  title: string;
  url: string;
  price?: number;
  currency?: string;
  imageUrl?: string;
}

export interface ProviderSearchOutcome {
  providerId: string;
  label: string;
  kind: 'retailer' | 'marketplace';
  results?: SearchResult[];
  error?: string;
}

export interface FetchStatus {
  running: boolean;
  lastRun: {
    id: number;
    trigger: string;
    started_at: string;
    finished_at: string | null;
    ok_count: number;
    error_count: number;
    error_log: string | null;
  } | null;
}

export interface Alert {
  id: number;
  product_id: number;
  product_name: string;
  provider_id: string | null;
  link_url: string | null;
  price: number;
  currency: string;
  target_price: number;
  acknowledged: number;
  created_at: string;
}

export interface Review {
  id: number;
  product_id: number;
  author: string | null;
  rating: number;
  body: string | null;
  created_at: string;
}

export interface HistoryPoint {
  link_id: number;
  provider_id: string;
  price: number;
  currency: string;
  price_sgd: number | null;
  scraped_at: string;
}

/** True in the read-only static build (GitHub Pages) — data comes from exported JSON. */
export const IS_STATIC = import.meta.env.VITE_STATIC === '1';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`${response.status}: ${body || response.statusText}`);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

/** Reads a JSON file exported by `npm run export:static` (static build only). */
function staticData<T>(path: string): Promise<T> {
  return request<T>(`${import.meta.env.BASE_URL}data/${path}`);
}

function readOnly(): never {
  throw new Error('read-only static build');
}

export const api = {
  providers: () =>
    IS_STATIC ? staticData<ProviderInfo[]>('providers.json') : request<ProviderInfo[]>('/api/providers'),
  products: () =>
    IS_STATIC ? staticData<Product[]>('products.json') : request<Product[]>('/api/products'),
  product: (id: number | string) =>
    IS_STATIC
      ? staticData<Omit<Product, 'lowest'>>(`products/${id}.json`)
      : request<Omit<Product, 'lowest'>>(`/api/products/${id}`),
  createProduct: (body: unknown) =>
    IS_STATIC
      ? readOnly()
      : request<{ id: number }>('/api/products', { method: 'POST', body: JSON.stringify(body) }),
  patchProduct: (id: number, body: unknown) =>
    IS_STATIC
      ? readOnly()
      : request<Product>(`/api/products/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteProduct: (id: number) =>
    IS_STATIC ? readOnly() : request<void>(`/api/products/${id}`, { method: 'DELETE' }),
  history: async (id: number | string, days: number) => {
    if (!IS_STATIC) return request<HistoryPoint[]>(`/api/products/${id}/history?days=${days}`);
    // One 365-day export per product; narrower ranges filter locally.
    const rows = await staticData<HistoryPoint[]>(`history/${id}.json`);
    const cutoff = Date.now() - days * 86_400_000;
    return rows.filter((r) => new Date(r.scraped_at + 'Z').getTime() >= cutoff);
  },
  reviews: (productId: number | string) =>
    IS_STATIC
      ? staticData<Review[]>(`reviews/${productId}.json`)
      : request<Review[]>(`/api/products/${productId}/reviews`),
  addReview: (productId: number | string, body: { rating: number; author?: string; body?: string }) =>
    IS_STATIC
      ? readOnly()
      : request<{ id: number }>(`/api/products/${productId}/reviews`, {
          method: 'POST',
          body: JSON.stringify(body),
        }),
  deleteReview: (id: number) =>
    IS_STATIC ? readOnly() : request<void>(`/api/reviews/${id}`, { method: 'DELETE' }),
  addLink: (productId: number | string, link: SearchResult) =>
    IS_STATIC
      ? readOnly()
      : request<{ id: number }>(`/api/products/${productId}/links`, {
          method: 'POST',
          body: JSON.stringify(link),
        }),
  removeLink: (linkId: number) =>
    IS_STATIC ? readOnly() : request<void>(`/api/links/${linkId}`, { method: 'DELETE' }),
  search: (q: string) =>
    IS_STATIC
      ? readOnly()
      : request<ProviderSearchOutcome[]>(`/api/search?q=${encodeURIComponent(q)}`),
  startFetch: () =>
    IS_STATIC ? readOnly() : request<{ status: string }>('/api/fetch', { method: 'POST' }),
  fetchStatus: () =>
    IS_STATIC ? staticData<FetchStatus>('status.json') : request<FetchStatus>('/api/fetch/status'),
  alerts: async (onlyOpen: boolean) => {
    if (!IS_STATIC) return request<Alert[]>(`/api/alerts${onlyOpen ? '?unacknowledged=1' : ''}`);
    const rows = await staticData<Alert[]>('alerts.json');
    return onlyOpen ? rows.filter((a) => !a.acknowledged) : rows;
  },
  ackAlert: (id: number) =>
    IS_STATIC ? readOnly() : request<void>(`/api/alerts/${id}/ack`, { method: 'POST' }),
  ackAllAlerts: () =>
    IS_STATIC ? readOnly() : request<void>('/api/alerts/ack-all', { method: 'POST' }),
};

export const PROVIDER_COLORS: Record<string, string> = {
  fiddlershop: '#2563eb',
  shar: '#d97706',
  thomann: '#0891b2',
  swstrings: '#7c3aed',
  gramercy: '#059669',
  synwin: '#db2777',
  lvl: '#4f46e5',
  reverb: '#dc2626',
};

export function formatPrice(price: number, currency: string): string {
  try {
    // en-SG renders SGD as "S$" and USD as "US$" — unambiguous side by side.
    return new Intl.NumberFormat('en-SG', { style: 'currency', currency }).format(price);
  } catch {
    return `${price.toFixed(2)} ${currency}`;
  }
}

/** SGD-first display: "S$108.98 · US$84.25" for overseas shops, plain "S$85.00" for SGD. */
export function formatDualPrice(priceSgd: number | null, price: number, currency: string): string {
  if (currency === 'SGD' || priceSgd == null) return formatPrice(price, currency);
  return `${formatPrice(priceSgd, 'SGD')} · ${formatPrice(price, currency)}`;
}
