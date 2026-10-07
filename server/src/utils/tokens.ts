import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { RefreshToken } from '../models/RefreshToken';

export const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export const signAccess = (userId: string) =>
  jwt.sign({ sub: userId }, env.accessSecret, { expiresIn: '15m' });

export function verifyAccess(token: string): string {
  const p = jwt.verify(token, env.accessSecret) as { sub: string };
  return p.sub;
}

/** Issues a refresh token and stores only its hash (rotation handled in auth routes). */
export async function issueRefresh(userId: string, family?: string) {
  const fam = family || crypto.randomUUID();
  const token = jwt.sign({ sub: userId, fam, jti: crypto.randomUUID() }, env.refreshSecret, { expiresIn: '7d' });
  await RefreshToken.create({
    user: userId,
    family: fam,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + 7 * 864e5),
  });
  return token;
}
