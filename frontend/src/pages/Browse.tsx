import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronDown, EyeOff, Layers, ListVideo, Search, Tv, X } from 'lucide-react';
import { api, Channel, Group, Kind, KIND_LABEL, Playlist, Series, useApi } from '../api';
import { ChannelGrid, SeriesGrid, Shelf, SkeletonGrid } from '../components/ChannelCard';
import { Logo, Page } from '../components/Layout';
import { btnPrimary, Empty, ErrorBox, input, Spinner } from '../components/ui';
import { useTitle } from '../useTitle';
import { useAuth } from '../auth';

const PAGE = 60;
const ALL = '__all';

function GroupList({ groups, total, current, onPick, onHide }: { groups: Group[]; total: number; current: string; onPick: (g: string) => void; onHide: (g: string) => void }) {
  const [filter, setFilter] = useState('');
  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return f ? groups.filter((g) => (g.name || 'Sem grupo').toLowerCase().includes(f)) : groups;
  }, [groups, filter]);
  const item = (name: string, label: string, count: number) => (
    <div key={name} className={`group/item flex items-center rounded-xl transition ${current === name ? 'bg-brand/15' : 'hover:bg-ink-800'}`}>
      <button
        type="button"
        onClick={() => onPick(name)}
        className={`flex min-h-[44px] min-w-0 flex-1 items-center justify-between gap-2 px-3 text-left text-sm ${current === name ? 'font-semibold text-brand-light' : 'text-slate-300'}`}
      >
        <span className="min-w-0 truncate">{label}</span>
        <span className="shrink-0 text-xs text-slate-500">{count.toLocaleString('pt-BR')}</span>
      </button>
      {name !== ALL && (
        <button
          type="button"
          onClick={() => onHide(name)}
          aria-label={`Ocultar o grupo ${label}`}
          title="Ocultar este grupo"
          className="grid h-10 w-9 shrink-0 place-items-center rounded-lg text-slate-600 hover:text-slate-200 lg:opacity-0 lg:group-hover/item:opacity-100"
        >
          <EyeOff className="h-4 w-4" />
        </button>
      )}
    </div>
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {groups.length > 8 && (
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input className={`${input} pl-9`} placeholder="Filtrar grupos" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
      )}
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain pr-1">
        {!filter && item(ALL, 'Todos', total)}
        {shown.map((g) => item(g.name, g.name || 'Sem grupo', g.count))}
      </div>
    </div>
  );
}

