import { Router } from 'express';
import { Types } from 'mongoose';
import { requireAuth } from '../middleware/auth';
import { Task } from '../models/Task';
import { projectAccess } from '../services/access';
import { ah } from '../utils/asyncHandler';

const r = Router();
r.use(requireAuth);

export async function projectMetrics(projectId: string) {
  const pid = new Types.ObjectId(projectId);
  const now = new Date();
  const [byStatus, byPriority, workload, overdue, blocked, total, completedLast14] = await Promise.all([
    Task.aggregate([{ $match: { project: pid } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Task.aggregate([{ $match: { project: pid } }, { $group: { _id: '$priority', count: { $sum: 1 } } }]),
    Task.aggregate([
      { $match: { project: pid, status: { $ne: 'done' }, assignee: { $ne: null } } },
      { $group: { _id: '$assignee', open: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
      { $project: { open: 1, name: { $arrayElemAt: ['$u.name', 0] } } },
    ]),
    Task.countDocuments({ project: pid, dueDate: { $lt: now }, status: { $ne: 'done' } }),
    Task.countDocuments({ project: pid, blocked: true, status: { $ne: 'done' } }),
    Task.countDocuments({ project: pid }),
    Task.aggregate([
      { $match: { project: pid, completedAt: { $gte: new Date(+now - 14 * 864e5) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);
  const counts = Object.fromEntries(byStatus.map((s: any) => [s._id, s.count]));
  const done = counts.done || 0;
  return {
    total,
    completionPercent: total ? Math.round((done / total) * 100) : 0,
    byStatus: counts,
    byPriority: Object.fromEntries(byPriority.map((s: any) => [s._id, s.count])),
    workload: workload.map((w: any) => ({ name: w.name || 'Unknown', open: w.open })),
    overdue,
    blocked,
    completionsLast14Days: completedLast14.map((d: any) => ({ date: d._id, count: d.count })),
  };
}

r.get('/projects/:pid/analytics', ah(async (req, res) => {
  await projectAccess(req.userId, req.params.pid);
  res.json(await projectMetrics(req.params.pid));
}));

export default r;
