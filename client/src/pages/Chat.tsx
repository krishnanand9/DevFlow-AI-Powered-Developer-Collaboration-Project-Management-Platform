import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useAuth } from '../store/auth';

export default function Chat() {
  const { id } = useParams();
  const me = useAuth((s) => s.user);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const channels = useQuery({ queryKey: ['channels', id], queryFn: async () => (await api.get(`/projects/${id}/channels`)).data });
  const channel = channels.data?.[0];

  useEffect(() => {
    if (!channel) return;
    api.get(`/channels/${channel._id}/messages`).then((r) => setMsgs(r.data));
    const s = getSocket();
    if (!s) return;
    s.emit('project:join', id);
    s.emit('chat:read', { channelId: channel._id });
    const onMsg = (m: any) => { if (m.channel === channel._id) { setMsgs((p) => [...p, m]); s.emit('chat:read', { channelId: channel._id }); } };
    const onRead = ({ channelId, userId }: any) => channelId === channel._id && setMsgs((p) => p.map((m) => (m.readBy?.includes(userId) ? m : { ...m, readBy: [...(m.readBy || []), userId] })));
    let t: ReturnType<typeof setTimeout>;
    const onTyping = ({ userId, channelId }: any) => { if (channelId === channel._id && userId !== me?.id) { setTyping(true); clearTimeout(t); t = setTimeout(() => setTyping(false), 2000); } };
    s.on('chat:message', onMsg); s.on('chat:read', onRead); s.on('typing', onTyping);
    return () => { s.off('chat:message', onMsg); s.off('chat:read', onRead); s.off('typing', onTyping); clearTimeout(t); };
  }, [channel?._id, id, me?.id]);

  useEffect(() => bottom.current?.scrollIntoView({ behavior: 'smooth' }), [msgs.length]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !channel) return;
    getSocket()?.emit('chat:send', { channelId: channel._id, body: text }, () => undefined);
    setText('');
  };

  return (
    <div className="mx-auto flex h-[80vh] max-w-2xl flex-col">
      <div className="mb-2 flex items-center gap-3"><Link to={`/projects/${id}`} className="btn-ghost">← Board</Link><h1 className="text-xl font-bold">#{channel?.name ?? '…'}</h1></div>
      <div className="card flex-1 space-y-2 overflow-y-auto">
        {msgs.length === 0 && <p className="text-sm text-slate-400">No messages yet. Use @firstname to mention a teammate.</p>}
        {msgs.map((m) => (
          <div key={m._id} className={m.sender?._id === me?.id ? 'text-right' : ''}>
            <div className="text-xs text-slate-500">{m.sender?.name} · {new Date(m.createdAt).toLocaleTimeString()}{m.sender?._id === me?.id && (m.readBy?.length ?? 0) > 1 && ' · ✓ read'}</div>
            <div className="inline-block rounded-lg bg-slate-100 px-3 py-1 text-sm dark:bg-slate-800">{m.body}</div>
          </div>
        ))}
        {typing && <div className="text-xs italic text-slate-400">Someone is typing…</div>}
        <div ref={bottom} />
      </div>
      <form className="mt-2 flex gap-2" onSubmit={send}>
        <input className="input" aria-label="Message" placeholder="Message…" value={text}
          onChange={(e) => { setText(e.target.value); getSocket()?.emit('typing', { projectId: id, channelId: channel?._id }); }} />
        <button className="btn">Send</button>
      </form>
    </div>
  );
}
