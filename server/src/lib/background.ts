import { waitUntil } from '@vercel/functions';

/**
 * Fire-and-forget that survives serverless: on Vercel the instance may be
 * frozen right after the response unless the work is registered with
 * waitUntil; locally a detached promise is fine.
 */
export function background(promise: Promise<unknown>): void {
  const guarded = promise.catch((err) => console.error('[background]', err));
  if (process.env.VERCEL) waitUntil(guarded);
}
