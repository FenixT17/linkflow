# LinkFlow — Documentação Técnica

> Última revisão: Setembro 2026. Este documento descreve o estado **atual** do
> projeto. O histórico de decisões (o que foi tentado e revertido) vive em
> `../memoria.md` (raiz do repositório).

---

## 📌 Visão geral

LinkFlow é um SaaS de páginas públicas de links (link-in-bio) para criadores,
marcas e equipas. Cada utilizador tem uma página pública em `/u/[nomeUtilizador]`
(alias `/@nomeUtilizador`) com links, avatar, banner, badges e um de três
templates de layout.

O backend é **Appwrite Cloud** (Auth, Database, Storage). Não existe servidor
de aplicação próprio: a lógica de negócio corre em Next.js (Server Components,
API Routes e um proxy same-origin para o Appwrite).

---

## 🏗️ Arquitetura

### Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 15.5.25 (App Router) + React 19 |
| Linguagem | TypeScript 5 (`strict`) |
| Estilos | Tailwind CSS v4 + `tw-animate-css` |
| Componentes | shadcn/ui, `@base-ui/react`, Lucide React |
| Animações | Framer Motion 12 |
| Gráficos | Recharts 3 |
| Backend | Appwrite Cloud — região **Frankfurt** (`fra.cloud.appwrite.io`) |
| Rate limiting / idempotência | Upstash Redis (REST) |
| Deploy | Netlify (`@netlify/plugin-nextjs`) |
| Testes | Vitest 4 + Testing Library + jsdom |

### A fronteira de segurança: `/api/appwrite`

O browser **nunca** fala directamente com o Appwrite Cloud. O client SDK é
re-apontado para `${origin}/api/appwrite` (`src/lib/appwrite.ts`), e o proxy
`src/app/api/appwrite/[...path]/route.ts` é o único ponto de entrada das
escritas do browser. Aí vivem, por ordem:

1. **Método e configuração** — allowlist de métodos, 503 sem project ID, corpo
   máximo de 10 MB.
2. **CSRF double-submit** (`src/lib/csrf.ts`) — header `X-CSRF-Token` tem de
   coincidir com o cookie, com comparação em tempo constante. Só GET/HEAD/OPTIONS
   são dispensados.
3. **Validação de propriedade** — nenhum pedido pode criar ou alterar
   documentos de outra pessoa. Coleções com `idPagina` (`links`, `themes`,
   `analytics`, `qr_codes`) têm o dono da página verificado; coleções
   self-referencing (`pages`, `activity_logs`, `notifications`,
   `subscriptions`, `teams`) exigem que o campo dono seja o `$id` da sessão.
   Falha fechado (timeout de 4,5 s nas validações → 403).
4. **Limite de links do plano gratuito** — imposto aqui, não no cliente, porque a
   coleção `links` aceita `create` de qualquer utilizador autenticado.
5. **Rate limiting distribuído** — 120 pedidos/min por sessão (ou por IP).
6. **Filtro anti-mass-assignment** — allowlist de campos por coleção, definido
   em `src/lib/appwrite-fields.ts` (fora do route handler, para ser testável).
7. **Validação de payload de tema** (`validateThemePayload`).
8. **Idempotência** — `Idempotency-Key` única por intenção, reservada
   atomicamente com `SET NX` no Redis; pedidos duplicados recebem o resultado
   da primeira execução em vez de criarem outro documento.

> ⚠️ **Manutenção:** o allowlist por coleção (`ALLOWED_FIELDS`, em
> `src/lib/appwrite-fields.ts`) tem de acompanhar o schema do Appwrite. Quando
> adicionares um atributo a uma coleção em `scripts/provision-appwrite.ts`,
> adiciona-o também ao allowlist — caso contrário o valor é **silenciosamente
> removido** do body, o Appwrite responde 200 e a escrita não persiste.
> `src/__tests__/appwrite-fields.test.ts` é a rede de segurança: cada teste
> parte do payload real que a aplicação escreve (ex: `defaultAppearance()`) e
> falha se o allowlist ficar desatualizado.

