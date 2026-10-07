import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { Notification } from '../models/Notification';
import { ah } from '../utils/asyncHandler';

const r = Router();
r.use(requireAuth);

r.get('/notifications', ah(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const [items, unread] = await Promise.all([
    Notification.find({ user: req.userId }).sort({ createdAt: -1 }).skip((page - 1) * 30).limit(30),
    Notification.countDocuments({ user: req.userId, read: false }),
  ]);
  res.json({ items, unread });
}));
r.post('/notifications/read-all', ah(async (req, res) => {
  await Notification.updateMany({ user: req.userId, read: false }, { read: true });
  res.json({ ok: true });
}));
r.post('/notifications/:id/read', ah(async (req, res) => {
  await Notification.updateOne({ _id: req.params.id, user: req.userId }, { read: true });
  res.json({ ok: true });
}));

export default r;
