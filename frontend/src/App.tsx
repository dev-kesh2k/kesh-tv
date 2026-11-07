import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
import Login from './pages/Login';
import Browse from './pages/Browse';
import Watch from './pages/Watch';
import { Favorites, Recent } from './pages/Saved';
import Playlists from './pages/Playlists';
import Account from './pages/Account';

export default function App() {
  const { user, ready } = useAuth();
  if (!ready) return <Spinner label="Carregando…" />;
  if (!user) return <Login />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Browse />} />
        <Route path="assistir/:id" element={<Watch />} />
        <Route path="favoritos" element={<Favorites />} />
        <Route path="recentes" element={<Recent />} />
        <Route path="listas" element={<Playlists />} />
        <Route path="conta" element={<Account />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
