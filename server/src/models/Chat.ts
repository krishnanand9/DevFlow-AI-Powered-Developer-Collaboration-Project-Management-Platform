import { Schema, model, Types } from 'mongoose';
export const Channel = model(
  'Channel',
  new Schema(
    {
      project: { type: Types.ObjectId, ref: 'Project', required: true, index: true },
      name: { type: String, required: true },
    },
    { timestamps: true }
  )
);
export const Message = model(
  'Message',
  new Schema(
    {
      channel: { type: Types.ObjectId, ref: 'Channel', required: true, index: true },
      sender: { type: Types.ObjectId, ref: 'User', required: true },
      body: { type: String, required: true, maxlength: 4000 },
      mentions: [{ type: Types.ObjectId, ref: 'User' }],
      readBy: [{ type: Types.ObjectId, ref: 'User' }],
    },
    { timestamps: true }
  )
);
