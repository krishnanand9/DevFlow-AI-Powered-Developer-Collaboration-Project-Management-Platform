import { Schema, model, Types } from 'mongoose';
const s = new Schema(
  {
    workspace: { type: Types.ObjectId, ref: 'Workspace', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, maxlength: 2000, default: '' },
    status: { type: String, enum: ['active', 'on_hold', 'completed', 'archived'], default: 'active' },
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    deadline: Date,
    createdBy: { type: Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);
export const Project = model('Project', s);
