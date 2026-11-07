import { FormEvent, useState } from 'react';
import { Download, Eye, LogOut, Smartphone, Trash2, UserPlus } from 'lucide-react';
import { api, setToken, User, useApi } from '../api';
import { useAuth } from '../auth';
import { Page } from '../components/Layout';
import { btnDanger, btnGhost, btnPrimary, card, ErrorBox, input, PageTitle } from '../components/ui';
import { useTitle } from '../useTitle';
import { platform, setTvMode, tvModeSetting } from '../platform';

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
                {u.name} {u.role === 'admin' && <span className="ml-1 text-xs font-normal text-slate-500">(administrador)</span>}
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

interface StatsData {
  playlists: number;
  live: number;
  movies: number;
  series: number;
  favorites: number;
  watched: number;
  hoursWatched: number;
}

const APK_URL = 'https://github.com/dev-kesh2k/kesh-tv/releases/latest/download/kesh-tv.apk';

/** App Android (celular e Android TV): download no navegador; dentro do app mostra a versão instalada. */
function AndroidAppSection() {
  const version = (() => {
    try {
      return window.KeshNative?.version?.() || null;
    } catch {
      return null;
    }
  })();
  return (
    <section className={`${card} p-4 sm:p-5`}>
      <h2 className="flex items-center gap-2 font-semibold">
        <Smartphone className="h-4 w-4" /> App Android
      </h2>
      {platform.app ? (
        <p className="mt-1 text-sm text-slate-400">
          Você está no app Android{version ? ` (versão ${version})` : ''}. Para atualizar, baixe a versão mais nova pelo navegador e instale por cima.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-slate-400">
            Para celular e Android TV (TV Box, Fire TV, Chromecast com Google TV). No aparelho, permita “instalar apps de fontes desconhecidas”.
          </p>
          <a href={APK_URL} className={`${btnPrimary} mt-3`}>
            <Download className="h-4 w-4" /> Baixar app Android
          </a>
        </>
      )}
    </section>
  );
}

/** Modo TV: automático (pela TV/app) ou forçado ligado/desligado neste aparelho. */
function TvModeSection() {
  const current = tvModeSetting();
  const opt = (value: 'auto' | 'on' | 'off', label: string) => (
    <button
      key={value}
      type="button"
      aria-pressed={current === value}
      onClick={() => setTvMode(value === 'auto' ? null : value === 'on')}
      className={`min-h-[44px] flex-1 rounded-lg px-3 text-sm font-semibold ${current === value ? 'bg-brand text-ink-950' : 'text-slate-300 hover:bg-ink-700'}`}
    >
      {label}
    </button>
  );
  return (
    <section className={`${card} p-4 sm:p-5`}>
      <h2 className="font-semibold">Modo TV</h2>
      <p className="mt-1 text-sm text-slate-400">
        Letras e botões maiores, navegação pelo controle remoto e margem para as bordas da TV. Neste aparelho: <b className="text-slate-200">{platform.tv ? 'ligado' : 'desligado'}</b>.
      </p>
      <div className="mt-3 flex gap-1 rounded-xl bg-ink-850 p-1">
        {opt('auto', 'Automático')}
        {opt('on', 'Ligado')}
        {opt('off', 'Desligado')}
      </div>
    </section>
  );
}

function Stats() {
  const { data } = useApi<StatsData>('stats');
  if (!data) return null;
  const n = (v: number) => v.toLocaleString('pt-BR');
  const items: [string, string][] = [
    ['Listas', n(data.playlists)],
    ['Ao vivo', n(data.live)],
    ['Filmes', n(data.movies)],
    ['Séries', n(data.series)],
    ['Favoritos', n(data.favorites)],
    ['Horas assistidas*', n(data.hoursWatched)],
  ];
  return (
    <section className={`${card} p-4 sm:p-5`}>
      <h2 className="mb-3 font-semibold">Resumo</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-ink-850 px-3 py-2.5">
            <p className="text-lg font-bold tabular-nums">{value}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-slate-500">* Filmes e episódios, pela posição salva de cada um.</p>
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
    const change = async () => {
      // O servidor encerra os logins dos outros aparelhos e devolve um token novo para este.
      const r = await api.put<{ ok: boolean; token?: string }>('auth/password', { current, password });
      if (r.token) setToken(r.token);
    };
    if (await pass.run(change, 'Senha alterada. Os outros aparelhos vão pedir login de novo.')) {
      setCurrent('');
      setPassword('');
    }
  };

  return (
    <Page>
      <PageTitle title="Conta" subtitle={user.email} />
      <div className="space-y-4">
        <Stats />

        <TvModeSection />

        <AndroidAppSection />

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
