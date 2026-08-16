# LinkFlow + Appwrite Cloud

O LinkFlow utiliza o Appwrite para autenticação, base de dados e armazenamento. O browser não comunica diretamente com os recursos protegidos: as mutações passam pelas rotas same-origin e o servidor usa a API key apenas em operações server-side.

## Configuração

Copie `.env.example` para `.env.local` e preencha:

- `NEXT_PUBLIC_APPWRITE_ENDPOINT`
- `NEXT_PUBLIC_APPWRITE_PROJECT_ID`
- `NEXT_PUBLIC_APPWRITE_DATABASE_ID`
- `NEXT_PUBLIC_APPWRITE_FILES_BUCKET_ID`
- `APPWRITE_API_KEY` (apenas servidor)

O endpoint deve corresponder à região do projeto Appwrite.

## Provisionamento

```bash
cd frontend
npm run provision
```

O script idempotente cria ou atualiza a base `linkflow`, coleções, atributos, índices e buckets necessários. As coleções de analytics brutos, IPs recolhidos e dados de estudos são server-only e não devem ter permissões de leitura para o cliente.

## Execução

```bash
npm run dev
npm run typecheck
npm test
npm run build
```

A página pública (`/u/[username]`) é servida server-side. Analytics são registados por `/api/view` e `/api/click`; uploads passam por `/api/media/upload` e são validados no servidor.
