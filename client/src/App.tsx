import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { useAuth } from './store/auth';
import Auth from './pages/Auth';
import Projects from './pages/Projects';
import Board from './pages/Board';
import Chat from './pages/Chat';
import Analytics from './pages/Analytics';
import Notifications from './pages/Notifications';

function Protected({ children }: { children: JSX.Element }) {
  return useAuth((s) => s.accessToken) ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Auth mode="login" />} />
      <Route path="/register" element={<Auth mode="register" />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route path="/" element={<Projects />} />
        <Route path="/projects/:id" element={<Board />} />
        <Route path="/projects/:id/chat" element={<Chat />} />
        <Route path="/projects/:id/analytics" element={<Analytics />} />
        <Route path="/notifications" element={<Notifications />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
