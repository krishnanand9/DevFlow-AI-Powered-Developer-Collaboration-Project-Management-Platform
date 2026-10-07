import { Server } from 'socket.io';
let io: Server | null = null;
export const setIo = (s: Server) => (io = s);
export const emitToProject = (projectId: string, event: string, payload: unknown) =>
  io?.to(`project:${projectId}`).emit(event, payload);
export const emitToUser = (userId: string, event: string, payload: unknown) =>
  io?.to(`user:${userId}`).emit(event, payload);
