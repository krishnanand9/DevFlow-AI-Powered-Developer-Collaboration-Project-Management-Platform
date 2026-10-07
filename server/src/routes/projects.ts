import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { ActivityLog } from '../models/Notification';
import { Channel, Message } from '../models/Chat';
import { Comment } from '../models/Comment';
import { Sprint } from '../models/Sprint';
import { Task } from '../models/Task';
import { canManage, projectAccess } from '../services/access';
import { logActivity } from '../services/notify';
import { ah } from '../utils/asyncHandler';
import { forbidden } from '../utils/httpError';

const r = Router();
r.use(requireAuth);

r.get('/projects/:id', ah(async (req, res) => {
  const { project, role } = await projectAccess(req.userId, req.params.id);
  res.json({ ...project.toObject(), role });
}));

r.patch('/projects/:id', validate(z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  status: z.enum(['active', 'on_hold', 'completed', 'archived']).optional(),
  deadline: z.coerce.date().optional(),
})), ah(async (req, res) => {
  const { project, role } = await projectAccess(req.userId, req.params.id);
  if (!canManage(role)) throw forbidden();
  project.set(req.body);
  await project.save();
  await logActivity({ actor: req.userId, workspace: project.workspace, project: project._id, action: 'project.updated', entity: 'Project', entityId: project._id });
  res.json(project);
}));

r.delete('/projects/:id', ah(async (req, res) => {
  const { project, role } = await projectAccess(req.userId, req.params.id);
  if (role !== 'admin') throw forbidden('Only admins can delete projects');
  const tasks = await Task.find({ project: project._id }, '_id');
  const channels = await Channel.find({ project: project._id }, '_id');
  await Promise.all([
    Comment.deleteMany({ task: { $in: tasks.map((t) => t._id) } }),
    Message.deleteMany({ channel: { $in: channels.map((c) => c._id) } }),
    Channel.deleteMany({ project: project._id }),
    Task.deleteMany({ project: project._id }),
    Sprint.deleteMany({ project: project._id }),
    ActivityLog.deleteMany({ project: project._id }),
  ]);
  await project.deleteOne();
  res.json({ ok: true });
}));

r.get('/projects/:id/activity', ah(async (req, res) => {
  await projectAccess(req.userId, req.params.id);
  res.json(await ActivityLog.find({ project: req.params.id }).sort({ createdAt: -1 }).limit(50).populate('actor', 'name'));
}));

export default r;
