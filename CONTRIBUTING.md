# Contribuindo

Obrigado pelo interesse! Sugestões e correções são bem-vindas.

1. Abra uma issue descrevendo o problema ou a ideia (há modelos para bug e sugestão).
2. Faça um fork, crie uma branch (`fix/...`, `feat/...`, `docs/...`) e mantenha o PR pequeno e focado.
3. Antes de enviar:
   - backend: `cd backend && npm run build` (checa a sintaxe) e `npm test`;
   - frontend: `cd frontend && npx tsc -b && npx vite build`.
4. Descreva no PR o que mudou e como testar. Telas novas: inclua prints em celular (360 px) e desktop.

## Padrões

- Código e mensagens em português do Brasil.
- Layout mobile-first: nada de rolagem horizontal de 320 px em diante.
- Não inclua listas, links de canais ou credenciais de provedores IPTV em código, testes ou issues.

## Commits em dupla

Os envios feitos pelo Central Apps Hub levam a linha `Co-Authored-By` do Claude, que participou da mudança.
