import { useEffect } from 'react';

/** Título da aba do navegador: "<página> · Kesh TV". */
export function useTitle(title?: string | null) {
  useEffect(() => {
    document.title = title ? `${title} · Kesh TV` : 'Kesh TV';
  }, [title]);
}
