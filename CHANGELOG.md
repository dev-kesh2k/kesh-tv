# Changelog

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
