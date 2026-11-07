import { Navigate, Route, Routes } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import { useAuth } from './auth';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
import Login from './pages/Login';
import Browse from './pages/Browse';
import Watch from './pages/Watch';
import { Favorites, Recent } from './pages/Saved';
import Playlists from './pages/Playlists';
import Account from './pages/Account';
import SeriesPage from './pages/SeriesPage';

export default function App() {
  const { user, ready, offline, retry } = useAuth();
  if (!ready) return <Spinner label="Carregando…" />;
  if (!user && offline)
    return (
      <div className="grid min-h-[100dvh] place-items-center px-6 text-center">
        <div className="max-w-sm">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-ink-800 text-slate-400">
            <WifiOff className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-semibold">Sem conexão</h1>
          <p className="mt-2 text-sm text-slate-400">Confira a internet do aparelho. O app tenta de novo sozinho quando a conexão voltar.</p>
          <button type="button" onClick={retry} className="mt-5 inline-flex min-h-[48px] items-center rounded-xl bg-brand px-6 font-semibold text-white" autoFocus>
            Tentar de novo
          </button>
        </div>
      </div>
    );
  if (!user) return <Login />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Browse />} />
        <Route path="assistir/:id" element={<Watch />} />
        <Route path="serie/:playlistId" element={<SeriesPage />} />
        <Route path="favoritos" element={<Favorites />} />
        <Route path="recentes" element={<Recent />} />
        <Route path="listas" element={<Playlists />} />
        <Route path="conta" element={<Account />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
