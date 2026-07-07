import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Express 4 doesn't catch async rejections — route them to the error middleware. */
export const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
