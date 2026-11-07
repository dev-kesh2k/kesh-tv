import { Heart, History, Trash2 } from 'lucide-react';
import { api, Channel, useApi } from '../api';
import { ChannelGrid } from '../components/ChannelCard';
import { Page } from '../components/Layout';
import { btnGhost, Empty, ErrorBox, PageTitle, Spinner } from '../components/ui';

export function Favorites() {
  const { data, error, loading, setData } = useApi<{ channels: Channel[] }>('favorites');
  const list = data?.channels || [];
  // Desfavoritar aqui tira o canal da lista.
  const update = (c: Channel) => setData({ channels: list.filter((x) => x.id !== c.id || c.favorite) });
  return (
    <Page wide>
      <PageTitle title="Favoritos" subtitle={list.length ? `${list.length} canal(is)` : undefined} />
      <ErrorBox message={error} />
      {loading && !data ? (
        <Spinner />
      ) : list.length ? (
        <ChannelGrid channels={list} onChange={update} />
      ) : (
        <Empty icon={<Heart className="h-7 w-7" />} title="Nenhum favorito">
          Toque no coração de um canal para guardar aqui.
        </Empty>
      )}
    </Page>
  );
}

export function Recent() {
  const { data, error, loading, setData } = useApi<{ channels: Channel[] }>('history');
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
