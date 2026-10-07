import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { Project } from '../models/Project';
import { Channel } from '../models/Chat';
import { ROLES, Workspace, WorkspaceMember } from '../models/Workspace';
import { User } from '../models/User';
import { canManage, canWrite, workspaceRole } from '../services/access';
import { logActivity, notify } from '../services/notify';
import { ah } from '../utils/asyncHandler';
import { HttpError, forbidden } from '../utils/httpError';

const r = Router();
r.use(requireAuth);

r.post('/workspaces', validate(z.object({ name: z.string().min(1).max(80) })), ah(async (req, res) => {
  const ws = await Workspace.create({ name: req.body.name, owner: req.userId });
  await WorkspaceMember.create({ workspace: ws._id, user: req.userId, role: 'admin' });
  res.status(201).json(ws);
}));

r.get('/workspaces', ah(async (req, res) => {
  const memberships = await WorkspaceMember.find({ user: req.userId }).populate('workspace');
  res.json(memberships.map((m) => ({ ...(m.workspace as any).toObject(), role: m.role })));
}));

r.get('/workspaces/:id/members', ah(async (req, res) => {
  await workspaceRole(req.userId, req.params.id);
  const members = await WorkspaceMember.find({ workspace: req.params.id }).populate('user', 'name email avatarUrl skills availability');
  res.json(members);
}));

// Simplified invitation: the invitee must already have an account; they are added immediately and notified.
r.post('/workspaces/:id/members', validate(z.object({ email: z.string().email(), role: z.enum(ROLES).default('developer') })), ah(async (req, res) => {
  const role = await workspaceRole(req.userId, req.params.id);
  if (!canManage(role)) throw forbidden('Only admins and project managers can invite');
  if (req.body.role === 'admin' && role !== 'admin') throw forbidden('Only admins can grant admin');
  const invitee = await User.findOne({ email: req.body.email });
  if (!invitee) throw new HttpError(404, 'No registered user with that email');
  const m = await WorkspaceMember.findOneAndUpdate(
    { workspace: req.params.id, user: invitee._id },
    { $setOnInsert: { role: req.body.role } },
    { upsert: true, new: true }
  );
  const ws = await Workspace.findById(req.params.id);
  await notify(String(invitee._id), 'invite', `You were added to workspace "${ws?.name}"`, '/');
  res.status(201).json(m);
}));

r.patch('/workspaces/:id/members/:userId', validate(z.object({ role: z.enum(ROLES) })), ah(async (req, res) => {
  if ((await workspaceRole(req.userId, req.params.id)) !== 'admin') throw forbidden('Admins only');
  const ws = await Workspace.findById(req.params.id);
  if (ws && String(ws.owner) === req.params.userId) throw new HttpError(400, 'Cannot change the owner role');
  const m = await WorkspaceMember.findOneAndUpdate({ workspace: req.params.id, user: req.params.userId }, { role: req.body.role }, { new: true });
  if (!m) throw new HttpError(404, 'Member not found');
  res.json(m);
}));

const projectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  status: z.enum(['active', 'on_hold', 'completed', 'archived']).optional(),
  deadline: z.coerce.date().optional(),
});

r.post('/workspaces/:id/projects', validate(projectSchema), ah(async (req, res) => {
  const role = await workspaceRole(req.userId, req.params.id);
  if (!canManage(role)) throw forbidden('Only admins and project managers can create projects');
  const p = await Project.create({ ...req.body, workspace: req.params.id, createdBy: req.userId });
  await Channel.create({ project: p._id, name: 'general' });
  await logActivity({ actor: req.userId, workspace: req.params.id, project: p._id, action: 'project.created', entity: 'Project', entityId: p._id });
  res.status(201).json(p);
}));

r.get('/workspaces/:id/projects', ah(async (req, res) => {
  await workspaceRole(req.userId, req.params.id);
  const filter: any = { workspace: req.params.id };
  if (req.query.status) filter.status = req.query.status;
  else filter.status = { $ne: 'archived' };
  res.json(await Project.find(filter).sort({ updatedAt: -1 }));
}));

export { canWrite };
export default r;
