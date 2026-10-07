import { Schema, model, Types } from 'mongoose';
export const Comment = model(
  'Comment',
  new Schema(
    {
      task: { type: Types.ObjectId, ref: 'Task', required: true, index: true },
      author: { type: Types.ObjectId, ref: 'User', required: true },
      body: { type: String, required: true, maxlength: 5000 },
      mentions: [{ type: Types.ObjectId, ref: 'User' }],
    },
    { timestamps: true }
  )
);
