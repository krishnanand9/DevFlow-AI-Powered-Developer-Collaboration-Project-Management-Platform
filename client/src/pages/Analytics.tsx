import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, errMsg } from '../lib/api';

export default function Analytics() {
  const { id } = useParams();
  const [insight, setInsight] = useState<any>(null);
  const [err, setErr] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['analytics', id], queryFn: async () => (await api.get(`/projects/${id}/analytics`)).data });

  const status = Object.entries(data?.byStatus ?? {}).map(([name, count]) => ({ name, count }));
  const getInsight = async () => {
    setErr('');
    try { setInsight((await api.post(`/ai/projects/${id}/insights`)).data); } catch (e) { setErr(errMsg(e)); }
  };

  if (isLoading) return <div className="h-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />;
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center gap-3"><Link to={`/projects/${id}`} className="btn-ghost">← Board</Link><h1 className="text-2xl font-bold">Analytics</h1></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[['Tasks', data.total], ['Completion', `${data.completionPercent}%`], ['Overdue', data.overdue], ['Blocked', data.blocked]].map(([k, v]) => (
          <div key={String(k)} className="card"><div className="text-xs text-slate-500">{k}</div><div className="text-2xl font-bold">{v}</div></div>
        ))}
      </div>
      <div className="card h-64">
        <div className="mb-2 text-sm font-semibold">Tasks by status</div>
        <ResponsiveContainer width="100%" height="85%"><BarChart data={status}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill="#6366f1" /></BarChart></ResponsiveContainer>
      </div>
      <div className="card h-64">
        <div className="mb-2 text-sm font-semibold">Open tasks per assignee</div>
        {data.workload.length ? <ResponsiveContainer width="100%" height="85%"><BarChart data={data.workload}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="open" fill="#10b981" /></BarChart></ResponsiveContainer> : <p className="text-sm text-slate-400">No assigned open tasks.</p>}
      </div>
      <div className="card space-y-2">
        <button className="btn" onClick={getInsight}>Generate health summary</button>
        {err && <p className="text-sm text-red-500">{err}</p>}
        {insight && <p className="text-sm">{insight.summary} <span className="text-xs text-slate-500">({insight.source === 'ai' ? 'AI-generated from the metrics above' : 'rule-based summary; no LLM configured'})</span></p>}
      </div>
    </div>
  );
}