Alguns campos são deliberadamente **excluídos** do allowlist por serem
controlados pelo servidor, e só podem ser escritos por rotas dedicadas que
usam a API key: é o caso de `pages.emblemas` (badges), escrito por
`POST /api/badges`. O cliente nunca escolhe o dono nem as condições — o plano
vem do registo `users` e a aprovação de staff de `staff_applications`.

### Sessão

O segredo de sessão do Appwrite vive num cookie **`__Host-linkflow-session`
HttpOnly** (`src/lib/auth.server.ts`), definido apenas por API Routes. O
`localStorage` nunca guarda credenciais; o fallback `cookieFallback` do SDK é
lido uma única vez (fluxo OAuth legado), trocado pelo cookie de aplicação e
removido.

`src/middleware.ts` faz um check **necessário mas não suficiente** de
autenticação em `/dashboard` (presença do cookie) para evitar o flash de
conteúdo protegido; a autorização real é sempre `requireAuth()` no servidor.

### Fluxos de autenticação

- **Email/password** → `POST /api/auth/register` e `/api/auth/login`. As rotas
  aplicam rate limit distribuído **por IP e por conta**, rejeitam emails
  descartáveis e usam `createEmailPasswordSessionResolved()` para obter o
  segredo de sessão (o SDK devolve `secret: ""` sem API key).
- **OAuth (Google/GitHub)** → `/api/auth/oauth/start` → provider →
  `/api/auth/oauth/callback`, com um cookie de estado HttpOnly de 10 min
  (anti login-CSRF / session fixation). O callback é a única origem permitida
  (`src/lib/oauth-errors.ts`) e o consentimento do registo viaja num cookie
  curto para ser gravado como prova auditável em `/api/auth/oauth/sync`.
- **Verificação e recuperação de email** → delegadas no Appwrite
  (`createVerification` / `createRecovery`).

### Analytics

Server-only e sem dados simulados:

- `src/lib/geo.ts` — GeoIP a partir dos headers da infraestrutura
  (`cf-ipcountry`, fallback `x-country`) e, em último recurso, `api.country.is`
  com cache de 24 h. Coordenadas aproximadas via `ipwho.is` (só para a tabela de
  estudo).
- `src/lib/analytics.ts` — agregação no documento `analytics`
  (`metricasJson`): países, dispositivos, top links, visitantes únicos, CTR,
  crescimento semanal/mensal e janelas de 14 dias de hashes. Mutações
  serializadas por página com um lock em memória; criação inicial tolerante à
  race do índice único em `idPagina`.
- `POST /api/view` e `POST /api/click` — endpoints públicos e anónimos,
  rate-limited por IP. **Nunca devolvem o IP ao cliente.**

**Privacidade:** o IP cru não é persistido nas tabelas de analytics. A chave de
deduplicação é `hashVisitante = HMAC-SHA256(ip)` com `IP_HASH_SECRET` (sem
segredo configurado cai para um salt fixo legado). Exceção deliberada: a coleção
`dados_para_estudos` guarda IP em texto plano e coordenadas aproximadas, e só é
escrita com o cookie de consentimento `linkflow-study-consent`. Ver a secção
"Conformidade".

---

## 🔧 Configuração

Copia `.env.example` para `.env.local` e preenche os valores. Em produção, as
variáveis configuram-se no dashboard do Netlify
(Site configuration → Environment variables).

### Variáveis públicas (`NEXT_PUBLIC_*` — inlined no build)

| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | URL canónico (metadata, OG, sitemap, links de verificação). Mudar exige redeploy. |
| `NEXT_PUBLIC_APPWRITE_ENDPOINT` | **Obrigatoriamente** `https://fra.cloud.appwrite.io/v1` (região Frankfurt). |
| `NEXT_PUBLIC_APPWRITE_PROJECT_ID` | ID do projeto Appwrite. O hostname tem de estar registado como Web Platform. |
| `NEXT_PUBLIC_APPWRITE_DATABASE_ID` | `linkflow` |
| `NEXT_PUBLIC_APPWRITE_FILES_BUCKET_ID` | Bucket servido pelo runtime (`files`). |
| `NEXT_PUBLIC_APPWRITE_AVATARS_BUCKET_ID` | `avatars` (usado no cleanup de conta). |
| `NEXT_PUBLIC_APPWRITE_BANNERS_BUCKET_ID` | `banners` (usado no cleanup de conta). |

