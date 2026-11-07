# Changelog

## 2026-11-07 (manhã) — apps nativos

- **App Android nativo em Kotlin** (`android-kotlin/`): Jetpack Compose, player Media3/ExoPlayer que toca o link original no aparelho e cai para o servidor se falhar; login, abas, grupos, busca, grade de programação, séries com temporadas, favoritos, vistos por último, retomada e troca de canal pelo controle.
- **App em Flutter** (`flutter/`): as mesmas telas, com `video_player`; tela acesa durante o vídeo por um canal nativo; projeto iOS incluído.
- **Gerador de APK com três opções** (`./build-apk.sh`: WebView, Kotlin, Flutter ou todos), mesma assinatura nos três.
- Workflow *APK Android* com a escolha do app e Release com `kesh-tv.apk`, `kesh-tv-kotlin.apk` e `kesh-tv-flutter.apk` (versão 1.2.0); em PRs compila só o app que mudou.
- Conta: download das três versões.

## 2026-11-07 (madrugada) — visual novo

O app deixou o tema genérico (preto + rosa, cartões arredondados iguais) por uma identidade de TV:
- **Paleta** azul-tinta com texto em tom de papel, âmbar do controle remoto para seleção e foco, vermelho de estúdio só no "ao vivo".
- **Tipografia** Archivo com eixo de largura: estreita e pesada nos nomes de canal e títulos, como guias de programação impressos.
- **Canais ao vivo como grade de programação** (número, logo, nome, programa no ar com a barra do horário).
- Marca nova (placa de canal âmbar com K), abas sublinhadas, pôsteres sem caixa, página da série como guia de episódios, login sem enfeites, Conta e Listas sem pilhas de cartões.
- Sem rótulos em maiúsculas, pontos médios, fonte monoespaçada ou degradês decorativos; plurais e textos revistos.
- Corrigido: player da TV com 150 px de altura (erro cortado).
- App Android 1.1.0 com o ícone e o banner novos.

## 2026-11-07 (noite) — TV, Android e revisão

### Adicionado
- **Modo TV**: detecção automática (Android TV, Fire TV, Samsung, LG, app Android), escala para 32"–100", margem de overscan, foco inicial, navegação por setas em todo o app, player em tela cheia com painel de informações, OK/teclas de mídia, letras maiores e grade de 4 colunas; opção em Conta.
- Grupos em fileira de botões no celular (no lugar da lista suspensa).
- **App Android** (celular e Android TV): WebView com banner da TV, tela cheia, tela acesa durante o vídeo, ponte com o site; **gerador de APK** (`android/build-apk.sh` e workflow *APK Android* com Release).
- PWA com service worker (abre sem internet), tela "Sem conexão", ajustes para iPhone e atalhos do ícone no Android.
- Busca sem acentos; botão "Baixar app Android" em Conta.

### Segurança (revisão de código)
- Proxy recusava 127.0.0.1 mas aceitava `::ffff:127.0.0.1` e afins (IPv4 em IPv6); conexões agora usam o IP checado (sem DNS rebinding).
- Conteúdo de terceiros servido pelo proxy sai com CSP sandbox (SVG/HTML não rodam script no domínio do app).
- Trocar a senha encerra os logins dos outros aparelhos (todas as sessões antigas foram encerradas uma vez).
- Limite de tentativas de login não pode mais ser driblado com `X-Forwarded-For`; novo limite por e-mail.

### Corrigido (revisão de código)
- MKV H.264 10 bits (Hi10P) ficava com tela preta; agora é convertido.
- Horários do guia deslocados em Postgres fora de UTC; guia `.gz` sem extensão.
- Resposta atrasada mostrava grupos da aba errada; navegação por setas 2× mais rápida em grades grandes.
- Lista com erro baixada a cada 30 min (agora a cada 6 h); rodadas automáticas sobrepostas; limites de conversões simultâneas; "Próximo" em séries enormes; `safeFetch` com pedido já cancelado; memória do limite de login; `npm run dev` sem proxy para a API.

## 2026-11-07 (tarde)

### Adicionado
- **Guia de programação (EPG)**: descobre o XMLTV da lista (`url-tvg` ou `xmltv.php` do Xtream), mostra o programa no ar nos cartões e a programação na tela do canal.
- **Continuar de onde parou** em filmes e episódios, com barras de progresso e "Continuar T1 · E03 · 21:08".
- **Exportar e importar favoritos** (JSON), achando os canais pela URL ou pelo nome.
- **Grupos ocultos**, fileiras "Seus favoritos" e "Continuar assistindo", ordem A–Z dos grupos.
- Player: atalhos de teclado, Mini player (Picture-in-Picture), timer para desligar e selo AO VIVO.
- Resumo em Conta, × para tirar itens dos Recentes, botão voltar ao topo, cartões de carregamento, título da aba por página, tela amigável de erro.

### Corrigido
- Pausar logo após abrir o vídeo fazia ele voltar a tocar sem som.
- Programas sobrepostos no guia do provedor.

## 2026-11-07

### Adicionado
- Conversão no servidor (ffmpeg → HLS) para MKV, AVI, HEVC 10-bit e Opus, com barra própria de avanço.
- Séries agrupadas por temporada, com *Continuar* e *Próximo episódio*.
- Importação em fluxo para listas enormes (364 mil itens / 95 MB), com progresso.
- Testes automatizados (leitor M3U, links assinados, proxy HLS) e CI em todo PR.
- Guia de contribuição, política de segurança, modelos de issue e de PR.

### Corrigido
- Canais ao vivo de grupos com "Séries" no nome caíam em Séries.
- `.avi` que na verdade são MP4 falhavam na conversão; agora tocam direto.
- Senha real do admin removida do `.env.example`.

## 2026-11-06

### Adicionado
- Primeira versão: listas M3U por link ou arquivo, Ao vivo/Filmes/Séries, busca, favoritos, recentes, vários usuários, proxy de streams e logos, PWA.
