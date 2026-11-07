# Changelog

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