### Variáveis server-only (nunca no bundle)

| Variável | Descrição |
|---|---|
| `APPWRITE_API_KEY` | API key do Appwrite (server SDK). |
| `IP_HASH_SECRET` | Segredo do HMAC do `hashIp`. Definir reinicia os contadores de visitantes únicos. |
| `UPSTASH_REDIS_REST_URL` | Rate limiting e idempotência distribuídos. |
| `UPSTASH_REDIS_REST_TOKEN` | Token do Upstash (server-only). |

> Sem `UPSTASH_*`, os fluxos autenticados **falham fechado** (503) em vez de
> caírem para memória local — é intencional.

---

## 📦 Modelo de dados

Base de dados `linkflow`, 15 coleções (criadas por `npm run provision`):

| Coleção | Acesso |
|---|---|
| `users`, `pages`, `links`, `analytics`, `themes`, `qr_codes` | Documentos com permissões do dono |
| `subscriptions`, `teams`, `notifications`, `security_logs`, `activity_logs`, `staff_applications` | Escrita via servidor / permissões por documento |
| `visits`, `collected_ips`, `dados_para_estudos` | **Server-only** — permissões `[]` |

Storage: o runtime serve toda a media (avatares, banners, imagens de links) a
partir do bucket `files`, através do proxy `/api/media/[fileId]` — que valida o
ID, bloqueia hotlinking por `Referer`, limita downloads por IP e confirma que o
ficheiro pertence a uma página publicada (ou ao dono autenticado).

---

## 🔒 Segurança

### Headers

Definidos em **dois sítios** que têm de se manter coerentes: `next.config.ts`
(rota `/(.*)`) e `src/middleware.ts` (por resposta, com o nonce).

- `Content-Security-Policy` com **nonce por pedido** e `'strict-dynamic'`;
  `connect-src` limita-se a `'self'` mais os domínios Appwrite. `style-src` ainda
  usa `'unsafe-inline'` (pendente de migração).
- `X-Frame-Options: DENY`, `Strict-Transport-Security` (2 anos, preload),
  `X-Content-Type-Options: nosniff`, `Referrer-Policy`,
  `Cross-Origin-Opener-Policy: same-origin-allow-popups` (para não quebrar
  OAuth), `Permissions-Policy` e `Accept-CH` (User-Agent Client Hints, para
  capturar o nome real do dispositivo).
- `Cross-Origin-Embedder-Policy` **não** está ativo: quebraria imagens externas
  que não enviam cabeçalhos CORP.

### Cookies

| Cookie | HttpOnly | Secure | SameSite |
|---|---|---|---|
| `__Host-linkflow-session` | ✅ | prod-only | `lax` |
| `__Host-linkflow-oauth-state` | ✅ | prod-only | `lax` |
| `__Host-linkflow-oauth-consent` | ✅ | prod-only | `lax` |
| `__Host-linkflow-csrf` | ❌ (leitura necessária) | prod-only | `strict` |

Em desenvolvimento os nomes perdem o prefixo `__Host-` e o CSRF usa `lax`,
porque os browsers não aceitam cookies `Secure` em qualquer setup de HTTP local.

### Proteção distribuída

- **Rate limiting** (`src/lib/rate-limit.ts`): `INCR` + `PEXPIRE` + `PTTL` no
  Upstash (sem `EVAL`, que tokens REST limitados rejeitam). Chaves com hash
  SHA-256 do identificador. **Falha fechado** quando o Redis não está
  configurado ou indisponível.
- **Identidade do cliente**: apenas headers injetados pela infraestrutura
  (`x-nf-client-connection-ip` no Netlify, `cf-connecting-ip` em Cloudflare).
  `X-Forwarded-For` é ignorado — o cliente pode forjá-lo.
- **Idempotência** (`src/lib/idempotency.server.ts`): falha **aberto** (uma
  indisponibilidade do Redis nunca bloqueia a criação de links).
