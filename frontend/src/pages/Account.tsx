import { FormEvent, useState } from 'react';
import { Eye, LogOut, Trash2, UserPlus } from 'lucide-react';
import { api, User, useApi } from '../api';
import { useAuth } from '../auth';
import { Page } from '../components/Layout';
import { btnDanger, btnGhost, btnPrimary, card, ErrorBox, input, PageTitle } from '../components/ui';
import { useTitle } from '../useTitle';

function useForm() {
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setError('');
    setOk('');
    try {
      await fn();
      setOk(success);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { error, ok, busy, run };
}

const Ok = ({ text }: { text: string }) => (text ? <p className="text-sm text-emerald-300">{text}</p> : null);

function Users({ me }: { me: User }) {
  const { data, reload } = useApi<{ users: User[] }>('users');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const f = useForm();
  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (await f.run(() => api.post('users', { name, email, password }), 'Usuário criado. Cada usuário tem as próprias listas.')) {
      setName('');
      setEmail('');
      setPassword('');
      reload();
    }
  };
  const remove = async (u: User) => {
    if (!confirm(`Excluir ${u.name}? As listas dele também serão apagadas.`)) return;
    await f.run(() => api.del(`users/${u.id}`), 'Usuário excluído');
    reload();
  };
  return (
    <section className={`${card} p-4 sm:p-5`}>
      <h2 className="mb-3 font-semibold">Usuários</h2>
      <ul className="mb-4 divide-y divide-ink-700/60">
        {data?.users.map((u) => (
          <li key={u.id} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {u.name} {u.role === 'admin' && <span className="ml-1 rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-brand-light">admin</span>}
              </p>
              <p className="truncate text-xs text-slate-500">{u.email}</p>
            </div>
            {u.id !== me.id && (
              <button type="button" aria-label={`Excluir ${u.name}`} onClick={() => remove(u)} className="grid h-10 w-10 place-items-center rounded-full text-slate-500 hover:bg-red-500/10 hover:text-red-300">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="grid gap-3 sm:grid-cols-2">
        <input className={input} placeholder="Nome" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        <input className={input} placeholder="E-mail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={input} placeholder="Senha (mín. 8)" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className={btnGhost} disabled={f.busy}>
          <UserPlus className="h-4 w-4" /> Criar usuário
        </button>
        <div className="sm:col-span-2">
          <ErrorBox message={f.error} />
          <Ok text={f.ok} />
        </div>
      </form>
    </section>
  );
}

export default function Account() {
  const { user, logout, setUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const profile = useForm();
  const pass = useForm();
  useTitle('Conta');
  if (!user) return null;

  const saveName = (e: FormEvent) => {
    e.preventDefault();
    profile.run(async () => setUser((await api.put<{ user: User }>('auth/profile', { name })).user), 'Nome salvo');
  };
  const savePass = async (e: FormEvent) => {
    e.preventDefault();
    if (await pass.run(() => api.put('auth/password', { current, password }), 'Senha alterada')) {
      setCurrent('');
      setPassword('');
    }
  };

  return (
    <Page>
      <PageTitle title="Conta" subtitle={user.email} />
      <div className="space-y-4">
        <form onSubmit={saveName} className={`${card} space-y-3 p-4 sm:p-5`}>
          <h2 className="font-semibold">Perfil</h2>
          <input className={input} value={name} required maxLength={80} onChange={(e) => setName(e.target.value)} />
          <ErrorBox message={profile.error} />
          <Ok text={profile.ok} />
          <button className={btnPrimary} disabled={profile.busy}>
            Salvar nome
          </button>
        </form>

        <form onSubmit={savePass} className={`${card} space-y-3 p-4 sm:p-5`}>
          <h2 className="font-semibold">Trocar senha</h2>
          <input className={input} type="password" autoComplete="current-password" placeholder="Senha atual" required value={current} onChange={(e) => setCurrent(e.target.value)} />
          <input className={input} type="password" autoComplete="new-password" placeholder="Nova senha (mín. 8)" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          <ErrorBox message={pass.error} />
          <Ok text={pass.ok} />
          <button className={btnPrimary} disabled={pass.busy}>
            Trocar senha
          </button>
        </form>

        <section className={`${card} p-4 sm:p-5`}>
          <h2 className="font-semibold">Grupos ocultos</h2>
          {user.hiddenGroups?.length ? (
            <ul className="mt-3 divide-y divide-ink-700/60">
              {user.hiddenGroups.map((g) => (
                <li key={g} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm">{g || 'Sem grupo'}</span>
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={async () => {
                      const r = await api.put<{ hiddenGroups: string[] }>('prefs/hidden-groups', { groups: user.hiddenGroups!.filter((x) => x !== g) });
                      setUser({ ...user, hiddenGroups: r.hiddenGroups });
                    }}
                  >
                    <Eye className="h-4 w-4" /> Mostrar
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-slate-400">Nenhum. Use o ícone de olho ao lado de um grupo, na lista de grupos, para escondê-lo.</p>
          )}
        </section>

        {user.role === 'admin' && <Users me={user} />}

        <button type="button" className={`${btnDanger} w-full sm:w-auto`} onClick={logout}>
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </div>
    </Page>
  );
}
