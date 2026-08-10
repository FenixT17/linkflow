# LinkFlow

A premium, glassmorphism Link-in-Bio SaaS built with Next.js 15, TypeScript, Tailwind CSS, shadcn/ui and Framer Motion.

## Features

- Premium dark-first glassmorphism UI
- Responsive landing page
- Authentication screens (login / register)
- Dashboard with sidebar navigation and mobile menu
- Visual link editor with drag-and-drop reordering
- Live phone preview
- Analytics page with charts
- Public profile page (`/[username]`)
- Appearance, profile and settings pages
- Dark / light theme support via `next-themes`

## Tech Stack

- Next.js 15 App Router
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- Framer Motion
- Recharts (analytics)
- qrcode.react (QR codes)
- Appwrite (integrated: auth, database, storage)

## Getting Started

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build

```bash
npm run build
```

## Deploy na Cloudflare (Workers)

O projeto corre em produção num Worker da Cloudflare através do adaptador
`@opennextjs/cloudflare` (OpenNext), que transforma o build do Next.js
(SSR + API routes) num Worker compatível com o runtime `workerd`
(configuração em `wrangler.jsonc` + wrapper `worker-entry.js`).

```bash
npm run cf:build      # next build + transformação OpenNext (gera .open-next/)
npm run cf:preview    # pré-visualização local (wrangler dev)
npm run cf:deploy     # build + deploy para a Cloudflare
```

O deploy automático no push para `main` é feito pelo GitHub Actions
(`.github/workflows/deploy.yml`): valida os GitHub Secrets obrigatórios
(fail-fast), faz o build com as variáveis `NEXT_PUBLIC_*` (inlined pelo Next.js
em build time) e publica o Worker com `wrangler deploy`. Os segredos runtime
(`APPWRITE_API_KEY`, `UPSTASH_REDIS_REST_URL/TOKEN`, `HCAPTCHA_SECRET`) são
gravados no Worker em cada deploy via `wrangler secret put` — nunca estão no
código. A lista completa de variáveis está em `.env.example`.

## Distributed rate limiting (Upstash Redis)

The API uses `@upstash/redis` with an atomic Redis Lua script. Counters are stored in Upstash, so limits are shared across Cloudflare Workers, regions and cold starts; there is no in-memory fallback.

Create a Redis database in [Upstash](https://console.upstash.com/redis) and configure these server-only variables locally (`.env.local` or `.dev.vars`) and as GitHub Secrets for the deploy workflow:

```env
UPSTASH_REDIS_REST_URL=https://your-database.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_rest_token_here
```

Never prefix these variables with `NEXT_PUBLIC_`, commit them, or print them in logs. Requests without a trusted infrastructure IP header use a shared conservative key and cannot bypass the distributed limit by spoofing `X-Forwarded-For`.

## Appwrite Setup

Copy `.env.example` to `.env.local` and set your Appwrite endpoint, project and database IDs.

> ⚠️ The endpoint must match the **region where your Appwrite project was created** — using
the global endpoint (`https://cloud.appwrite.io/v1`) for a regional project returns HTTP 401
`"Project is not accessible in this region"`. The LinkFlow project lives in **Nova Iorque**, so use:

```env
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://nyc.cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=your_project_id
NEXT_PUBLIC_APPWRITE_DATABASE_ID=linkflow
NEXT_PUBLIC_APPWRITE_AVATARS_BUCKET_ID=avatars
NEXT_PUBLIC_APPWRITE_BANNERS_BUCKET_ID=banners
NEXT_PUBLIC_APPWRITE_FILES_BUCKET_ID=files
```

## Project Structure

```
src/
  app/            # Next.js App Router pages + API routes
  components/     # Shared UI and dashboard components
  lib/            # Utilities, types, Appwrite client
  hooks/          # Custom React hooks
  __tests__/      # Testes Vitest + Testing Library
wrangler.jsonc    # Config do Worker Cloudflare (@opennextjs/cloudflare)
worker-entry.js   # Wrapper do Worker (força no-store no HTML/RSC)
.github/workflows/deploy.yml  # CI/CD: push → build → deploy Cloudflare
```

## Resend — email transacional

O envio de emails é exclusivamente server-side e está centralizado em `src/lib/email.server.ts`. O serviço expõe `sendEmail()`, `sendVerificationEmail()` e `sendPasswordResetEmail()`, com templates reutilizáveis em `src/lib/email-templates.ts`.

Configure apenas no ambiente do servidor:

```env
RESEND_API_KEY=re_xxx
RESEND_FROM_EMAIL=LinkFlow <onboarding@resend.dev>
RESEND_REPLY_TO=
```

Nunca use `NEXT_PUBLIC_` nestas variáveis, nem coloque a chave em componentes `use client`, no Git ou em logs. Localmente, use `.env.local` (ou `.dev.vars` para `wrangler dev`); em produção, defina-as como GitHub Secrets para o workflow de deploy. Para um domínio personalizado, verifique-o na Resend, configure SPF/DKIM/DMARC e altere `RESEND_FROM_EMAIL` para o remetente verificado.

O envio de emails está **temporariamente desativado por decisão do produto**. Os templates, o serviço Resend server-only e as páginas de verificação/recuperação permanecem preparados para uma ativação futura, mas os fluxos atuais não iniciam pedidos ao Appwrite nem enviam mensagens. A configuração SMTP também não deve ser ativada enquanto esta decisão estiver em vigor.
