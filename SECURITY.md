# Segurança

## Como reportar uma vulnerabilidade

Não abra issue pública. Use **Security → Report a vulnerability** (aviso privado do GitHub) neste repositório, com:

- o que acontece e como reproduzir;
- o impacto (ex.: acesso a listas de outro usuário, SSRF pelo proxy, vazamento de credenciais);
- versão/commit afetado.

A resposta inicial sai em até 7 dias.

## Pontos sensíveis do projeto

- **Proxy de streams e logos** (`/api/stream`, `/api/logo`): só aceita links assinados (HMAC + validade) e bloqueia endereços internos (loopback, redes do Docker, link-local/metadados).
- **Conversão** (`/api/convert`): ffmpeg limitado a `http`/`https`; sessões com id aleatório de 128 bits.
- **Listas M3U** costumam ter usuário e senha do provedor na URL: ficam só no banco, nunca no repositório.
- Nunca commite `.env`; o `.env.example` só traz valores de exemplo.
