import { ActivityLog, Notification } from '../models/Notification';
import { User } from '../models/User';
import { emitToUser } from './realtime';

type Pref = 'assignments' | 'mentions' | 'dueDates';

export async function notify(
  userId: string,
  type: 'assignment' | 'mention' | 'comment' | 'invite' | 'sprint' | 'due',
  message: string,
  link?: string,
  pref?: Pref
) {
  if (pref) {
    const u = await User.findById(userId);
    if (u && u.notificationPrefs && u.notificationPrefs[pref] === false) return;
  }
  const n = await Notification.create({ user: userId, type, message, link });
  emitToUser(userId, 'notification:new', n);
}

export const logActivity = (data: {
  actor: string; workspace?: unknown; project?: unknown; action: string; entity?: string; entityId?: unknown; meta?: unknown;
}) => ActivityLog.create(data).catch(() => undefined);
