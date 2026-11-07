import express from 'express';
import { api } from './routes.js';
import { HttpError } from './db.js';
import { startAutoRefresh } from './sync.js';

const app = express();
app.set('trust proxy', true);
app.disable('x-powered-by');
app.use((req, res, next) => (req.path.endsWith('/playlists/upload') ? next() : express.json({ limit: '200kb' })(req, res, next)));

// O proxy pode repassar /api/..., o caminho completo /<slug>/api/... ou já sem o prefixo.
const publicPath = String(process.env.PUBLIC_PATH || '').replace(/\/+$/, '');
app.get(['/health', `${publicPath}/health`], (_req, res) => res.json({ ok: true }));
if (publicPath) app.use(`${publicPath}/api`, api);
app.use('/api', api);
app.use('/', api);

app.use((_req, res) => res.status(404).json({ error: 'Rota não encontrada' }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (res.headersSent) return res.destroy();
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Arquivo grande demais (máx. 80 MB)' });
  if (err?.code === 'P2025') return res.status(404).json({ error: 'Registro não encontrado' });
  if (err?.code === 'P2002') return res.status(409).json({ error: 'Registro duplicado' });
  const status = err instanceof HttpError ? err.status : err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Erro interno' : err.message });
});

const port = Number(process.env.PORT) || 3000;
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Kesh TV API ouvindo em 0.0.0.0:${port} (prefixo ${publicPath || '/'})`);
  startAutoRefresh();
});
// Importação de listas grandes pode levar minutos; streams ficam abertos indefinidamente.
server.requestTimeout = 0;
server.headersTimeout = 60_000;
