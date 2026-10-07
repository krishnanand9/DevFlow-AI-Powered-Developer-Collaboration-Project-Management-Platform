import { Schema, model, Types } from 'mongoose';
const s = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    family: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    revoked: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true }
);
export const RefreshToken = model('RefreshToken', s);
