import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { HttpError } from '../utils/httpError';

export const validate = (schema: ZodSchema) => (req: Request, _res: Response, next: NextFunction) => {
  const r = schema.safeParse(req.body);
  if (!r.success) return next(new HttpError(400, 'Validation failed', r.error.flatten().fieldErrors));
  req.body = r.data;
  next();
};
