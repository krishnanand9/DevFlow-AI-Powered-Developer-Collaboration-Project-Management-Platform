import { Schema, model, Types } from 'mongoose';
export const Notification = model(
  'Notification',
  new Schema(
    {
      user: { type: Types.ObjectId, ref: 'User', required: true, index: true },
      type: { type: String, enum: ['assignment', 'mention', 'comment', 'invite', 'sprint', 'due'], required: true },
      message: { type: String, required: true },
      link: String,
      read: { type: Boolean, default: false },
    },
    { timestamps: true }
  )
);
export const ActivityLog = model(
  'ActivityLog',
  new Schema(
    {
      workspace: { type: Types.ObjectId, ref: 'Workspace', index: true },
      project: { type: Types.ObjectId, ref: 'Project', index: true },
      actor: { type: Types.ObjectId, ref: 'User', required: true },
      action: { type: String, required: true },
      entity: String,
      entityId: Types.ObjectId,
      meta: Schema.Types.Mixed,
    },
    { timestamps: true }
  )
);
