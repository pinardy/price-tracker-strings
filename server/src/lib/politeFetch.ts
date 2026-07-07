const USER_AGENT = 'price-tracker-violin-strings/0.1 (personal use)';
const HOST_DELAY_MS = 1500;
const TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;

export interface PoliteFetchOptions {
  headers?: Record<string, string>;
}

export type PoliteFetch = (url: string, options?: PoliteFetchOptions) => Promise<Response>;

/**
 * Creates a fetch wrapper that serializes requests per host with a fixed
 * delay between them, identifies itself, and retries 429/5xx with backoff.
 */
export function createPoliteFetch(): PoliteFetch {
  const hostQueues = new Map<string, Promise<unknown>>();

  return async function politeFetch(url, options = {}) {
    const host = new URL(url).host;
    const prev = hostQueues.get(host) ?? Promise.resolve();

    const task = prev
      .catch(() => {}) // one request's failure must not poison the host queue
      .then(async () => {
        const response = await fetchWithRetry(url, options);
        await sleep(HOST_DELAY_MS);
        return response;
      });

    hostQueues.set(host, task);
    return task;
  };
}

async function fetchWithRetry(url: string, options: PoliteFetchOptions): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(2000 * 2 ** (attempt - 1));
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, ...options.headers },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: 'follow',
      });
      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`HTTP ${response.status} for ${url}`);
        continue;
      }
      return response;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
