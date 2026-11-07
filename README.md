<div align="center">

<img src="frontend/public/icon.svg" width="88" alt="Kesh TV" />

# Kesh TV

**Leitor de listas IPTV M3U para o navegador** — canais ao vivo, filmes e séries no celular, tablet ou computador, sem instalar nada.

[![CI](https://github.com/dev-kesh2k/kesh-tv/actions/workflows/ci.yml/badge.svg)](https://github.com/dev-kesh2k/kesh-tv/actions/workflows/ci.yml)
![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646cff?logo=vite&logoColor=white)
![Node](https://img.shields.io/badge/Node-22-339933?logo=node.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169e1?logo=postgresql&logoColor=white)
![ffmpeg](https://img.shields.io/badge/ffmpeg-HLS-007808?logo=ffmpeg&logoColor=white)
![Licença](https://img.shields.io/badge/licen%C3%A7a-MIT-green)

</div>

> O app não vem com canais: você usa a sua própria lista M3U (link ou arquivo).

<p align="center">
  <img src="docs/screenshots/desktop-canais.png" width="72%" alt="Canais ao vivo no computador" />
  <img src="docs/screenshots/celular-canais.png" width="24%" alt="Canais ao vivo no celular" />
</p>

<details>
<summary><b>Mais telas</b></summary>

| Player | Séries | Filmes |
| --- | --- | --- |
| <img src="docs/screenshots/celular-player.png" alt="Player no celular" /> | <img src="docs/screenshots/celular-serie.png" alt="Temporadas e episódios" /> | <img src="docs/screenshots/celular-filmes.png" alt="Filmes" /> |

<img src="docs/screenshots/desktop-player.png" alt="Player no computador" />
<img src="docs/screenshots/desktop-series.png" alt="Séries no computador" />

<sub>Telas com uma lista de demonstração (vídeos de teste livres e imagens genéricas).</sub>
</details>

## Recursos

**Listas e canais**
- Listas M3U por **link** (atualização automática diária) ou **arquivo**; importação em fluxo para listas enormes (testado com 364 mil itens / 95 MB em ~45 s e ~190 MB de memória), com progresso na tela.
- **Ao vivo, Filmes e Séries** separados automaticamente (pelo link no padrão Xtream ou pelo grupo), com grupos (`group-title`) em fileira de botões ou lista lateral, ordem A–Z opcional e **grupos ocultos**.
- **Busca sem acentos** ("acao" acha "Ação") em canais, filmes e séries.
- **Séries agrupadas** por temporada, com *Continuar* e *Próximo episódio*.
- **Favoritos** (com exportar/importar em JSON), **Recentes** com barra de progresso e **continuar de onde parou** em filmes e episódios.
- **Guia de programação (EPG)**: descobre o XMLTV da lista e mostra o programa no ar nos cartões e a programação na tela do canal.

**Player**
- HLS (hls.js ou nativo no iPhone), MPEG-TS/FLV (mpegts.js) e MP4, com troca automática de fonte (link direto → proxy → `.m3u8` do Xtream).
- **Conversão no servidor** (ffmpeg → HLS) para MKV, AVI, HEVC/H.264 10 bits e Opus, com barra própria de avanço.
- Atalhos de teclado e controle remoto, **mini player** (Picture-in-Picture) e **timer para desligar**.

**Plataformas**
- **Celular, tablet e computador** (layout mobile-first, PWA instalável que abre sem internet).
- **TV**: modo TV automático (Android TV, Fire TV, Samsung, LG) com escala para telas de 32" a 100", navegação pelo controle remoto e player em tela cheia.
- **App Android** (celular e Android TV) com gerador de APK.

**Outros**
- Vários usuários (cada um com as próprias listas), resumo em Conta e proxy seguro para streams `http://`, servidores sem CORS ou com `User-Agent`/`Referer` próprios.

## Como funciona

```
 navegador / app Android / TV
            │
            ▼
 frontend  (React + Vite + Tailwind — frontend/)
            │  /api/...
            ▼
 backend   (Express + Prisma — backend/src/)
   ├─ routes.js      rotas da API (login, listas, canais, séries, favoritos, histórico)
   ├─ sync.js        importação das listas em fluxo + atualização automática
   ├─ m3u.js         leitor M3U (atributos, grupos, séries SxxEyy, busca sem acento)
   ├─ epg.js/xmltv.js guia de programação (XMLTV em fluxo, agora/a seguir)
   ├─ stream.js      proxy de streams e logos (reescreve playlists HLS)
   ├─ convert.js     ffmpeg → HLS para formatos que o navegador não toca
   ├─ net.js         rede segura (bloqueio de endereços internos, links assinados)
   └─ auth.js        login (JWT com versão de senha) e limite de tentativas
            │
            ▼
 PostgreSQL  (usuários, listas, canais, programas, favoritos, histórico)
```

- **Listas**: o arquivo é lido linha a linha enquanto baixa e gravado em lotes de 2000 (`INSERT … ON CONFLICT`), então listas de centenas de milhares de itens cabem em pouca memória. Canais que continuam na lista mantêm o id — favoritos e recentes não se perdem.
- **Reprodução**: `GET /channels/:id/play` devolve as fontes em ordem de tentativa; o player passa para a próxima se uma falhar (ou não começar a tempo).
- **Proxy**: streams `http://`, sem CORS ou com cabeçalhos próprios passam por `/api/stream` com **links assinados** (HMAC + validade), porque `<video>` e `<img>` não mandam o token de login.
- **Conversão**: arquivos que o navegador não toca viram HLS na hora; H.264 de 8 bits só é reempacotado (quase sem CPU), o resto vira H.264. O ffmpeg pausa quando está ~3 min à frente do que está sendo assistido.

## Instalação rápida (Docker)

Banco, API (com ffmpeg) e frontend com um comando:

```bash
git clone https://github.com/dev-kesh2k/kesh-tv.git && cd kesh-tv
cp deploy/docker/.env.example deploy/docker/.env   # troque as senhas
docker compose -f deploy/docker/compose.yml up -d --build
```

Abra **http://localhost:8080**, entre com `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` e adicione sua lista em **Listas**.

## App Android (celular e Android TV)

[**⬇️ Baixar kesh-tv.apk**](https://github.com/dev-kesh2k/kesh-tv/releases/latest/download/kesh-tv.apk) — funciona em celulares e em Android TV (TV Box, Fire TV, Chromecast com Google TV), com ícone na tela inicial da TV, navegação pelo controle remoto e escala automática para TVs de 32" a 100".

### Gerar o APK

- **Pelo GitHub:** Actions → *APK Android* → *Run workflow* (ou crie uma tag `v1.2.3`). Publica uma Release com `kesh-tv.apk`. A assinatura usa os segredos `KESH_KEYSTORE_B64` e `KESH_KEYSTORE_PASSWORD`.
- **Na sua máquina (só precisa de Docker):**

  ```bash
  android/build-apk.sh 1.2.0                                   # aponta para o servidor padrão
  android/build-apk.sh 1.2.0 https://meu-servidor/kesh-tv/     # seu próprio servidor
  ```

  Na primeira vez cria a chave de assinatura em `android/keystore/` (fora do git). **Guarde uma cópia**: sem a mesma chave as próximas versões não instalam por cima.

O app é um WebView que abre o Kesh TV publicado: atualizações do site chegam sem reinstalar. Ele informa ao site que está numa TV (modo TV automático) e mantém a tela acesa durante o vídeo.

## Modo TV e controle remoto

O modo TV liga sozinho em Android TV, Fire TV, Samsung (Tizen), LG (webOS) e no app Android numa TV. Dá para forçar em **Conta → Modo TV** (Automático / Ligado / Desligado) ou com `?tv=1` / `?tv=0` no endereço.

- **Escala para qualquer TV (32" a 100", 720p a 4K):** a página usa um *viewport* de 1280 px e a TV amplia até a tela real — o app ocupa sempre a mesma fração da tela.
- **Margem de segurança** nas bordas (overscan), letras ~15% maiores e grade com 4 colunas.
- **Foco inicial** no primeiro canal de cada tela; destaque rosa no item focado.
- **Player em tela cheia** com painel de informações (canal, AO VIVO, programa atual/próximo) que some em 5 s.

| Tecla | Nas listas | No player |
| --- | --- | --- |
| ↑ ↓ ← → | move o destaque para o item mais próximo | ↑↓ trocam de canal/episódio · ←→ voltam/avançam 10 s |
| OK / Enter | abre | pausa/retoma (o 1º OK liga o som se começou mudo) |
| Voltar / Backspace | tela anterior (não sai do app na 1ª tela) | sai do player |
| Play, Pause, Stop | — | controlam o vídeo |
| Espaço / K · F · M | — | pausa · tela cheia · mudo (teclado) |
| Canal + / Canal − | — | trocam de canal |

## iPhone, iPad e Android pelo navegador

- **iPhone/iPad:** Safari → Compartilhar → *Adicionar à Tela de Início* (abre em tela cheia, como app).
- **Android:** Chrome → *Instalar app*; segurar o ícone mostra atalhos para Favoritos, Recentes e Filmes.
- O app guarda telas e arquivos (service worker) e abre sem internet; sem conexão mostra "Sem conexão" e reconecta sozinho.

## Listas M3U suportadas

- Formato estendido (`#EXTM3U`/`#EXTINF`) com `tvg-id`, `tvg-name`, `tvg-logo`, `group-title`, `#EXTGRP`; também lista sem `#EXTM3U` e quebras de linha do Windows.
- Cabeçalhos por canal: `#EXTVLCOPT:http-user-agent=…`, `#EXTVLCOPT:http-referrer=…` e o formato Kodi `url|User-Agent=…&Referer=…`.
- Guia de programação: `url-tvg` / `x-tvg-url` no `#EXTM3U` ou, em servidores Xtream (`get.php?username=…&password=…`), o `xmltv.php` correspondente.
- **Tipo do item** (nesta ordem): `/movie/` → filme, `/series/` → série, `/live/` ou `.ts`/`.m3u8` → ao vivo; sem pista no link, decide pelo grupo ("Séries", "Novelas", "Filmes", "VOD"…).
- **Séries**: o nome antes de `S01E02` / `S1 E2` vira a série; episódios são ordenados por temporada e número.
- URLs repetidas são ignoradas; limites: 300 MB e 15 min por download, até 1 milhão de itens, 20 listas por usuário, upload de arquivo até 95 MB (use o link para listas maiores).

## API

Tudo sob `/api` (ou `/<PUBLIC_PATH>/api`). Exceto as rotas marcadas como públicas, pede `Authorization: Bearer <token>` (obtido no login).

| Método e rota | Para quê |
| --- | --- |
| `GET /health` | saúde (público) |
| `POST /auth/login` | `{ email, password }` → `{ token, user }` (público; limite de tentativas) |
| `GET /auth/me` · `PUT /auth/profile` | usuário logado · trocar nome |
| `PUT /auth/password` | `{ current, password }` → token novo; encerra os logins dos outros aparelhos |
| `GET /stats` | resumo da conta (listas, canais, favoritos, horas assistidas) |
| `PUT /prefs/hidden-groups` | `{ groups: [...] }` grupos ocultos |
| `GET/POST /users` · `DELETE /users/:id` | usuários (só admin) |
| `GET /playlists` · `POST /playlists` | listar · adicionar por link `{ name?, url }` (importa em segundo plano) |
| `POST /playlists/upload?name=` · `?id=` | adicionar/atualizar por arquivo (corpo = o `.m3u`, em fluxo) |
| `PUT /playlists/:id` · `POST /playlists/:id/refresh` · `DELETE /playlists/:id` | editar (nome, link, atualização automática) · atualizar agora · excluir |
| `GET /groups?kind=live\|movie\|series` | grupos com contagem (séries contam séries, não episódios) |
| `GET /channels?kind=&group=&q=&offset=&limit=` | canais/filmes paginados (busca sem acento) |
| `GET /series?group=&q=` · `GET /series/episodes?playlist=&name=` | séries agrupadas · temporadas e episódios |
| `GET /channels/:id/play` | fontes em ordem de tentativa + ponto para continuar |
| `GET /channels/:id/around` | anterior/próximo (episódio da série ou canal do grupo) |
| `GET /channels/:id/epg` | programação do canal ao vivo |
| `POST /channels/:id/watch` · `PUT /channels/:id/progress` | marcar como assistido · salvar posição `{ position, duration }` |
| `GET /favorites` · `POST/DELETE /favorites/:id` | favoritos |
| `GET /favorites/export` · `POST /favorites/import` | baixar/importar favoritos em JSON (acha pela URL ou pelo nome) |
| `GET /history` · `DELETE /history/:id` · `DELETE /history` | recentes · tirar um · limpar |
| `GET /stream?u&h&e&s` · `GET /logo?…` | proxy de streams e logos (público, **link assinado**) |
| `POST /convert/start` · `GET /convert/:sid/:file` · `DELETE /convert/:sid` | conversão ffmpeg → HLS (arquivos pelo id de sessão de 128 bits) |

## Segurança

- **Rede interna protegida:** o proxy, a importação, o guia e o ffmpeg só acessam endereços públicos — loopback, redes do Docker, link-local/metadados de nuvem, CGNAT e IPv4 escondido em IPv6 (`::ffff:127.0.0.1`, NAT64…) são recusados. A conexão usa o mesmo IP que foi checado (sem *DNS rebinding*) e cada redirecionamento é conferido.
- **Links assinados:** `/api/stream` e `/api/logo` só aceitam links gerados pelo backend (HMAC-SHA256 com `JWT_SECRET`), com validade de 12 h para streams.
- **Conteúdo de terceiros isolado:** respostas do proxy saem com `Content-Security-Policy: sandbox` e `nosniff`; HTML/JS/XML vindos da fonte viram binário (um SVG com `<script>` não roda no domínio do app).
- **Login:** senhas com bcrypt; o token (30 dias) leva a versão da senha — trocar a senha encerra os outros aparelhos. Limite de 10 tentativas por IP+e-mail e 30 por e-mail em 15 min; atrás do Cloudflare o IP vem do `CF-Connecting-IP` (`TRUST_CLOUDFLARE=1`).
- **Credenciais das listas** (usuário/senha do provedor no link) ficam só no banco, nunca no repositório. Nunca commite `.env` nem a chave do APK.

Achou uma falha? Veja [SECURITY.md](SECURITY.md).

## Desenvolvimento

Requisitos: Node 22 (`.nvmrc`), PostgreSQL e ffmpeg (para a conversão).

```bash
# backend
cd backend
cp .env.example .env          # ajuste DATABASE_URL, JWT_SECRET e a senha do admin
npm install
npx prisma migrate deploy
npm run db:seed               # cria o admin (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD)
npm start                     # http://localhost:3000/api/health

# frontend (outro terminal) — o Vite repassa /api para o backend (BACKEND_URL muda o destino)
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

**Testes e checagens** (o mesmo que o CI roda em todo PR):

```bash
cd backend && npm run build && npm test     # sintaxe + testes (node:test)
cd frontend && npx tsc -b && npx vite build # tipos + build
```

Os testes cobrem o leitor M3U e XMLTV, links assinados e proxy HLS, bloqueio de rede interna (IPv4/IPv6, DNS rebinding), sandbox do proxy, progresso, exportação de favoritos, limite de login e a leitura de cabeçalhos MKV/AVI.

**Estrutura**

```
backend/    API Express + Prisma (src/, prisma/ com migrações, test/), Dockerfile com ffmpeg
frontend/   React + Vite + Tailwind (src/pages, src/components, platform/spatial/tvScale para TV)
android/    app Android (WebView) + build-apk.sh (gerador de APK)
deploy/docker/  instalação com docker compose
docs/       prints e imagem de prévia
.github/    CI, deploy, APK Android, Dependabot, modelos de issue/PR
```

## Configuração

**Backend** (`backend/.env`; no Docker, `deploy/docker/.env`):

| Variável | Para quê | Padrão |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL | — |
| `JWT_SECRET` | assina o login e os links do proxy (sem ela, sessões e links caem a cada reinício) | aleatório |
| `PORT` | porta da API | `3000` |
| `PUBLIC_PATH` | prefixo quando roda num subcaminho (ex.: `/kesh-tv`) | vazio |
| `SEED_ADMIN_NAME` / `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | admin criado no primeiro start (só se não houver admin) | — |
| `TRUST_CLOUDFLARE` | `1` atrás do Cloudflare: usa `CF-Connecting-IP` no limite de login | desligado |
| `DB_POOL_SIZE` | conexões do Prisma com o banco | `3` |
| `TZ` | fuso do servidor | `America/Sao_Paulo` |
| `NODE_OPTIONS` | limite de memória do Node | `--max-old-space-size=256` |

**App Android** (gerador de APK):

| Variável / propriedade | Para quê |
| --- | --- |
| `KESH_KEYSTORE`, `KESH_KEYSTORE_PASSWORD`, `KESH_KEY_ALIAS`, `KESH_KEY_PASSWORD` | chave de assinatura (sem ela, o release sai com a chave de depuração) |
| `-PstartUrl=` | endereço do Kesh TV que o app abre |
| `-PversionName=` / `-PversionCode=` | versão do app |
| Segredos do GitHub `KESH_KEYSTORE_B64`, `KESH_KEYSTORE_PASSWORD` | assinatura no workflow *APK Android* |

## Solução de problemas

| Problema | O que fazer |
| --- | --- |
| Canal não abre ("Não foi possível abrir este canal") | O player já tentou todas as fontes (direto, servidor, `.m3u8`). Teste o link no VLC (botão *Copiar link*); se lá também falhar, o canal está fora do ar no provedor. |
| Filme MKV/AVI demora para começar | É a conversão no servidor (~10–20 s; avançar além do que já foi convertido reinicia dali). H.264 comum só é reempacotado. |
| Canal toca em um aparelho e cai no outro | Planos IPTV costumam permitir uma tela por vez. |
| Lista "grande demais" ou demorando | Use o link em vez do arquivo (arquivo vai até 95 MB, link até 300 MB). O progresso aparece em **Listas**. |
| Guia de programação vazio | A lista precisa de `tvg-id` nos canais e de um guia (`url-tvg`/`x-tvg-url` ou servidor Xtream). A situação aparece no cartão da lista. |
| TV não entrou no modo TV | **Conta → Modo TV → Ligado** (ou `?tv=1`). |
| TV começa sem som | Navegadores de TV bloqueiam som automático: aperte OK uma vez. No app Android não acontece. |
| APK novo não instala por cima | Foi assinado com outra chave. Use sempre a mesma (`android/keystore/` ou os segredos do GitHub) ou desinstale a versão antiga. |
| Pediu login de novo em todos os aparelhos | Normal depois de trocar a senha (os outros aparelhos saem por segurança). |

**Para quem hospeda:** a conversão guarda as sessões na memória do processo — rode o backend com **1 réplica**. Até 4 conversões simultâneas (2 recodificando vídeo); listas com erro são tentadas de novo a cada 6 h.

## Como as mudanças entram

Toda mudança entra por **pull request** na `main` (o Central Apps Hub abre e mescla o PR); o GitHub Actions publica em produção quando o PR entra na `main`.

## Contribuindo

Veja o [guia de contribuição](CONTRIBUTING.md). Falhas de segurança: [SECURITY.md](SECURITY.md).

## Licença

[MIT](LICENSE)
