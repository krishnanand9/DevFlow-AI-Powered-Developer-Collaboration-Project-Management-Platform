import { Schema, model, Types } from 'mongoose';

export const STATUSES = ['backlog', 'todo', 'in_progress', 'in_review', 'done'] as const;
export const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

const s = new Schema(
  {
    project: { type: Types.ObjectId, ref: 'Project', required: true, index: true },
    workspace: { type: Types.ObjectId, ref: 'Workspace', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 10000 },
    status: { type: String, enum: STATUSES, default: 'todo' },
    priority: { type: String, enum: PRIORITIES, default: 'medium' },
    assignee: { type: Types.ObjectId, ref: 'User', index: true },
    reporter: { type: Types.ObjectId, ref: 'User', required: true },
    dueDate: Date,
    labels: [String],
    estimateHours: Number,
    subtasks: [{ title: { type: String, required: true }, done: { type: Boolean, default: false } }],
    dependencies: [{ type: Types.ObjectId, ref: 'Task' }],
    sprint: { type: Types.ObjectId, ref: 'Sprint', index: true },
    blocked: { type: Boolean, default: false },
    completedAt: Date,
  },
  { timestamps: true }
);
s.index({ project: 1, status: 1 });
s.index({ title: 'text', description: 'text' });
export const Task = model('Task', s);
