import { Schema, model } from 'mongoose';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    avatarUrl: String,
    skills: [String],
    availability: { type: String, enum: ['available', 'busy', 'away'], default: 'available' },
    notificationPrefs: {
      assignments: { type: Boolean, default: true },
      mentions: { type: Boolean, default: true },
      dueDates: { type: Boolean, default: true },
    },
    resetTokenHash: { type: String, select: false },
    resetExpires: { type: Date, select: false },
  },
  { timestamps: true }
);

export const User = model('User', userSchema);