- **Exceções documentadas ao fail-closed**: `/api/view` e `/api/click` degradam
  para "permitido" se o Redis cair, para não perderem tracking durante um
  outage — o que significa que as métricas são manipuláveis nessa janela.

### Sanitização

`src/lib/sanitize.ts` (texto, URLs, perfis, policy de password: ≥12 caracteres
com maiúscula, minúscula, número e símbolo), `src/lib/social.ts` (bloqueio de
`javascript:`/`data:`/`vbscript:`/`file:`/`blob:`, HTTPS obrigatório, `mailto:`
só para email, `tel:` só para WhatsApp) e `src/lib/theme-validation.ts` (cores,
fontes e limites dos controlos Liquid Glass). Zero `innerHTML`/`eval` no código
de aplicação; `dangerouslySetInnerHTML` aparece apenas em JSON-LD e nos scripts
de tema, ambos com nonce e conteúdo gerado no servidor.

### Eliminação de conta

`src/lib/account-deletion.server.ts` remove tudo o que é atribuível ao
utilizador — páginas e filhos, ficheiros (incluindo uploads antigos), logs de
segurança, hashes de IP órfãos e documentos account-scoped — de forma
**idempotente** (404 tolerado) e re-lista os filhos após despublicar, para
apanhar escritas que correram em paralelo. A identidade de Auth é preservada
intencionalmente e as sessões são revogadas antes da limpeza.

---

## ✅ Verificação

```bash
npm run verify      # typecheck + lint + testes (o que corre no build do Netlify)
npm run typecheck   # next typegen && tsc --noEmit
npm test            # Vitest (284 testes em 35 ficheiros)
npm run lint        # ESLint (src + scripts)
```

**O build do Netlify começa por `npm run verify`** (`netlify.toml`): um erro de
tipos, uma regra do ESLint ou um teste vermelho aborta o deploy antes de
`next build` publicar. Os testes são independentes do ambiente (não precisam de
`.env.local`), por isso o resultado local e o do CI coincidem.

### Onde os testes não chegam

Os testes cobrem bem as bibliotecas de segurança (CSRF, sanitização, temas,
rate limiting, analytics, geo, eliminação de conta) e o proxy do Appwrite
(propriedade, idempotência, limite do plano free, allowlist de campos, regras
de concessão de badges). O que **não** está coberto:

- os route handlers end-to-end (as regras são testadas como funções puras, mas
  o handler `/api/badges` em si precisa de um Appwrite a correr);
- o `/demo` em si (o render é testado — template, avatar e modo de
  pré-visualização — mas o fluxo com sessão a carregar em `AuthContext` não);
- qualquer fluxo end-to-end contra um Appwrite real.

### `/demo`

Página de demonstração pública. Renderiza o `PageTemplate` **real**, com os
dados do utilizador autenticado quando existem (avatar, nome, bio, links
ativos/visíveis e a sua aparência) ou uma página de exemplo preenchida para
tirar proveito de um visitante anónimo. O seletor de layout é estado local —
**nunca** escreve em `pages.modeloPagina`.

`PreviewModeProvider` (`src/components/templates/preview-context.tsx`) marca a
subárvore como pré-visualização, e `TrackedLink` deixa de fazer `POST /api/click`
quando está dentro dela. Sem isto, o dono somava auto-cliques às próprias
métricas (o `/api/click` só verifica que a página está publicada, não quem
clica). O contexto é `false` por omissão, por isso `/u/[nomeUtilizador]`
continua a registar cliques sem precisar de fazer nada.

---

