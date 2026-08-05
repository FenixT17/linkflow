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
- **Emails**: Resend
- **Pagamentos**: Stripe (configurado, mas não integrado)

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
| `RESEND_API_KEY`             | Chave de API do Resend (envio de emails).                                |
| `RESEND_FROM_EMAIL`          | Endereço de email do remetente (ex: `LinkFlow <onboarding@resend.dev>`). |

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
O CSP atual usa `nonce` para scripts dinâmicos. Para garantir segurança:
1. **Middleware**: Gera um nonce único por requisição.
2. **Scripts Dinâmicos**: Usam o nonce gerado (ex: `next-themes`).
3. **Estilos**: Ainda usa `'unsafe-inline'` por enquanto (deve ser removido futuramente).

---

## 🚀 Deploy
### Netlify
1. Configure as variáveis de ambiente em **Site settings > Environment variables**.
2. Use o arquivo `.env.netlify` como referência.

### Vercel (Opcional)
- Suporte via `next.config.ts`, mas não é usado atualmente.

---

## 📦 Scripts Úteis
| Comando                     | Descrição                                                                 |
|-----------------------------|-------------------------------------------------------------------------|
| `npm run dev`               | Inicia o servidor de desenvolvimento.                                   |
| `npm run build`             | Compila o projeto para produção.                                         |
| `npm run start`            | Inicia o servidor de produção.                                          |
| `npm run provision`         | Configura o Appwrite (buckets, coleções, permissões).                   |
| `npm run fix:bucket`        | Corrige permissões de buckets no Appwrite.                              |
| `npm run migrate:staff-applications` | Migra dados de aplicações de staff.                          |
| `npm run seo:audit`         | Audita issues de SEO.                                                   |

---

## 🔄 Fluxos de Trabalho
### Autenticação
1. **Login**: Usa Appwrite (`/login`).
2. **Recuperação de Senha**:
   - Usuário insere email em `/forgot-password`.
   - Email com link de reset é enviado via Resend.
   - Usuário clica no link e redireciona para `/reset-password`.
   - Senha é atualizada via Appwrite.

### Envio de Emails
- Usa o Resend para enviar emails de recuperação de senha.
- Função `sendPasswordResetEmail` em `src/lib/email.ts`.

---

## 📝 Notas
- **Recuperação de Senha**: Ativada, mas depende da configuração correta do Resend.
- **Stripe**: Configurado, mas não integrado. Implemente webhooks e lógica de assinaturas.
- **CSP**: Em processo de migração para `nonce-based` (remover `'unsafe-inline'` e `'unsafe-eval'`).
- **Logs de Segurança**: Coleção criada, mas não há monitoramento ativo.

---