# Kesh TV

Leitor de listas IPTV M3U: adicione a lista por link (atualizada sozinha 1×/dia) ou por arquivo e assista aos canais no navegador do celular, tablet ou computador.

- Canais separados em Ao vivo, Filmes e Séries, por grupo (`group-title`), com busca, favoritos e recentes.
- Player: HLS (hls.js / nativo no iPhone), MPEG-TS e FLV (mpegts.js) e arquivos (MP4). Se uma fonte falhar, tenta a próxima: link direto → proxy do servidor; em servidores Xtream tenta também a versão `.m3u8` do canal.
- Proxy no servidor (`/api/stream`, links assinados com validade) para streams `http://` (bloqueados em página HTTPS), sem CORS ou com `User-Agent`/`Referer` próprios (`#EXTVLCOPT`). Endereços internos (loopback, Docker, metadados) são bloqueados.
- Logos pelo proxy `/api/logo` (cache de 7 dias no navegador).
- Reimportar a lista mantém favoritos e recentes dos canais que continuam nela (chave = URL do canal).
- Usuários: o admin cria outros usuários em Conta; cada um tem as próprias listas.

frontend/: React + Vite + Tailwind. backend/: Express + Prisma (PostgreSQL).
Login inicial: SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD do backend/.env.example.
