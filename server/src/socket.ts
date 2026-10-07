import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { env } from './config/env';
import { Channel, Message } from './models/Chat';
import { WorkspaceMember } from './models/Workspace';
import { User } from './models/User';
import { canWrite, projectAccess } from './services/access';
import { notify } from './services/notify';
import { setIo } from './services/realtime';
import { verifyAccess } from './utils/tokens';

export function attachSocket(http: HttpServer) {
  const io = new Server(http, { cors: { origin: env.clientUrl, credentials: true } });
  setIo(io);
  const online = new Map<string, number>();

  io.use((socket, next) => {
    try {
      socket.data.userId = verifyAccess(String(socket.handshake.auth?.token));
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const userId: string = socket.data.userId;
    socket.join(`user:${userId}`);
    online.set(userId, (online.get(userId) || 0) + 1);
    io.emit('presence', { userId, online: true });

    // Room authorization: a socket can only join projects its user has access to.
    socket.on('project:join', async (projectId: string, ack?: (ok: boolean) => void) => {
      try {
        await projectAccess(userId, projectId);
        socket.join(`project:${projectId}`);
        ack?.(true);
      } catch {
        ack?.(false);
      }
    });

    socket.on('typing', ({ projectId, channelId }: { projectId: string; channelId: string }) => {
      if (socket.rooms.has(`project:${projectId}`)) socket.to(`project:${projectId}`).emit('typing', { userId, channelId });
    });

    socket.on('chat:send', async ({ channelId, body }: { channelId: string; body: string }, ack?: (r: unknown) => void) => {
      try {
        const text = String(body || '').trim().slice(0, 4000);
        if (!text) return ack?.({ error: 'empty' });
        const ch = await Channel.findById(channelId);
        if (!ch) return ack?.({ error: 'channel not found' });
        const { project, role } = await projectAccess(userId, String(ch.project));
        if (!canWrite(role)) return ack?.({ error: 'read-only' });
        const handles = [...text.matchAll(/@([\w.-]+)/g)].map((m) => m[1].toLowerCase());
        const members = await WorkspaceMember.find({ workspace: project.workspace }).populate('user', 'name');
        const mentioned = members.filter((m: any) => handles.includes(String(m.user.name).split(' ')[0].toLowerCase()));
        const msg = await Message.create({ channel: ch._id, sender: userId, body: text, mentions: mentioned.map((m: any) => m.user._id), readBy: [userId] });
        const populated = await msg.populate('sender', 'name avatarUrl');
        io.to(`project:${project._id}`).emit('chat:message', populated);
        const sender = await User.findById(userId);
        for (const m of mentioned as any[])
          if (String(m.user._id) !== userId) await notify(String(m.user._id), 'mention', `${sender?.name} mentioned you in #${ch.name}`, `/projects/${project._id}/chat`, 'mentions');
        ack?.({ ok: true });
      } catch {
        ack?.({ error: 'failed' });
      }
    });

    socket.on('chat:read', async ({ channelId }: { channelId: string }) => {
      const ch = await Channel.findById(channelId);
      if (!ch) return;
      try { await projectAccess(userId, String(ch.project)); } catch { return; }
      await Message.updateMany({ channel: channelId, readBy: { $ne: userId } }, { $addToSet: { readBy: userId } });
      io.to(`project:${ch.project}`).emit('chat:read', { channelId, userId });
    });

    socket.on('disconnect', () => {
      const n = (online.get(userId) || 1) - 1;
      if (n <= 0) { online.delete(userId); io.emit('presence', { userId, online: false }); } else online.set(userId, n);
    });
  });
  return io;
}
