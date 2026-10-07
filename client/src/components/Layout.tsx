import { useEffect, useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, FolderKanban, LogOut, Moon, Sun, PanelLeft } from 'lucide-react';
import { api } from '../lib/api';
import { connectSocket, disconnectSocket } from '../lib/socket';
import { useAuth } from '../store/auth';

export default function Layout() {
  const { user, accessToken, refreshToken, logout } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(true);
  const [dark, setDark] = useState(document.documentElement.classList.contains('dark'));

  useEffect(() => {
    if (!accessToken) return;
    const s = connectSocket(accessToken);
    s.on('notification:new', () => qc.invalidateQueries({ queryKey: ['notifications'] }));
    return () => disconnectSocket();
  }, [accessToken, qc]);

  const { data } = useQuery({ queryKey: ['notifications'], queryFn: async () => (await api.get('/notifications')).data });

  const toggleTheme = () => {
    document.documentElement.classList.toggle('dark');
    const d = document.documentElement.classList.contains('dark');
    localStorage.setItem('theme', d ? 'dark' : 'light');
    setDark(d);
  };
  const doLogout = async () => {
    if (refreshToken) await api.post('/auth/logout', { refreshToken }).catch(() => undefined);
    logout();
    nav('/login');
  };

  return (
    <div className="flex min-h-screen">
      {open && (
        <aside className="w-56 shrink-0 border-r border-slate-200 p-3 dark:border-slate-800">
          <div className="mb-4 px-2 text-lg font-bold text-indigo-600">DevFlow</div>
          <nav className="space-y-1">
            <Link className="btn-ghost flex items-center gap-2" to="/"><FolderKanban size={16} /> Projects</Link>
            <Link className="btn-ghost flex items-center gap-2" to="/notifications">
              <Bell size={16} /> Notifications
              {data?.unread > 0 && <span className="ml-auto rounded-full bg-red-500 px-2 text-xs text-white">{data.unread}</span>}
            </Link>
          </nav>
          <div className="mt-6 px-2 text-xs text-slate-500">{user?.name}</div>
          <button className="btn-ghost mt-2 flex w-full items-center gap-2" onClick={doLogout}><LogOut size={16} /> Logout</button>
        </aside>
      )}
      <main className="flex-1 overflow-x-auto">
        <header className="flex items-center gap-2 border-b border-slate-200 px-4 py-2 dark:border-slate-800">
          <button className="btn-ghost" onClick={() => setOpen(!open)} aria-label="Toggle sidebar"><PanelLeft size={16} /></button>
          <div className="flex-1" />
          <button className="btn-ghost" onClick={toggleTheme} aria-label="Toggle theme">{dark ? <Sun size={16} /> : <Moon size={16} />}</button>
        </header>
        <div className="p-4"><Outlet /></div>
      </main>
    </div>
  );
}
