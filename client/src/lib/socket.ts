import { io, Socket } from 'socket.io-client';
let socket: Socket | null = null;
export function connectSocket(token: string) {
  socket?.disconnect();
  socket = io('/', { auth: { token } });
  return socket;
}
export const getSocket = () => socket;
export function disconnectSocket() { socket?.disconnect(); socket = null; }
