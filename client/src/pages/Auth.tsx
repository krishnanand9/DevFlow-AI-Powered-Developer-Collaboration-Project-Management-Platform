import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, errMsg } from '../lib/api';
import { useAuth } from '../store/auth';

export default function Auth({ mode }: { mode: 'login' | 'register' }) {
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const setSession = useAuth((s) => s.setSession);
  const nav = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const { data } = await api.post(`/auth/${mode}`, mode === 'login' ? { email: f.email, password: f.password } : f);
      setSession(data.user, data.accessToken, data.refreshToken);
      nav('/');
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-3">
        <h1 className="text-xl font-bold">{mode === 'login' ? 'Sign in to DevFlow' : 'Create your account'}</h1>
        {mode === 'register' && <input className="input" placeholder="Name" aria-label="Name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}
        <input className="input" type="email" placeholder="Email" aria-label="Email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <input className="input" type="password" placeholder="Password (min 8 chars)" aria-label="Password" required minLength={mode === 'register' ? 8 : 1} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        {err && <p role="alert" className="text-sm text-red-500">{err}</p>}
        <button className="btn w-full" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Register'}</button>
        <p className="text-sm text-slate-500">
          {mode === 'login' ? <>No account? <Link className="text-indigo-500" to="/register">Register</Link></> : <>Have an account? <Link className="text-indigo-500" to="/login">Sign in</Link></>}
        </p>
      </form>
    </div>
  );
}
