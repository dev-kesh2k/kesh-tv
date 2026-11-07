import { FormEvent, useEffect, useRef, useState } from 'react';
import { AlertCircle, CalendarClock, CheckCircle2, FileUp, Link2, ListVideo, Loader2, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { api, Playlist, useApi } from '../api';
import { Page } from '../components/Layout';
import { btnDanger, btnGhost, btnPrimary, card, Empty, ErrorBox, input, PageTitle, Spinner, Switch } from '../components/ui';
import { useTitle } from '../useTitle';

const fmt = (n: number) => n.toLocaleString('pt-BR');
const when = (s: string | null) => (s ? new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'nunca');

function AddForm({ onDone, onCancel }: { onDone: () => void; onCancel?: () => void }) {
  const [mode, setMode] = useState<'url' | 'file'>('url');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'url') await api.post('playlists', { name, url });
      else {
        if (!file) throw new Error('Escolha o arquivo .m3u');
        if (file.size > 95 * 1024 * 1024) throw new Error('Arquivo grande demais (máx. 95 MB). Use o link da lista.');
        await api.upload(`playlists/upload?name=${encodeURIComponent(name || file.name.replace(/\.m3u8?$/i, ''))}`, file);
      }
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const tab = (m: 'url' | 'file', label: string, Icon: typeof Link2) => (
    <button type="button" onClick={() => setMode(m)} className={`flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-lg text-sm font-semibold ${mode === m ? 'bg-ink-700 text-white' : 'text-slate-400'}`}>
      <Icon className="h-4 w-4" /> {label}
    </button>
  );

  return (
    <form onSubmit={submit} className={`${card} mb-5 space-y-3 p-4 sm:p-5`}>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Adicionar lista</h2>
        {onCancel && (
          <button type="button" aria-label="Fechar" onClick={onCancel} className="grid h-10 w-10 place-items-center rounded-full text-slate-400 hover:bg-ink-800">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      <div className="flex gap-1 rounded-xl bg-ink-850 p-1">
        {tab('url', 'Por link', Link2)}
        {tab('file', 'Por arquivo', FileUp)}
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-400">Nome (opcional)</span>
        <input className={input} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Minha IPTV" />
      </label>
      {mode === 'url' ? (
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Link da lista M3U</span>
          <input className={input} type="url" inputMode="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://servidor/get.php?username=…&type=m3u_plus" />
          <span className="mt-1 block text-xs text-slate-500">Atualizada sozinha 1× por dia.</span>
        </label>
      ) : (
        <label className="flex min-h-[88px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-ink-600 bg-ink-850 p-4 text-center text-sm text-slate-400 hover:border-brand">
          <FileUp className="h-6 w-6" />
          <span className="max-w-full break-all">{file ? file.name : 'Toque para escolher o arquivo .m3u / .m3u8'}</span>
          <input type="file" accept=".m3u,.m3u8,audio/x-mpegurl,application/x-mpegurl,text/plain" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>
      )}
      <ErrorBox message={error} />
      <button className={`${btnPrimary} w-full sm:w-auto`} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {busy ? 'Enviando…' : 'Adicionar'}
      </button>
    </form>
  );
}

function PlaylistCard({ pl, onChanged }: { pl: Playlist; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(pl.name);
  const [url, setUrl] = useState(pl.url || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      onChanged();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (await run(() => api.put(`playlists/${pl.id}`, pl.url ? { name, url } : { name }))) setEditing(false);
  };
  const remove = () => confirm(`Excluir a lista "${pl.name}"? Favoritos e recentes dela também saem.`) && run(() => api.del(`playlists/${pl.id}`));
  const refresh = () => (pl.url ? run(() => api.post(`playlists/${pl.id}/refresh`)) : fileRef.current?.click());
  const reupload = (f: File | undefined) => f && run(() => api.upload(`playlists/upload?id=${pl.id}`, f));

  const syncing = pl.status === 'syncing';
  return (
    <div className={`${card} p-4 sm:p-5`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-display truncate text-xl text-slate-100">{pl.name}</h3>
          <p className="truncate text-xs text-slate-500">{pl.url ? pl.url.replace(/(username|password)=[^&]+/gi, '$1=•••') : 'Arquivo enviado'}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {syncing ? (
          <span className="flex items-center gap-1.5 text-amber-300">
            <Loader2 className="h-4 w-4 animate-spin" /> {pl.syncProgress ? `Importando… ${fmt(pl.syncProgress)} itens` : pl.url ? 'Baixando a lista… (listas grandes levam alguns minutos)' : 'Importando…'}
          </span>
        ) : pl.status === 'error' ? (
          <span className="flex items-start gap-1.5 text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {pl.error}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-emerald-300">
            <CheckCircle2 className="h-4 w-4" /> Atualizada {when(pl.syncedAt)}
          </span>
        )}
      </div>
      {pl.epgUrl && pl.status === 'ok' && (
        <p className={`mt-2 flex items-start gap-1.5 text-sm ${pl.epgError ? 'text-amber-300' : 'text-slate-400'}`}>
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
          {pl.epgError || (pl.epgSyncedAt ? `Guia de programação: ${fmt(pl.epgCount)} programas (atualizado ${when(pl.epgSyncedAt)})` : 'Baixando o guia de programação…')}
        </p>
      )}
      {pl.channelCount > 0 && (
        <p className="mt-2 text-sm text-slate-300">
          {fmt(pl.liveCount)} ao vivo, {fmt(pl.movieCount)} filmes, {fmt(pl.seriesCount)} séries
        </p>
      )}

      {editing ? (
        <form onSubmit={save} className="mt-4 space-y-3">
          <input className={input} value={name} maxLength={80} required onChange={(e) => setName(e.target.value)} placeholder="Nome" />
          {pl.url && <input className={input} type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Link da lista" />}
          <div className="flex flex-wrap gap-2">
            <button className={btnPrimary} disabled={busy}>
              Salvar
            </button>
            <button type="button" className={btnGhost} onClick={() => setEditing(false)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" className={btnGhost} onClick={refresh} disabled={busy || syncing}>
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} /> {pl.url ? 'Atualizar' : 'Enviar de novo'}
          </button>
          <button type="button" className={btnGhost} onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" /> Editar
          </button>
          <button type="button" className={btnDanger} onClick={remove} disabled={busy}>
            <Trash2 className="h-4 w-4" /> Excluir
          </button>
          <input ref={fileRef} type="file" accept=".m3u,.m3u8,text/plain" className="sr-only" onChange={(e) => reupload(e.target.files?.[0])} />
        </div>
      )}
      {pl.url && !editing && (
        <div className="mt-2">
          <Switch checked={pl.autoRefresh} label="Atualizar sozinha todo dia" onChange={(v) => run(() => api.put(`playlists/${pl.id}`, { autoRefresh: v }))} />
        </div>
      )}
      <div className="mt-2">
        <ErrorBox message={error} />
      </div>
    </div>
  );
}

export default function Playlists() {
  const { data, error, loading, reload } = useApi<{ playlists: Playlist[] }>('playlists');
  const [adding, setAdding] = useState(false);
  const list = data?.playlists || [];
  const syncing = list.some((p) => p.status === 'syncing');
  useTitle('Listas');

  // Enquanto alguma lista importa, consulta o andamento a cada 2 s.
  useEffect(() => {
    if (!syncing) return;
    const t = setInterval(reload, 2000);
    return () => clearInterval(t);
  }, [syncing, reload]);

  return (
    <Page>
      <PageTitle
        title="Listas M3U"
        subtitle="Suas fontes de canais"
        action={
          list.length > 0 &&
          !adding && (
            <button type="button" className={btnPrimary} onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> Adicionar
            </button>
          )
        }
      />
      <ErrorBox message={error} />
      {(adding || (!loading && !list.length)) && (
        <AddForm
          onDone={() => {
            setAdding(false);
            reload();
          }}
          onCancel={list.length ? () => setAdding(false) : undefined}
        />
      )}
      {loading && !data ? (
        <Spinner />
      ) : list.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((pl) => (
            <PlaylistCard key={`${pl.id}-${pl.syncedAt}-${pl.name}`} pl={pl} onChanged={reload} />
          ))}
        </div>
      ) : (
        !adding && <Empty icon={<ListVideo className="h-7 w-7" />} title="Nenhuma lista" />
      )}
    </Page>
  );
}
