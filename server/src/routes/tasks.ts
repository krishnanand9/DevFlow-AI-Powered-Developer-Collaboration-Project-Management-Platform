import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { Comment } from '../models/Comment';
import { Task, PRIORITIES, STATUSES } from '../models/Task';
import { User } from '../models/User';
import { WorkspaceMember } from '../models/Workspace';
import { canWrite, projectAccess, taskAccess } from '../services/access';
import { logActivity, notify } from '../services/notify';
import { emitToProject } from '../services/realtime';
import { ah } from '../utils/asyncHandler';
import { HttpError, forbidden } from '../utils/httpError';

const r = Router();
r.use(requireAuth);

const base = {
  title: z.string().min(1).max(200),
  description: z.string().max(10000),
  status: z.enum(STATUSES),
  priority: z.enum(PRIORITIES),
  assignee: z.string().nullable(),
  dueDate: z.coerce.date().nullable(),
  labels: z.array(z.string().max(30)).max(20),
  estimateHours: z.number().min(0).max(1000).nullable(),
  blocked: z.boolean(),
  sprint: z.string().nullable(),
  dependencies: z.array(z.string()).max(50),
  subtasks: z.array(z.object({ title: z.string().min(1).max(200), done: z.boolean().default(false) })).max(50),
};
const createSchema = z.object({ title: base.title }).merge(z.object(base).partial().omit({ title: true }));
const updateSchema = z.object(base).partial();

async function assertAssignable(workspaceId: string, userId?: string | null) {
  if (!userId) return;
  if (!(await WorkspaceMember.findOne({ workspace: workspaceId, user: userId }))) throw new HttpError(400, 'Assignee is not a workspace member');
}

r.get('/projects/:pid/tasks', ah(async (req, res) => {
  await projectAccess(req.userId, req.params.pid);
  const { status, priority, assignee, sprint, q, overdue } = req.query as Record<string, string>;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
  const filter: any = { project: req.params.pid };
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (assignee) filter.assignee = assignee === 'me' ? req.userId : assignee;
  if (sprint) filter.sprint = sprint;
  if (q) filter.$text = { $search: q };
  if (overdue === 'true') Object.assign(filter, { dueDate: { $lt: new Date() }, status: { $ne: 'done' } });
  const [items, total] = await Promise.all([
    Task.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('assignee', 'name avatarUrl'),
    Task.countDocuments(filter),
  ]);
  res.json({ items, total, page, limit });
}));

r.post('/projects/:pid/tasks', validate(createSchema), ah(async (req, res) => {
  const { project, role } = await projectAccess(req.userId, req.params.pid);
  if (!canWrite(role)) throw forbidden('Viewers cannot create tasks');
  await assertAssignable(String(project.workspace), req.body.assignee);
  const t = await Task.create({
    ...req.body,
    status: req.body.status === 'done' ? 'done' : req.body.status,
    completedAt: req.body.status === 'done' ? new Date() : undefined,
    project: project._id,
    workspace: project.workspace,
    reporter: req.userId,
  });
  const populated = await t.populate('assignee', 'name avatarUrl');
  await logActivity({ actor: req.userId, workspace: project.workspace, project: project._id, action: 'task.created', entity: 'Task', entityId: t._id, meta: { title: t.title } });
  if (t.assignee && String(t.assignee) !== req.userId)
    await notify(String(t.assignee), 'assignment', `You were assigned "${t.title}"`, `/projects/${project._id}`, 'assignments');
  emitToProject(String(project._id), 'task:created', populated);
  res.status(201).json(populated);
}));

r.get('/tasks/:id', ah(async (req, res) => {
  const { task } = await taskAccess(req.userId, req.params.id);
  res.json(await task.populate('assignee', 'name avatarUrl'));
}));

r.patch('/tasks/:id', validate(updateSchema), ah(async (req, res) => {
  const { task, project, role } = await taskAccess(req.userId, req.params.id);
  if (!canWrite(role)) throw forbidden('Viewers cannot edit tasks');
  await assertAssignable(String(project.workspace), req.body.assignee);
  const prevAssignee = task.assignee ? String(task.assignee) : null;
  const prevStatus = task.status;
  task.set(req.body);
  if (req.body.status && req.body.status !== prevStatus) task.completedAt = req.body.status === 'done' ? new Date() : undefined;
  await task.save();
  const populated = await task.populate('assignee', 'name avatarUrl');
  if (req.body.status && req.body.status !== prevStatus)
    await logActivity({ actor: req.userId, workspace: project.workspace, project: project._id, action: 'task.status_changed', entity: 'Task', entityId: task._id, meta: { title: task.title, from: prevStatus, to: task.status } });
  const newAssignee = task.assignee ? String(task.assignee) : null;
  if (newAssignee && newAssignee !== prevAssignee && newAssignee !== req.userId)
    await notify(newAssignee, 'assignment', `You were assigned "${task.title}"`, `/projects/${project._id}`, 'assignments');
  emitToProject(String(project._id), 'task:updated', populated);
  res.json(populated);
}));

r.delete('/tasks/:id', ah(async (req, res) => {
  const { task, project, role } = await taskAccess(req.userId, req.params.id);
  if (!canWrite(role)) throw forbidden();
  await Comment.deleteMany({ task: task._id });
  await task.deleteOne();
  await Task.updateMany({ dependencies: task._id }, { $pull: { dependencies: task._id } });
  await logActivity({ actor: req.userId, workspace: project.workspace, project: project._id, action: 'task.deleted', entity: 'Task', entityId: task._id, meta: { title: task.title } });
  emitToProject(String(project._id), 'task:deleted', { _id: task._id });
  res.json({ ok: true });
}));

r.get('/tasks/:id/comments', ah(async (req, res) => {
  await taskAccess(req.userId, req.params.id);
  res.json(await Comment.find({ task: req.params.id }).sort({ createdAt: 1 }).populate('author', 'name avatarUrl'));
}));

r.post('/tasks/:id/comments', validate(z.object({ body: z.string().min(1).max(5000) })), ah(async (req, res) => {
  const { task, project, role } = await taskAccess(req.userId, req.params.id);
  if (!canWrite(role)) throw forbidden();
  // @mentions: match "@name" tokens against workspace members only
  const handles = [...req.body.body.matchAll(/@([\w.-]+)/g)].map((m) => m[1].toLowerCase());
  const members = await WorkspaceMember.find({ workspace: project.workspace }).populate('user', 'name');
  const mentioned = members.filter((m: any) => handles.includes(String(m.user.name).split(' ')[0].toLowerCase()));
  const c = await Comment.create({ task: task._id, author: req.userId, body: req.body.body, mentions: mentioned.map((m: any) => m.user._id) });
  const author = await User.findById(req.userId);
  for (const m of mentioned as any[])
    if (String(m.user._id) !== req.userId) await notify(String(m.user._id), 'mention', `${author?.name} mentioned you on "${task.title}"`, `/projects/${project._id}`, 'mentions');
  if (task.assignee && String(task.assignee) !== req.userId)
    await notify(String(task.assignee), 'comment', `${author?.name} commented on "${task.title}"`, `/projects/${project._id}`);
  emitToProject(String(project._id), 'comment:created', { task: String(task._id) });
  res.status(201).json(await c.populate('author', 'name avatarUrl'));
}));

export default r;
