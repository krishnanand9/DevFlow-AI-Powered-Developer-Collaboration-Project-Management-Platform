import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export default function Notifications() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['notifications'], queryFn: async () => (await api.get('/notifications')).data });
  const readAll = useMutation({ mutationFn: () => api.post('/notifications/read-all'), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">Notifications</h1><button className="btn-ghost" onClick={() => readAll.mutate()}>Mark all read</button></div>
      {isLoading && <div className="h-16 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />}
      {data?.items.length === 0 && <p className="text-slate-500">You're all caught up.</p>}
      {data?.items.map((n: any) => (
        <div key={n._id} className={`card text-sm ${n.read ? 'opacity-60' : ''}`}>{n.message}<div className="text-xs text-slate-500">{new Date(n.createdAt).toLocaleString()}</div></div>
      ))}
    </div>
  );
}
