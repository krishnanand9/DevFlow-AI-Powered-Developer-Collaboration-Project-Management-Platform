import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/httpError';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, details: err.details });
  if (err?.name === 'CastError') return res.status(400).json({ error: 'Invalid id' });
  if (err?.code === 11000) return res.status(409).json({ error: 'Already exists' });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}
