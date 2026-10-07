import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { Channel, Message } from '../models/Chat';
import { projectAccess } from '../services/access';
import { ah } from '../utils/asyncHandler';
import { notFound } from '../utils/httpError';

const r = Router();
r.use(requireAuth);

r.get('/projects/:pid/channels', ah(async (req, res) => {
  await projectAccess(req.userId, req.params.pid);
  res.json(await Channel.find({ project: req.params.pid }));
}));

r.get('/channels/:id/messages', ah(async (req, res) => {
  const ch = await Channel.findById(req.params.id);
  if (!ch) throw notFound('Channel');
  await projectAccess(req.userId, String(ch.project));
  const filter: any = { channel: ch._id };
  if (req.query.before) filter.createdAt = { $lt: new Date(String(req.query.before)) };
  const msgs = await Message.find(filter).sort({ createdAt: -1 }).limit(50).populate('sender', 'name avatarUrl');
  res.json(msgs.reverse());
}));

export default r;
