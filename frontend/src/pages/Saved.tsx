import { useRef, useState } from 'react';
import { Download, Heart, History, Trash2, Upload } from 'lucide-react';
import { api, API, Channel, getToken, useApi } from '../api';
import { ChannelGrid } from '../components/ChannelCard';
import { useTitle } from '../useTitle';
import { Page } from '../components/Layout';
import { btnGhost, Empty, ErrorBox, PageTitle, Spinner } from '../components/ui';

interface ImportResult {
  imported: number;
  already: number;
  notFound: number;
  missing: string[];
}

export function Favorites() {
  const { data, error, loading, setData, reload } = useApi<{ channels: Channel[] }>('favorites');
  const list = data?.channels || [];
  const fileRef = useRef<HTMLInputElement>(null);
  useTitle('Favoritos');
  const [msg, setMsg] = useState('');
  const [ioError, setIoError] = useState('');
  // Desfavoritar aqui tira o canal da lista.
  const update = (c: Channel) => setData({ channels: list.filter((x) => x.id !== c.id || c.favorite) });

  const exportFile = async () => {
    setIoError('');
    try {
      const res = await fetch(`${API}favorites/export`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `kesh-tv-favoritos-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setIoError(`Não foi possível exportar: ${(e as Error).message}`);
    }
  };

  const importFile = async (file?: File) => {
    if (!file) return;
    setMsg('');
    setIoError('');
    try {
      const json = JSON.parse(await file.text());
      const r = await api.post<ImportResult>('favorites/import', json);
      setMsg(
        `${r.imported} adicionado(s)` +
          (r.already ? `, ${r.already} já estava(m) nos favoritos` : '') +
          (r.notFound ? `, ${r.notFound} não encontrado(s) nas suas listas${r.missing.length ? ` (ex.: ${r.missing.slice(0, 3).join(', ')})` : ''}` : '') +
          '.',
      );
      reload();
    } catch (e) {
      setIoError(e instanceof SyntaxError ? 'O arquivo não é um JSON válido.' : (e as Error).message);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Page wide>
      <PageTitle
        title="Favoritos"
        subtitle={list.length ? `${list.length} canal(is)` : undefined}
        action={
          <div className="flex flex-wrap gap-2">
            {list.length > 0 && (
              <button type="button" className={btnGhost} onClick={exportFile} title="Baixar os favoritos em um arquivo (para trocar de lista ou de aparelho)">
                <Download className="h-4 w-4" /> Exportar
              </button>
            )}
            <button type="button" className={btnGhost} onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Importar
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => importFile(e.target.files?.[0])} />
          </div>
        }
      />
      <ErrorBox message={error || ioError} />
      {msg && <p className="mb-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-sm text-emerald-200">{msg}</p>}
      {loading && !data ? (
        <Spinner />
      ) : list.length ? (
        <ChannelGrid channels={list} onChange={update} />
      ) : (
        <Empty icon={<Heart className="h-7 w-7" />} title="Nenhum favorito">
          Toque no coração de um canal para guardar aqui, ou importe um arquivo de favoritos.
        </Empty>
      )}
    </Page>
  );
}

export function Recent() {
  const { data, error, loading, setData } = useApi<{ channels: Channel[] }>('history');
  useTitle('Recentes');
  const list = data?.channels || [];
  const update = (c: Channel) => setData({ channels: list.map((x) => (x.id === c.id ? c : x)) });
  const clear = async () => {
    if (!confirm('Limpar o histórico de canais assistidos?')) return;
    await api.del('history');
    setData({ channels: [] });
  };
  return (
    <Page wide>
      <PageTitle
        title="Recentes"
        subtitle="Últimos canais que você assistiu"
        action={
          list.length > 0 && (
            <button type="button" className={btnGhost} onClick={clear}>
              <Trash2 className="h-4 w-4" /> Limpar
            </button>
          )
        }
      />
      <ErrorBox message={error} />
      {loading && !data ? (
        <Spinner />
      ) : list.length ? (
        <ChannelGrid channels={list} onChange={update} />
      ) : (
        <Empty icon={<History className="h-7 w-7" />} title="Nada assistido ainda">
          Os canais que você abrir aparecem aqui.
        </Empty>
      )}
    </Page>
  );
}
