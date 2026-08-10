# LinkFlow - Documentação Técnica

## 📌 Visão Geral
LinkFlow é uma aplicação SaaS construída com Next.js (TypeScript) e Appwrite para autenticação, banco de dados e armazenamento de arquivos.

---

## 🏗️ Arquitetura
### Frontend
- **Framework**: Next.js 15.5.22
- **Estilos**: TailwindCSS
- **Componentes**: Shadcn UI, Lucide React
- **Autenticação**: Appwrite
- **Emails**: Resend (infra preparada, envio temporariamente desativado)

### Distributed protection
- **Rate limiting**: `@upstash/redis` via REST, with an atomic Lua `INCR`/`PEXPIRE` script.
- **Runtime**: server-only credentials (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) shared by all Cloudflare Workers.
- **Client identity**: only the infrastructure-provided single-IP header (`cf-connecting-ip` on Cloudflare) is accepted; arbitrary `X-Forwarded-For` values are ignored.
- **Failure mode**: missing Redis configuration fails closed instead of falling back to local memory.

### Backend (Indireto via Appwrite)
- **Autenticação**: Appwrite (login, recuperação de senha, gerenciamento de usuários)
- **Banco de Dados**: Coleções no Appwrite (`linkflow`)
- **Armazenamento**: Buckets para avatares, banners e uploads gerais
- **Logs de Segurança**: Coleção dedicada para logs de segurança

---

## 🔧 Configuração
### Variáveis de Ambiente
Copie `.env.example` para `.env.local` e preencha com valores reais.

#### Variáveis Principais
| Variável                     | Descrição                                                                 |
|------------------------------|-------------------------------------------------------------------------|
| `NEXT_PUBLIC_SITE_URL`       | URL do site (usada para links canônicos, Open Graph, JSON-LD).          |
| `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` | Chave pública do hCaptcha (frontend).                                  |
| `HCAPTCHA_SECRET`            | Chave secreta do hCaptcha (backend, nunca expor ao frontend).           |
| `APPWRITE_API_KEY`           | Chave de API do Appwrite (backend).                                      |
| `RESEND_API_KEY`             | Chave de API do Resend (infra preparada, envio desativado).              |
| `RESEND_FROM_EMAIL`          | Endereço de email do remetente (ex: `LinkFlow <onboarding@resend.dev>`). |
| `UPSTASH_REDIS_REST_URL`     | URL do Redis Upstash (rate limiting distribuído).                        |
| `UPSTASH_REDIS_REST_TOKEN`   | Token do Redis Upstash (server-only, nunca expor).                       |

---

## 🔒 Segurança
### Headers de Segurança
- **CSP (Content Security Policy)**: Restringe fontes de scripts, estilos e recursos.
- **X-Frame-Options**: `DENY` (previne clickjacking).
- **HSTS**: Ativado para forçar HTTPS.
- **Permissions-Policy**: Restringe acesso a câmera, microfone e geolocalização.

### Autenticação
- **hCaptcha**: Proteção contra bots.
- **Appwrite**: Autenticação segura com escopos restritos.

### CSP (Content Security Policy)
O rate limiting distribuído usa Redis REST e não depende de estado local da função. O CSP atual ainda usa scripts inline necessários para a hidratação do tema; a migração completa para nonce/hash deve ser tratada separadamente para não quebrar `next-themes`.

O CSP atual usa `nonce` para scripts dinâmicos. Para garantir segurança:
1. **Middleware**: Gera um nonce único por requisição.
2. **Scripts Dinâmicos**: Usam o nonce gerado (ex: `next-themes`).
3. **Estilos**: Ainda usa `'unsafe-inline'` por enquanto (deve ser removido futuramente).

---

## 🚀 Deploy (Cloudflare Workers)
O projeto corre num Worker da Cloudflare via `@opennextjs/cloudflare` (config em `wrangler.jsonc`; o wrapper `worker-entry.js` força `Cache-Control: no-store` no HTML/RSC).

```bash
npm run cf:build      # next build + transformação OpenNext (gera .open-next/)
npm run cf:preview    # pré-visualização local (wrangler dev)
npm run cf:deploy     # build + deploy para a Cloudflare
```

O deploy automático no push para `main` é feito pelo GitHub Actions (`.github/workflows/deploy.yml`):
1. Valida que todos os GitHub Secrets obrigatórios existem (fail-fast).
2. Faz o build com as variáveis `NEXT_PUBLIC_*` (inlined no bundle pelo Next.js).
3. Publica o Worker e grava os segredos runtime (`APPWRITE_API_KEY`, `UPSTASH_REDIS_REST_URL/TOKEN`, `HCAPTCHA_SECRET`) com `wrangler secret put`.

---

## 📦 Scripts Úteis
| Comando                     | Descrição                                                                 |
|-----------------------------|-------------------------------------------------------------------------|
| `npm run dev`               | Inicia o servidor de desenvolvimento.                                   |
| `npm run build`             | Compila o projeto para produção.                                         |
| `npm run start`            | Inicia o servidor de produção.                                          |
| `npm run provision`         | Configura o Appwrite (buckets, coleções, permissões).                   |
| `npm run fix:bucket`        | Corrige permissões de buckets no Appwrite.                              |
| `npm run cf:deploy`         | Build OpenNext + deploy para a Cloudflare Workers.                      |
| `npm run migrate:staff-applications` | Migra dados de aplicações de staff.                          |
| `npm run seo:audit`         | Audita issues de SEO.                                                   |

---

## 🔄 Fluxos de Trabalho
### Autenticação
1. **Login**: Usa Appwrite (`/login`).
2. **Recuperação de Senha**:
   - Usuário insere email em `/forgot-password`.
   - O Appwrite cria o token e envia o email oficial (`account.createRecovery`), com o link para `/reset-password`.
   - Usuário clica no link e redireciona para `/reset-password`.
   - Senha é atualizada via Appwrite.

### Envio de Emails
- Centralizado em `src/lib/email.server.ts` (server-only), com templates em `src/lib/email-templates.ts`.
- **Temporariamente desativado por decisão de produto.** A verificação de email usa o fluxo nativo do Appwrite (`createVerification` + página `/verify-email`) e a recuperação usa `createRecovery`; a entregabilidade depende de SMTP configurado na consola do Appwrite.

---

## 📝 Notas
- **Recuperação de Senha**: Usa `account.createRecovery` do Appwrite; o email oficial do Appwrite depende de SMTP configurado na consola para chegar à caixa de entrada (a infraestrutura partilhada tende a ir para spam).
- **CSP**: Em processo de migração para `nonce-based` (remover `'unsafe-inline'` e `'unsafe-eval'`).
- **Logs de Segurança**: Coleção criada, mas não há monitoramento ativo.

---