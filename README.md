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
navegador ──► frontend (React + Vite + Tailwind)
                 │  /api
                 ▼
             backend (Express + Prisma) ──► PostgreSQL (listas, canais, favoritos)
                 │
                 ├─ /api/stream   proxy dos streams (reescreve playlists HLS)
                 ├─ /api/logo     proxy das logos (cache 7 dias)
                 └─ /api/convert  ffmpeg → HLS para formatos que o navegador não toca
```

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

## Na TV pelo navegador / iPhone

- **Modo TV**: reconhecido sozinho em Android TV, Fire TV, Samsung (Tizen) e LG (webOS); dá para forçar em Conta → Modo TV ou com `?tv=1`. Controle: setas navegam, OK abre/pausa, Voltar retorna.
- **iPhone/iPad**: Safari → Compartilhar → *Adicionar à Tela de Início* (abre em tela cheia, como app).

## Rodando localmente (desenvolvimento)

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

## Contribuindo

Veja o [guia de contribuição](CONTRIBUTING.md). Falhas de segurança: [SECURITY.md](SECURITY.md).

## Licença

[MIT](LICENSE)
