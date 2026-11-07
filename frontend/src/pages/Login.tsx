import { FormEvent, useState } from 'react';
import { useAuth } from '../auth';
import { Logo } from '../components/Layout';
import { btnPrimary, ErrorBox, input } from '../components/ui';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-[100dvh] place-items-center bg-[radial-gradient(ellipse_at_top,rgba(244,63,94,.18),transparent_60%)] px-4 py-[max(2rem,env(safe-area-inset-top))]">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl border border-ink-700/70 bg-ink-900/80 p-6 shadow-2xl backdrop-blur sm:p-8">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <h1 className="text-center text-lg font-semibold">Entrar</h1>
        <p className="mb-6 mt-1 text-center text-sm text-slate-400">Seus canais da lista M3U em qualquer tela.</p>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">E-mail</span>
            <input className={input} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">Senha</span>
            <input className={input} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <ErrorBox message={error} />
          <button className={`${btnPrimary} w-full`} disabled={busy}>
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </div>
      </form>
    </div>
  );
}
