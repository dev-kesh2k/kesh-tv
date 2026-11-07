<div align="center">

<img src="frontend/public/icon.svg" width="88" alt="Kesh TV" />

# Kesh TV

**Leitor de listas IPTV M3U para o navegador** — canais ao vivo, filmes e séries no celular, tablet ou computador, sem instalar nada.

![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646cff?logo=vite&logoColor=white)
![Node](https://img.shields.io/badge/Node-22-339933?logo=node.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169e1?logo=postgresql&logoColor=white)
![ffmpeg](https://img.shields.io/badge/ffmpeg-HLS-007808?logo=ffmpeg&logoColor=white)
![Licença](https://img.shields.io/badge/licen%C3%A7a-MIT-green)

</div>

> O app não vem com canais: você usa a sua própria lista M3U (link ou arquivo).

## Recursos

- **Listas por link ou arquivo** — importação em fluxo, aguenta listas enormes (testado com 364 mil itens / 95 MB em ~45 s e ~190 MB de memória); atualização automática diária; reimportar mantém favoritos e recentes.
- **Ao vivo, Filmes e Séries** separados automaticamente (pelo link no padrão Xtream ou pelo grupo), com grupos (`group-title`) e busca.
- **Séries agrupadas** — episódios `S01E02` viram uma série com temporadas, botão *Continuar* e *Próximo episódio*.
- **Player que se vira sozinho** — HLS (hls.js ou nativo no iPhone), MPEG-TS/FLV (mpegts.js) e MP4; se uma fonte falha, tenta a próxima (link direto → proxy → `.m3u8` do Xtream).
- **Conversão no servidor** — MKV, AVI, HEVC 10-bit, Opus… viram HLS na hora com ffmpeg (H.264 só é reempacotado, quase sem CPU), com barra própria de avanço.
- **Proxy seguro** para streams `http://` (bloqueados em páginas HTTPS), servidores sem CORS ou com `User-Agent`/`Referer` próprios (`#EXTVLCOPT`) — links assinados com validade e bloqueio de endereços internos.
- **Favoritos, recentes, vários usuários** (cada um com as próprias listas) e PWA para a tela de início.
- **Layout mobile-first** de 320 px a desktop, tema escuro.

## Como funciona

```
navegador ──► frontend (React + Vite + Tailwind)
                 │  /api
                 ▼
             backend (Express + Prisma) ──► PostgreSQL (listas, canais, favoritos)
                 │
                 ├─ /api/stream   proxy dos streams (reescreve playlists HLS)
                 ├─ /api/logo     proxy das logos (cache 7 dias)
                 └─ /api/convert  ffmpeg → HLS para formatos que o navegador não toca
```

## Rodando localmente

Requisitos: Node 22, PostgreSQL e ffmpeg (para a conversão).

```bash
# backend
cd backend
cp .env.example .env          # ajuste DATABASE_URL, JWT_SECRET e a senha do admin
npm install
npx prisma migrate deploy
npm run db:seed               # cria o admin (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD)
npm start                     # http://localhost:3000/api/health

# frontend (outro terminal)
cd frontend
npm install
npm run dev
```

Com Docker, o `backend/Dockerfile` já traz Node + ffmpeg.

## Variáveis do backend

| Variável | Para quê |
| --- | --- |
| `DATABASE_URL` | PostgreSQL |
| `JWT_SECRET` | assinatura do login e dos links do proxy |
| `PUBLIC_PATH` | prefixo quando o app roda num subcaminho (ex.: `/kesh-tv`) |
| `SEED_ADMIN_*` | admin criado no primeiro start |
| `NODE_OPTIONS` | limite de memória (padrão `--max-old-space-size=256`) |

## Observações

- A conversão guarda as sessões na memória do processo: rode o backend com **1 réplica**.
- Limites: 300 MB / 15 min por lista; até 4 conversões simultâneas (2 recodificando vídeo).
- Use apenas listas e conteúdos que você tem direito de acessar.

## Como as mudanças entram

Toda mudança entra por **pull request** na `main` (o Central Apps Hub abre e mescla o PR); o GitHub Actions publica em produção quando o PR entra na `main`.

## Licença

[MIT](LICENSE)
