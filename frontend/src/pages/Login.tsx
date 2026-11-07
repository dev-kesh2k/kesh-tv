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
    <main className="flex min-h-[100dvh] flex-col justify-center px-6 py-[max(2rem,env(safe-area-inset-top))] sm:px-12">
      <form onSubmit={submit} className="w-full max-w-sm">
        <Logo />
        <h1 className="font-display mt-10 text-3xl leading-tight text-slate-100">Entre para ver seus canais</h1>
        <div className="mt-8 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-400">E-mail</span>
            <input className={input} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-400">Senha</span>
            <input className={input} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <ErrorBox message={error} />
          <button className={`${btnPrimary} w-full`} disabled={busy}>
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </div>
      </form>
    </main>
  );
}
