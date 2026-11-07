// Formato do arquivo de favoritos exportado/importado (JSON).

export const MAX_IMPORT = 5000;

/** Monta o arquivo de exportação. */
export function buildExport(channels) {
  return {
    app: 'kesh-tv',
    version: 1,
    exportedAt: new Date().toISOString(),
    favorites: channels.map((c) => ({ name: c.name, url: c.url, group: c.groupTitle, kind: c.kind })),
  };
}

/** Valida o arquivo recebido e devolve só itens bem formados (url http(s) e/ou nome). */
export function parseImport(body) {
  const list = Array.isArray(body) ? body : body?.favorites;
  if (!Array.isArray(list)) throw new Error('Arquivo inválido: esperado um JSON exportado pelo Kesh TV');
  if (list.length > MAX_IMPORT) throw new Error(`Máximo de ${MAX_IMPORT} favoritos por arquivo`);
  return list
    .map((f) => ({
      name: typeof f?.name === 'string' ? f.name.trim().slice(0, 200) : '',
      url: typeof f?.url === 'string' && /^https?:\/\//i.test(f.url) ? f.url.trim().slice(0, 2000) : '',
      kind: ['live', 'movie', 'series'].includes(f?.kind) ? f.kind : null,
    }))
    .filter((f) => f.url || f.name);
}
