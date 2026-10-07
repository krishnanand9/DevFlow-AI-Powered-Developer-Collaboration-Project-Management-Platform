import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/httpError';
import { verifyAccess } from '../utils/tokens';

declare global {
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return next(new HttpError(401, 'Missing token'));
  try {
    req.userId = verifyAccess(h.slice(7));
    next();
  } catch {
    next(new HttpError(401, 'Invalid or expired token'));
  }
}