export default function Browse() {
  const [params, setParams] = useSearchParams();
  const kind = (['live', 'movie', 'series'].includes(params.get('tipo') || '') ? params.get('tipo') : 'live') as Kind;
  const group = params.get('grupo') ?? ALL;
  const q = params.get('q') || '';
  const [search, setSearch] = useState(q);
  const [sheet, setSheet] = useState(false);
  const { user, setUser } = useAuth();
  const hideGroup = async (g: string) => {
    if (!user || !confirm(`Ocultar o grupo "${g || 'Sem grupo'}"? Ele some dos canais e da busca; dá para mostrar de novo em Conta.`)) return;
    const r = await api.put<{ hiddenGroups: string[] }>('prefs/hidden-groups', { groups: [...(user.hiddenGroups || []), g] });
    setUser({ ...user, hiddenGroups: r.hiddenGroups });
    if (group === g) set({ grupo: null });
  };
  useTitle(q ? `Busca: ${q}` : group !== ALL ? `${group || 'Sem grupo'} · ${KIND_LABEL[kind]}` : KIND_LABEL[kind]);

  const { data: pls, loading: plLoading } = useApi<{ playlists: Playlist[] }>('playlists');
  const { data: favs } = useApi<{ channels: Channel[] }>('favorites');
  const { data: hist } = useApi<{ channels: Channel[] }>('history');
  const playlists = pls?.playlists || [];
  const counts = useMemo(
    () => ({
      live: playlists.reduce((s, p) => s + p.liveCount, 0),
      movie: playlists.reduce((s, p) => s + p.movieCount, 0),
      series: playlists.reduce((s, p) => s + p.seriesCount, 0),
    }),
    [playlists],
  );
  const kinds = (Object.keys(KIND_LABEL) as Kind[]).filter((k) => k === 'live' || counts[k] > 0);
  const { data: gdata, reload: reloadGroups } = useApi<{ groups: Group[]; total: number }>(q ? null : `groups?kind=${kind}`);

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v === null || v === '' ? next.delete(k) : next.set(k, v));
    setParams(next, { replace: true });
  };

  // Busca com atraso para não consultar a cada letra.
  useEffect(() => setSearch(q), [q]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (search.trim() !== q) set({ q: search.trim() || null });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reqId = useRef(0);
  // Aba Séries mostra cada série uma vez; a busca mostra séries (até 18) e, abaixo, canais e filmes.
  const seriesMode = !q && kind === 'series';

  const query = useMemo(() => {
    const p = new URLSearchParams({ limit: String(PAGE) });
    if (q) p.set('q', q);
    else {
      if (!seriesMode) p.set('kind', kind);
      if (group !== ALL) p.set('group', group);
    }
    return p.toString();
  }, [kind, group, q, seriesMode]);

  const load = useCallback(
    async (offset: number) => {
      const id = ++reqId.current;
      setLoading(true);
      try {
        if (seriesMode) {
          const r = await api.get<{ series: Series[]; hasMore: boolean }>(`series?${query}&offset=${offset}`);
          if (id !== reqId.current) return;
          setSeries((prev) => (offset ? [...prev, ...r.series] : r.series));
          setHasMore(r.hasMore);
        } else {
          const [r, s] = await Promise.all([
            api.get<{ channels: Channel[]; hasMore: boolean }>(`channels?${query}&offset=${offset}`),
            q && !offset ? api.get<{ series: Series[] }>(`series?q=${encodeURIComponent(q)}&limit=18`) : null,
          ]);
          if (id !== reqId.current) return;
          setChannels((prev) => (offset ? [...prev, ...r.channels] : r.channels));
          if (!offset) setSeries(s?.series || []);
          setHasMore(r.hasMore);
        }
        setError('');
      } catch (e) {
        if (id === reqId.current) setError((e as Error).message);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [query, seriesMode, q],
  );

  useEffect(() => {
    setChannels([]);
    setSeries([]);
    load(0);
  }, [load]);

  // Grupo ocultado/mostrado: recarrega grupos e canais.
  const hiddenKey = (user?.hiddenGroups || []).join('\u0001');
  const firstHidden = useRef(true);
  useEffect(() => {
    if (firstHidden.current) {
      firstHidden.current = false;
      return;
    }
    reloadGroups();
    load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hiddenKey]);

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || loading) return;
    const obs = new IntersectionObserver((e) => e[0].isIntersecting && load(seriesMode ? series.length : channels.length), { rootMargin: '600px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loading, channels.length, series.length, seriesMode, load]);

  const update = (c: Channel) => setChannels((list) => list.map((x) => (x.id === c.id ? c : x)));
  const pickGroup = (g: string) => {
    set({ grupo: g === ALL ? null : g });
    setSheet(false);
    window.scrollTo({ top: 0 });
  };

  if (plLoading && !pls) return <Spinner label="Carregando…" />;
  if (!playlists.length)
    return (
      <Page>
        <div className="mb-2 lg:hidden">
          <Logo />
        </div>
        <Empty icon={<ListVideo className="h-7 w-7" />} title="Nenhuma lista ainda">
          <p>Adicione o link ou o arquivo da sua lista M3U para ver os canais aqui.</p>
          <Link to="/listas" className={`${btnPrimary} mt-5`}>
            Adicionar lista
          </Link>
        </Empty>
      </Page>
    );

  const groups = gdata?.groups || [];
  // Atalhos no topo (só na visão "Todos"): favoritos ao vivo e o que ficou pela metade em filmes/séries.
  const showShelf = !q && group === ALL;
  const shelf =
    kind === 'live'
      ? (favs?.channels || []).filter((c) => c.kind === 'live')
      : (hist?.channels || []).filter((c) => c.kind === kind && (c.progress || 0) > 0 && (c.progress || 0) < 1);
  const groupLabel = group === ALL ? 'Todos os grupos' : group || 'Sem grupo';

  return (
    <Page wide>
      <div className="mb-3 flex items-center gap-3">
        <div className="shrink-0 lg:hidden">
          <Logo />
        </div>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input className={`${input} pl-9 pr-10`} placeholder="Buscar canal, filme ou série" value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && (
            <button type="button" aria-label="Limpar busca" onClick={() => setSearch('')} className="absolute right-0 top-0 grid h-11 w-11 place-items-center text-slate-500">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {!q && (
        <div className="no-scrollbar -mx-3 mb-4 flex gap-2 overflow-x-auto px-3 sm:mx-0 sm:px-0">
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => set({ tipo: k === 'live' ? null : k, grupo: null })}
              className={`min-h-[40px] shrink-0 rounded-full px-4 text-sm font-semibold transition ${kind === k ? 'bg-brand text-white' : 'bg-ink-800 text-slate-300 hover:bg-ink-700'}`}
            >
              {KIND_LABEL[k]} <span className="ml-1 text-xs opacity-70">{counts[k].toLocaleString('pt-BR')}</span>
            </button>
          ))}
        </div>
      )}

      <div className="lg:flex lg:items-start lg:gap-6">
        {!q && (
          <aside className="sticky top-4 hidden h-[calc(100dvh-8rem)] w-64 shrink-0 flex-col lg:flex">
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Grupos</p>
            <GroupList groups={groups} total={gdata?.total || 0} current={group} onPick={pickGroup} onHide={hideGroup} />
          </aside>
        )}

        <section className="min-w-0 flex-1">
          {!q && (
            <button type="button" onClick={() => setSheet(true)} className="mb-3 flex min-h-[44px] w-full items-center gap-2 rounded-xl border border-ink-700 bg-ink-900 px-3.5 text-left text-sm lg:hidden">
              <Layers className="h-4 w-4 shrink-0 text-slate-500" />
              <span className="min-w-0 flex-1 truncate">{groupLabel}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
            </button>
          )}
          {q && <p className="mb-3 text-sm text-slate-400">Resultados para “{q}”</p>}
          {showShelf && <Shelf title={kind === 'live' ? 'Seus favoritos' : 'Continuar assistindo'} channels={shelf.slice(0, 20)} />}
          <ErrorBox message={error} />
          {series.length > 0 && (
            <>
              {q && <h2 className="mb-2 text-sm font-semibold text-slate-300">Séries</h2>}
              <SeriesGrid series={series} />
              {q && channels.length > 0 && <h2 className="mb-2 mt-6 text-sm font-semibold text-slate-300">Canais e filmes</h2>}
            </>
          )}
          {channels.length > 0 && <ChannelGrid channels={channels} onChange={update} />}
          {!loading && !error && !channels.length && !series.length && (
            <Empty icon={<Tv className="h-7 w-7" />} title={q ? 'Nada encontrado' : 'Nada aqui'}>
              {q ? 'Tente outro nome.' : 'Escolha outro grupo ou tipo.'}
            </Empty>
          )}
          {loading && (channels.length || series.length ? <Spinner /> : <SkeletonGrid poster={kind !== 'live' && !q} />)}
          <div ref={sentinel} className="h-1" />
        </section>
      </div>

      {sheet && (
        <div className="fixed inset-0 z-40 flex flex-col bg-ink-950 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] lg:hidden">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">Grupos · {KIND_LABEL[kind]}</h2>
            <button type="button" aria-label="Fechar" onClick={() => setSheet(false)} className="grid h-11 w-11 place-items-center rounded-full bg-ink-800">
              <X className="h-5 w-5" />
            </button>
          </div>
          <GroupList groups={groups} total={gdata?.total || 0} current={group} onPick={pickGroup} onHide={hideGroup} />
        </div>
      )}
    </Page>
  );
}
