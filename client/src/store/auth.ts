import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User { id: string; name: string; email: string }
interface AuthState {
  user: User | null; accessToken: string | null; refreshToken: string | null;
  setSession: (user: User, a: string, r: string) => void;
  setTokens: (a: string, r: string) => void;
  logout: () => void;
}
// Tokens live in localStorage for simplicity; for production consider httpOnly cookies for the refresh token.
export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null, accessToken: null, refreshToken: null,
      setSession: (user, accessToken, refreshToken) => set({ user, accessToken, refreshToken }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      logout: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    { name: 'devflow-auth' }
  )
);
