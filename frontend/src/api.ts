import { useCallback, useEffect, useState } from 'react';

export const API = `${import.meta.env.BASE_URL}api/`;
const TOKEN_KEY = 'kesh-tv:token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string | null) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

/** Links relativos devolvidos pela API (proxy de stream/logo) viram absolutos. */
export const apiUrl = (u: string) => (!u ? '' : /^https?:\/\//.test(u) ? u : `${API}${u}`);

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => (onUnauthorized = fn);

async function request<T>(method: string, path: string, body?: unknown, raw = false): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': raw ? 'text/plain' : 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : raw ? (body as BodyInit) : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Sem conexão com o servidor');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized();
    throw new ApiError(res.status, data.error || `Erro ${res.status}`);
  }
  return data as T;
}

export const api = {
  get: <T>(p: string) => request<T>('GET', p),
  post: <T>(p: string, b: unknown = {}) => request<T>('POST', p, b),
  put: <T>(p: string, b: unknown) => request<T>('PUT', p, b),
  del: <T>(p: string) => request<T>('DELETE', p),
  upload: <T>(p: string, text: Blob | string) => request<T>('POST', p, text, true),
};

export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!!path);

  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      setData(await api.get<T>(path));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, loading, reload, setData };
}

export type Kind = 'live' | 'movie' | 'series';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt?: string;
}

export interface Playlist {
  id: string;
  name: string;
  url: string | null;
  autoRefresh: boolean;
  channelCount: number;
  liveCount: number;
  movieCount: number;
  seriesCount: number;
  status: 'pending' | 'syncing' | 'ok' | 'error';
  error: string | null;
  syncedAt: string | null;
  syncProgress: number;
  epgUrl: string | null;
  epgCount: number;
  epgError: string | null;
  epgSyncedAt: string | null;
}

export interface Channel {
  id: string;
  name: string;
  group: string;
  kind: Kind;
  playlistId: string;
  logo: string;
  favorite: boolean;
  watchedAt?: string;
  /** Recentes: segundos para continuar e fração assistida (0–1). */
  position?: number;
  progress?: number;
  /** Guia de programação (canais ao vivo com tvg-id). */
  now?: Programme;
  next?: Programme;
}

export interface Programme {
  title: string;
  start: string;
  stop: string;
  desc?: string;
}

/** Fração já exibida do programa (0–1). */
export function programmeProgress(p: Programme, at = Date.now()) {
  const a = Date.parse(p.start);
  const b = Date.parse(p.stop);
  return b > a ? Math.min(1, Math.max(0, (at - a) / (b - a))) : 0;
}

export const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export interface Series {
  playlistId: string;
  name: string;
  group: string;
  logo: string;
  episodes: number;
  seasons: number;
}

export interface Episode extends Channel {
  season: number;
  episode: number;
}

export const seriesLink = (s: { playlistId: string; name: string }) => `/serie/${s.playlistId}?nome=${encodeURIComponent(s.name)}`;

export interface Group {
  name: string;
  count: number;
}

export interface Source {
  type: 'hls' | 'ts' | 'flv' | 'file' | 'convert';
  via: 'direct' | 'proxy';
  url: string;
}

export const KIND_LABEL: Record<Kind, string> = { live: 'Ao vivo', movie: 'Filmes', series: 'Séries' };

export async function toggleFavorite(c: Channel): Promise<boolean> {
  if (c.favorite) await api.del(`favorites/${c.id}`);
  else await api.post(`favorites/${c.id}`);
  return !c.favorite;
}