## 📦 Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Dev server em `localhost:3000`. |
| `npm run build` | Build de produção (limpa `.next` via `prebuild`). |
| `npm run start` | Serve o build de produção. |
| `npm run verify` | **Typecheck + lint + testes** — gate do deploy. |
| `npm run provision` | Cria/atualiza o schema do Appwrite (idempotente). |
| `npm run fix:bucket` | Repõe a leitura pública do bucket de media. |
| `npm run provision:security-logs` | Cria a coleção de logs de segurança. |
| `npm run migrate:*` | Migrações pontuais (`staff-applications`, `users-permissions`, `study-data`). |
| `npm run seo:audit` | Audita problemas de SEO. |
| `npm run check:links` | Verifica links quebrados. |
| `npm run verify:account-deletion` | Testa o fluxo de eliminação de conta (requer `.env.local`). |
| `npm run diagnose:links` | Diagnóstico **read-only** dos links/páginas no Appwrite (permissões, órfãos, analytics em falta). |
| `npm run cleanup:test-pages` | Remove páginas de teste e os documentos associados. **Dry run por omissão**; apagar exige `--yes`. |

> ⚠️ `scripts/wipe-analytics-data.ts` é **destrutivo e irreversível** (limpa
> analytics de TODOS os utilizadores, não de uma página). Corre em dry run e
> exige `--yes --confirm=<databaseId>` para escrever — os dois argumentos são
> obrigatórios de propósito.

---

## 🚀 Deploy (Netlify)

| Item | Valor |
|---|---|
| Plataforma | Netlify com `@netlify/plugin-nextjs` (`netlify.toml`) |
| Repositório | GitHub `FenixT17/linkflow`, branch `main` |
| Site | https://linkflow-pt.netlify.app |
| Node | 22 |
| Build | `npm run verify && npm run build` → publica `.next` |

O deploy é contínuo: push para `main` → build (com verificação) → deploy. O
plugin trata de SSR, API Routes, rewrites/redirects e caching; o site publicado
tem as funções serverless necessárias para as rotas dinâmicas.

**Nota histórica:** o deploy em Cloudflare Workers (`wrangler.jsonc`,
`worker-entry.js`, `open-next.config.ts`, `.github/workflows/deploy.yml` e os
scripts `cf:*`) foi removido e não deve ser reintroduzido sem uma decisão
explícita — `.github/workflows/` está vazio e não há CI além do build do
Netlify.

---

## 🔄 Fluxos

### Recuperação de password

1. Utilizador submete o email em `/forgot-password` (rate limit + anti-enumeração).
2. O servidor chama `account.createRecovery` com
   `{NEXT_PUBLIC_SITE_URL}/reset-password`.
3. O Appwrite envia o email oficial (depende de SMTP configurado na consola).
4. `/reset-password` valida o segredo e chama `updateRecovery`.

### Envio de emails

Totalmente delegado no Appwrite (verificação e recuperação). O módulo Resend
(`${RESEND_*}`) está preparado mas desativado e **não** tem importadores — se o
reativares, mantém as chaves server-only e nunca uses `NEXT_PUBLIC_`.

---

## ⚖️ Conformidade e acessibilidade

- **Consentimento no registo** — obrigatório, imposto no servidor
  (`consent !== true` → 400) e gravado com timestamp do servidor em
  `/api/users/provision`.
- **`dados_para_estudos`** — única tabela com IP em texto plano e coordenadas
  aproximadas, escrita apenas com o cookie `linkflow-study-consent`. Esse cookie
  é definido no cliente, logo não constitui prova auditável de consentimento;
  qualquer revisão de RGPD/LGPD deve olhar para aqui primeiro.
- **Acessibilidade** — `viewport` usa `maximumScale: 1` / `userScalable: false` e
  existe um `ZoomBlocker`, o que contraria a WCAG 1.4.4 (redimensionamento de
  texto). É uma decisão de produto a revisitar.

---

## 📝 Notas

- **Region lock:** usar o endpoint global (`cloud.appwrite.io`) com um projeto
  regional devolve 401 `general_access_forbidden`. Frankfurt é obrigatório.
- **Hydration:** nunca usar `Date.now()`, `Math.random()`,
  `toLocaleDateString()` ou `localStorage` durante o render. O padrão do projeto
  é o guard `useMounted` e arrays de constantes module-level. Depois de alterar
  texto/estrutura renderizada no SSR, limpar `.next` e reiniciar o dev server.
- **CSP:** a migração para nonce está feita para scripts; falta remover
  `'unsafe-inline'` de `style-src`.
- **Logs de segurança:** a coleção existe e é escrita, mas não há monitorização
  ativa nem alertas.
