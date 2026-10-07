import { Schema, model, Types } from 'mongoose';

export const ROLES = ['admin', 'project_manager', 'developer', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export const Workspace = model(
  'Workspace',
  new Schema(
    {
      name: { type: String, required: true, trim: true, maxlength: 80 },
      owner: { type: Types.ObjectId, ref: 'User', required: true },
    },
    { timestamps: true }
  )
);

const memberSchema = new Schema(
  {
    workspace: { type: Types.ObjectId, ref: 'Workspace', required: true },
    user: { type: Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ROLES, default: 'developer' },
  },
  { timestamps: true }
);
memberSchema.index({ workspace: 1, user: 1 }, { unique: true });
export const WorkspaceMember = model('WorkspaceMember', memberSchema);
