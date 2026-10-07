import { Schema, model, Types } from 'mongoose';
export const Sprint = model(
  'Sprint',
  new Schema(
    {
      project: { type: Types.ObjectId, ref: 'Project', required: true, index: true },
      name: { type: String, required: true, maxlength: 100 },
      goal: { type: String, default: '' },
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      status: { type: String, enum: ['planned', 'active', 'completed'], default: 'planned' },
    },
    { timestamps: true }
  )
);
