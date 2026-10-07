import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { RefreshToken } from '../models/RefreshToken';
import { User } from '../models/User';
import { ah } from '../utils/asyncHandler';
import { HttpError } from '../utils/httpError';
import { issueRefresh, sha256, signAccess } from '../utils/tokens';

const r = Router();

const registerSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

const publicUser = (u: any) => ({
  id: u._id, name: u.name, email: u.email, avatarUrl: u.avatarUrl, skills: u.skills,
  availability: u.availability, notificationPrefs: u.notificationPrefs,
});

async function session(u: any) {
  return { user: publicUser(u), accessToken: signAccess(String(u._id)), refreshToken: await issueRefresh(String(u._id)) };
}

r.post('/register', validate(registerSchema), ah(async (req, res) => {
  const { name, email, password } = req.body;
  if (await User.findOne({ email })) throw new HttpError(409, 'Email already registered');
  const u = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12) });
  res.status(201).json(await session(u));
}));

r.post('/login', validate(loginSchema), ah(async (req, res) => {
  const u = await User.findOne({ email: req.body.email }).select('+passwordHash');
  if (!u || !(await bcrypt.compare(req.body.password, u.passwordHash))) throw new HttpError(401, 'Invalid credentials');
  res.json(await session(u));
}));

// Refresh-token rotation: each token is single-use. Reuse of a rotated token revokes the whole family.
r.post('/refresh', validate(z.object({ refreshToken: z.string() })), ah(async (req, res) => {
  let payload: any;
  try { payload = jwt.verify(req.body.refreshToken, env.refreshSecret); } catch { throw new HttpError(401, 'Invalid refresh token'); }
  const stored = await RefreshToken.findOne({ tokenHash: sha256(req.body.refreshToken) });
  if (!stored) throw new HttpError(401, 'Invalid refresh token');
  if (stored.revoked) {
    await RefreshToken.updateMany({ family: stored.family }, { revoked: true });
    throw new HttpError(401, 'Refresh token reuse detected');
  }
  stored.revoked = true;
  await stored.save();
  const u = await User.findById(payload.sub);
  if (!u) throw new HttpError(401, 'User no longer exists');
  res.json({ accessToken: signAccess(String(u._id)), refreshToken: await issueRefresh(String(u._id), stored.family) });
}));

r.post('/logout', validate(z.object({ refreshToken: z.string() })), ah(async (req, res) => {
  await RefreshToken.updateMany({ tokenHash: sha256(req.body.refreshToken) }, { revoked: true });
  res.json({ ok: true });
}));

// No email provider is wired up: in development the reset token is logged to the server console.
r.post('/forgot-password', validate(z.object({ email: z.string().email() })), ah(async (req, res) => {
  const u = await User.findOne({ email: req.body.email });
  if (u) {
    const token = crypto.randomBytes(24).toString('hex');
    u.resetTokenHash = sha256(token);
    u.resetExpires = new Date(Date.now() + 3600e3);
    await u.save();
    if (!env.isProd) console.log(`[dev] password reset token for ${u.email}: ${token}`);
  }
  res.json({ ok: true }); // same response either way: no account enumeration
}));

r.post('/reset-password', validate(z.object({ token: z.string(), password: z.string().min(8).max(100) })), ah(async (req, res) => {
  const u = await User.findOne({ resetTokenHash: sha256(req.body.token), resetExpires: { $gt: new Date() } }).select('+resetTokenHash +resetExpires');
  if (!u) throw new HttpError(400, 'Invalid or expired reset token');
  u.passwordHash = await bcrypt.hash(req.body.password, 12);
  u.resetTokenHash = undefined;
  u.resetExpires = undefined;
  await u.save();
  await RefreshToken.updateMany({ user: u._id }, { revoked: true });
  res.json({ ok: true });
}));

r.get('/me', requireAuth, ah(async (req, res) => {
  const u = await User.findById(req.userId);
  if (!u) throw new HttpError(404, 'User not found');
  res.json(publicUser(u));
}));

r.patch('/me', requireAuth, validate(z.object({
  name: z.string().min(1).max(80).optional(),
  avatarUrl: z.string().url().optional(),
  skills: z.array(z.string().max(40)).max(30).optional(),
  availability: z.enum(['available', 'busy', 'away']).optional(),
  notificationPrefs: z.object({ assignments: z.boolean(), mentions: z.boolean(), dueDates: z.boolean() }).partial().optional(),
})), ah(async (req, res) => {
  const u = await User.findByIdAndUpdate(req.userId, { $set: req.body }, { new: true });
  res.json(publicUser(u));
}));

export default r;
