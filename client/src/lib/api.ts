import axios from 'axios';
import { useAuth } from '../store/auth';

export const api = axios.create({ baseURL: '/api/v1' });

api.interceptors.request.use((cfg) => {
  const t = useAuth.getState().accessToken;
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

let refreshing: Promise<string | null> | null = null;
api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config;
    const { refreshToken, setTokens, logout } = useAuth.getState();
    if (err.response?.status === 401 && refreshToken && !original._retry && !original.url.includes('/auth/')) {
      original._retry = true;
      refreshing ??= axios
        .post('/api/v1/auth/refresh', { refreshToken })
        .then((r) => { setTokens(r.data.accessToken, r.data.refreshToken); return r.data.accessToken as string; })
        .catch(() => { logout(); return null; })
        .finally(() => { refreshing = null; });
      const token = await refreshing;
      if (token) { original.headers.Authorization = `Bearer ${token}`; return api(original); }
    }
    return Promise.reject(err);
  }
);

export const errMsg = (e: any) => e?.response?.data?.error || e?.message || 'Something went wrong';
