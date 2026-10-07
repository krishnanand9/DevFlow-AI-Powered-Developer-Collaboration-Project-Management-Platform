import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { Task } from '../models/Task';
import { canWrite, projectAccess, taskAccess } from '../services/access';
import { ah } from '../utils/asyncHandler';
import { HttpError, forbidden } from '../utils/httpError';
import { projectMetrics } from './analytics';

const r = Router();
r.use(requireAuth);

async function engine(path: string, body: unknown) {
  try {
    const resp = await fetch(`${env.aiUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Key': env.aiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) throw new Error(`engine ${resp.status}`);
    return await resp.json();
  } catch {
    throw new HttpError(503, 'AI engine unavailable');
  }
}

const taskPayload = (t: any) => ({
  id: String(t._id), title: t.title, description: t.description, status: t.status, priority: t.priority,
  dueDate: t.dueDate ? t.dueDate.toISOString() : null, blocked: t.blocked, estimateHours: t.estimateHours ?? null,
});

// Break a task into subtasks; result is returned for review. Pass { apply: true } to append them.
r.post('/ai/tasks/:id/breakdown', validate(z.object({ apply: z.boolean().default(false) })), ah(async (req, res) => {
  const { task, role } = await taskAccess(req.userId, req.params.id);
  const out = await engine('/v1/breakdown', { task: taskPayload(task) });
  if (req.body.apply) {
    if (!canWrite(role)) throw forbidden();
    task.subtasks.push(...out.subtasks.map((title: string) => ({ title, done: false })));
    await task.save();
  }
  res.json(out);
}));

r.post('/ai/projects/:pid/prioritize', ah(async (req, res) => {
  await projectAccess(req.userId, req.params.pid);
  const tasks = await Task.find({ project: req.params.pid, status: { $ne: 'done' } }).limit(100);
  res.json(await engine('/v1/prioritize', { tasks: tasks.map(taskPayload) }));
}));

// Insights are generated only from metrics computed by the server from the database.
r.post('/ai/projects/:pid/insights', ah(async (req, res) => {
  const { project } = await projectAccess(req.userId, req.params.pid);
  const metrics = await projectMetrics(req.params.pid);
  res.json({ metrics, ...(await engine('/v1/summary', { projectName: project.name, metrics })) });
}));

export default r;
