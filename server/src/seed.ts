import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDb } from './config/db';
import { Channel } from './models/Chat';
import { Project } from './models/Project';
import { Sprint } from './models/Sprint';
import { Task } from './models/Task';
import { User } from './models/User';
import { Workspace, WorkspaceMember } from './models/Workspace';

(async () => {
  await connectDb();
  await Promise.all([User, Workspace, WorkspaceMember, Project, Task, Sprint, Channel].map((m: any) => m.deleteMany({})));
  const passwordHash = await bcrypt.hash('Password123!', 12);
  const [admin, pm, dev, viewer] = await User.create([
    { name: 'Ada Admin', email: 'admin@devflow.dev', passwordHash },
    { name: 'Priya Manager', email: 'pm@devflow.dev', passwordHash },
    { name: 'Dan Developer', email: 'dev@devflow.dev', passwordHash },
    { name: 'Vera Viewer', email: 'viewer@devflow.dev', passwordHash },
  ]);
  const ws = await Workspace.create({ name: 'Demo Workspace', owner: admin._id });
  await WorkspaceMember.create([
    { workspace: ws._id, user: admin._id, role: 'admin' },
    { workspace: ws._id, user: pm._id, role: 'project_manager' },
    { workspace: ws._id, user: dev._id, role: 'developer' },
    { workspace: ws._id, user: viewer._id, role: 'viewer' },
  ]);
  const p = await Project.create({ workspace: ws._id, name: 'Website Redesign', description: 'Demo project', createdBy: admin._id, priority: 'high' });
  await Channel.create({ project: p._id, name: 'general' });
  const now = Date.now();
  const sprint = await Sprint.create({ project: p._id, name: 'Sprint 1', goal: 'Ship the new landing page', startDate: new Date(now - 5 * 864e5), endDate: new Date(now + 9 * 864e5), status: 'active' });
  const mk = (title: string, status: string, priority: string, assignee: any, days?: number, extra: any = {}) => ({
    project: p._id, workspace: ws._id, reporter: pm._id, title, status, priority, assignee: assignee._id, sprint: sprint._id,
    dueDate: days === undefined ? undefined : new Date(now + days * 864e5),
    completedAt: status === 'done' ? new Date(now - 864e5) : undefined, ...extra,
  });
  await Task.create([
    mk('Design hero section', 'done', 'high', dev, -2),
    mk('Implement responsive navbar', 'in_progress', 'medium', dev, 3),
    mk('Set up CI pipeline', 'todo', 'high', dev, -1),
    mk('Write copy for pricing page', 'backlog', 'low', pm, 10),
    mk('Fix Safari layout bug', 'in_review', 'critical', dev, 1, { blocked: true }),
  ]);
  console.log('Seeded. Demo accounts (password: Password123!): admin@, pm@, dev@, viewer@devflow.dev');
  await mongoose.disconnect();
})();
