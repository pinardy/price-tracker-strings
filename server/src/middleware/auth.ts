import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Shared-password gate for the hosted deployment. When APP_PASSWORD is unset
 * (local dev) the gate is disabled. Routes registered before this middleware
 * (health, cron) are unaffected.
 */
export function passwordGate(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return next();
  const got = Buffer.from(req.get('x-app-password') ?? '');
  const want = Buffer.from(expected);
  if (got.length === want.length && timingSafeEqual(got, want)) return next();
  res.status(401).json({ error: 'password required' });
}
