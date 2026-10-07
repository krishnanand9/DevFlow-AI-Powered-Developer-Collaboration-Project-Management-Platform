import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { Sprint } from '../models/Sprint';
import { Task } from '../models/Task';
import { canManage, projectAccess } from '../services/access';
import { ah } from '../utils/asyncHandler';
import { forbidden, notFound } from '../utils/httpError';

const r = Router();
r.use(requireAuth);

const sprintSchema = z.object({
  name: z.string().min(1).max(100),
  goal: z.string().max(500).optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  status: z.enum(['planned', 'active', 'completed']).optional(),
}).refine((s) => s.endDate > s.startDate, { message: 'endDate must be after startDate' });

r.get('/projects/:pid/sprints', ah(async (req, res) => {
  await projectAccess(req.userId, req.params.pid);
  res.json(await Sprint.find({ project: req.params.pid }).sort({ startDate: -1 }));
}));

r.post('/projects/:pid/sprints', validate(sprintSchema), ah(async (req, res) => {
  const { role } = await projectAccess(req.userId, req.params.pid);
  if (!canManage(role)) throw forbidden();
  res.status(201).json(await Sprint.create({ ...req.body, project: req.params.pid }));
}));

r.patch('/sprints/:id', validate(z.object({
  name: z.string().min(1).max(100).optional(), goal: z.string().max(500).optional(),
  status: z.enum(['planned', 'active', 'completed']).optional(),
  startDate: z.coerce.date().optional(), endDate: z.coerce.date().optional(),
})), ah(async (req, res) => {
  const s = await Sprint.findById(req.params.id);
  if (!s) throw notFound('Sprint');
  const { role } = await projectAccess(req.userId, String(s.project));
  if (!canManage(role)) throw forbidden();
  s.set(req.body);
  await s.save();
  res.json(s);
}));

/** Burndown computed from real task data: remaining open tasks at the end of each day of the sprint. */
r.get('/sprints/:id/burndown', ah(async (req, res) => {
  const s = await Sprint.findById(req.params.id);
  if (!s) throw notFound('Sprint');
  await projectAccess(req.userId, String(s.project));
  const tasks = await Task.find({ sprint: s._id }, 'createdAt completedAt status');
  const total = tasks.length;
  const points: { date: string; remaining: number; ideal: number }[] = [];
  const days = Math.max(1, Math.ceil((+s.endDate - +s.startDate) / 864e5));
  const today = Date.now();
  for (let i = 0; i <= days; i++) {
    const d = new Date(+s.startDate + i * 864e5);
    const eod = +d + 864e5 - 1;
    if (+d > today && i > 0) break;
    const done = tasks.filter((t) => t.completedAt && +t.completedAt <= eod).length;
    points.push({ date: d.toISOString().slice(0, 10), remaining: total - done, ideal: Math.round(total * (1 - i / days) * 10) / 10 });
  }
  res.json({ total, completed: tasks.filter((t) => t.status === 'done').length, points });
}));

export default r;
