import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { getSocket } from '../lib/socket';

const COLS = [
  ['backlog', 'Backlog'], ['todo', 'To Do'], ['in_progress', 'In Progress'], ['in_review', 'In Review'], ['done', 'Done'],
] as const;
const PRIO: Record<string, string> = { low: 'bg-slate-400', medium: 'bg-blue-500', high: 'bg-orange-500', critical: 'bg-red-600' };

export default function Board() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('medium');
  const [selected, setSelected] = useState<any>(null);
  const [aiMsg, setAiMsg] = useState('');
  const [ranked, setRanked] = useState<any[] | null>(null);

  const project = useQuery({ queryKey: ['project', id], queryFn: async () => (await api.get(`/projects/${id}`)).data });
  const tasks = useQuery({ queryKey: ['tasks', id], queryFn: async () => (await api.get(`/projects/${id}/tasks`)).data.items as any[] });
  const canWrite = project.data && project.data.role !== 'viewer';

  // live updates
  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const join = () => s.emit('project:join', id);
    join();
    s.on('connect', join);
    const refresh = () => qc.invalidateQueries({ queryKey: ['tasks', id] });
    ['task:created', 'task:updated', 'task:deleted'].forEach((e) => s.on(e, refresh));
    return () => { s.off('connect', join); ['task:created', 'task:updated', 'task:deleted'].forEach((e) => s.off(e, refresh)); };
  }, [id, qc]);

  const add = useMutation({
    mutationFn: async () => api.post(`/projects/${id}/tasks`, { title, priority, status: 'todo' }),
    onSuccess: () => { setTitle(''); qc.invalidateQueries({ queryKey: ['tasks', id] }); },
    onError: (e) => setAiMsg(errMsg(e)),
  });
  const move = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => api.patch(`/tasks/${taskId}`, { status }),
    onMutate: async ({ taskId, status }) => {
      await qc.cancelQueries({ queryKey: ['tasks', id] });
      const prev = qc.getQueryData<any[]>(['tasks', id]);
      qc.setQueryData<any[]>(['tasks', id], (old) => old?.map((t) => (t._id === taskId ? { ...t, status } : t)));
      return { prev };
    },
    onError: (e, _v, ctx) => { qc.setQueryData(['tasks', id], ctx?.prev); setAiMsg(errMsg(e)); },
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks', id] }),
  });
  const remove = useMutation({
    mutationFn: async (taskId: string) => api.delete(`/tasks/${taskId}`),
    onSuccess: () => { setSelected(null); qc.invalidateQueries({ queryKey: ['tasks', id] }); },
  });

  const breakdown = async (t: any) => {
    setAiMsg('Generating subtasks…');
    try {
      const { data } = await api.post(`/ai/tasks/${t._id}/breakdown`, { apply: true });
      setAiMsg(`Added ${data.subtasks.length} subtasks (${data.source === 'ai' ? 'AI-generated' : 'template fallback - no LLM configured'}).`);
      qc.invalidateQueries({ queryKey: ['tasks', id] });
      setSelected(null);
    } catch (e) { setAiMsg(errMsg(e)); }
  };
  const prioritize = async () => {
    try { setRanked((await api.post(`/ai/projects/${id}/prioritize`)).data.ranked); } catch (e) { setAiMsg(errMsg(e)); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{project.data?.name ?? '…'}</h1>
        <Link className="btn-ghost" to={`/projects/${id}/chat`}>Chat</Link>
        <Link className="btn-ghost" to={`/projects/${id}/analytics`}>Analytics</Link>
        <button className="btn-ghost flex items-center gap-1" onClick={prioritize}><Sparkles size={14} /> AI prioritize</button>
      </div>
      {canWrite && (
        <form className="flex gap-2" onSubmit={(e: FormEvent) => { e.preventDefault(); if (title.trim()) add.mutate(); }}>
          <input className="input max-w-md" placeholder="New task title" aria-label="New task title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <select className="input w-auto" value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Priority">
            {Object.keys(PRIO).map((p) => <option key={p}>{p}</option>)}
          </select>
          <button className="btn">Add task</button>
        </form>
      )}
      {aiMsg && <p role="status" className="text-sm text-slate-500">{aiMsg}</p>}
      {ranked && (
        <div className="card text-sm">
          <div className="mb-2 flex justify-between font-semibold">Suggested order <button className="font-normal text-slate-500" onClick={() => setRanked(null)}>close</button></div>
          <ol className="list-decimal space-y-1 pl-5">{ranked.slice(0, 8).map((r) => <li key={r.id}><b>{r.title}</b> — {r.reasons.join('; ')}</li>)}</ol>
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-5">
        {COLS.map(([key, label]) => {
          const items = tasks.data?.filter((t) => t.status === key) ?? [];
          return (
            <div key={key} className="min-h-[200px] rounded-lg bg-slate-100 p-2 dark:bg-slate-900"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { const tid = e.dataTransfer.getData('text/plain'); if (tid && canWrite) move.mutate({ taskId: tid, status: key }); }}>
              <div className="mb-2 px-1 text-xs font-semibold uppercase text-slate-500">{label} ({items.length})</div>
              {tasks.isLoading && <div className="h-12 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />}
              <div className="space-y-2">
                {items.map((t) => (
                  <div key={t._id} draggable={!!canWrite} onDragStart={(e) => e.dataTransfer.setData('text/plain', t._id)}
                    onClick={() => setSelected(t)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setSelected(t)}
                    className="card cursor-pointer p-2 text-sm">
                    <div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${PRIO[t.priority]}`} title={t.priority} /><span className="font-medium">{t.title}</span></div>
                    <div className="mt-1 text-xs text-slate-500">
                      {t.assignee?.name ?? 'Unassigned'}{t.dueDate && ` · due ${new Date(t.dueDate).toLocaleDateString()}`}{t.blocked && ' · 🚧 blocked'}
                      {t.subtasks?.length > 0 && ` · ${t.subtasks.filter((s: any) => s.done).length}/${t.subtasks.length} subtasks`}
                    </div>
                  </div>
                ))}
                {!tasks.isLoading && items.length === 0 && <p className="px-1 text-xs text-slate-400">Empty</p>}
              </div>
            </div>
          );
        })}
      </div>
      {selected && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelected(null)}>
          <div className="card w-full max-w-lg space-y-3" role="dialog" aria-label="Task details" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">{selected.title}</h3>
            <p className="text-sm text-slate-500">{selected.description || 'No description.'}</p>
            <ul className="space-y-1 text-sm">{selected.subtasks?.map((s: any) => <li key={s._id}>{s.done ? '☑' : '☐'} {s.title}</li>)}</ul>
            <div className="flex gap-2">
              {canWrite && <button className="btn flex items-center gap-1" onClick={() => breakdown(selected)}><Sparkles size={14} /> AI subtasks</button>}
              {canWrite && <button className="btn-ghost text-red-500" onClick={() => confirm('Delete this task?') && remove.mutate(selected._id)}>Delete</button>}
              <button className="btn-ghost ml-auto" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
