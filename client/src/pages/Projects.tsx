import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errMsg } from '../lib/api';

function WorkspaceBlock({ ws }: { ws: any }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('developer');
  const [msg, setMsg] = useState('');
  const projects = useQuery({ queryKey: ['projects', ws._id], queryFn: async () => (await api.get(`/workspaces/${ws._id}/projects`)).data });
  const members = useQuery({ queryKey: ['members', ws._id], queryFn: async () => (await api.get(`/workspaces/${ws._id}/members`)).data });
  const create = useMutation({
    mutationFn: async () => api.post(`/workspaces/${ws._id}/projects`, { name }),
    onSuccess: () => { setName(''); qc.invalidateQueries({ queryKey: ['projects', ws._id] }); },
    onError: (e) => setMsg(errMsg(e)),
  });
  const invite = async (e: FormEvent) => {
    e.preventDefault();
    try { await api.post(`/workspaces/${ws._id}/members`, { email, role }); setEmail(''); setMsg('Member added'); qc.invalidateQueries({ queryKey: ['members', ws._id] }); }
    catch (e) { setMsg(errMsg(e)); }
  };
  const manage = ws.role === 'admin' || ws.role === 'project_manager';

  return (
    <section className="card space-y-3">
      <div className="flex items-baseline justify-between"><h2 className="text-lg font-semibold">{ws.name}</h2><span className="text-xs text-slate-500">{ws.role}</span></div>
      {projects.isLoading ? <div className="h-10 animate-pulse rounded bg-slate-200 dark:bg-slate-800" /> :
        projects.data?.length ? <ul className="space-y-1">{projects.data.map((p: any) => (
          <li key={p._id}><Link to={`/projects/${p._id}`} className="block rounded px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800">{p.name} <span className="text-xs text-slate-500">· {p.status}</span></Link></li>
        ))}</ul> : <p className="text-sm text-slate-500">No projects yet.</p>}
      {manage && (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) create.mutate(); }}>
          <input className="input" placeholder="New project name" aria-label="New project name" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn">Create</button>
        </form>
      )}
      <div className="text-xs text-slate-500">Members: {members.data?.map((m: any) => `${m.user.name} (${m.role})`).join(', ')}</div>
      {manage && (
        <form className="flex flex-wrap gap-2" onSubmit={invite}>
          <input className="input flex-1" type="email" placeholder="Invite by email (must be registered)" aria-label="Invite email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <select className="input w-auto" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
            <option value="developer">Developer</option><option value="project_manager">Project Manager</option><option value="viewer">Viewer</option>{ws.role === 'admin' && <option value="admin">Admin</option>}
          </select>
          <button className="btn">Invite</button>
        </form>
      )}
      {msg && <p className="text-sm text-slate-500">{msg}</p>}
    </section>
  );
}

export default function Projects() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const ws = useQuery({ queryKey: ['workspaces'], queryFn: async () => (await api.get('/workspaces')).data });
  const create = useMutation({
    mutationFn: async () => api.post('/workspaces', { name }),
    onSuccess: () => { setName(''); qc.invalidateQueries({ queryKey: ['workspaces'] }); },
  });
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">Workspaces & projects</h1>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) create.mutate(); }}>
        <input className="input" placeholder="New workspace name" aria-label="New workspace name" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn">Create workspace</button>
      </form>
      {ws.isLoading && <div className="h-24 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />}
      {ws.data?.map((w: any) => <WorkspaceBlock key={w._id} ws={w} />)}
      {ws.data?.length === 0 && <p className="text-slate-500">Create a workspace to get started.</p>}
    </div>
  );
}
