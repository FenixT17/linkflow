import { Client, Databases, Storage, Permission, Role, DatabasesIndexType } from "node-appwrite";
import dotenv from "dotenv";
import { ensureBucketWithPublicRead } from "./lib/public-bucket";

dotenv.config({ path: ".env.local" });

// Convention: NEXT_PUBLIC_APPWRITE_* is the canonical name (same as the runtime
// code and .env.example). Legacy non-prefixed aliases are accepted for backwards
// compatibility with older .env.local files.
const endpoint =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ??
  process.env.APPWRITE_ENDPOINT ??
  "https://fra.cloud.appwrite.io/v1";
const projectId =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId =
  process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ??
  process.env.APPWRITE_DATABASE_ID ??
  "linkflow";
// Bucket ID: tem de corresponder ao runtime (NEXT_PUBLIC_APPWRITE_FILES_BUCKET_ID).
// No plano gratuito o Appwrite limita o nº de buckets — se já existir um bucket
// (ex: criado manualmente na consola com ID aleatório), o provision deve
// ATUALIZAR esse bucket em vez de tentar criar um novo com ID fixo "files".
const filesBucketId =
  process.env.NEXT_PUBLIC_APPWRITE_FILES_BUCKET_ID ??
  process.env.APPWRITE_FILES_BUCKET_ID ??
  "files";

if (!projectId || !apiKey) {
  console.error(
    "Missing required environment variables: NEXT_PUBLIC_APPWRITE_PROJECT_ID and APPWRITE_API_KEY"
  );
  process.exit(1);
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);
const storage = new Storage(client);

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWithIdempotency<T>(fn: () => Promise<T>, name: string): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error: unknown) {
    const err = error instanceof Error ? (error as Error & { code?: number }) : undefined;
    if (err?.code === 409 || err?.message?.includes("already exists")) {
      console.log(`   ↳ ${name} already exists, skipping.`);
      return undefined;
    }
    throw error;
  }
}

interface AppwriteAttribute {
  status: string;
  key: string;
}

async function waitForAttributes(collectionId: string, attributeNames: string[]) {
  console.log(`   ↳ Waiting for attributes in ${collectionId}...`);
  let ready = false;
  let attempts = 0;
  while (!ready && attempts < 30) {
    const { attributes } = await databases.listAttributes(databaseId, collectionId);
    const readyNames = (attributes as unknown as AppwriteAttribute[])
      .filter((a) => a.status === "available")
      .map((a) => a.key);
    if (attributeNames.every((name) => readyNames.includes(name))) {
      ready = true;
      break;
    }
    await sleep(1000);
    attempts++;
  }
  if (!ready) {
    console.warn(`   ↳ Some attributes in ${collectionId} were not ready in time.`);
  }
}

/**
 * Cria a coleção ou, se já existir, ATUALIZA as permissões para as novas
 * (least-privilege). Sem isto, o script era idempotente e as coleções já
 * existentes mantinham permissões permissivas (read/update/delete: users())
 * que, sendo ADITIVAS às permissões por documento, expunham todos os dados
 * a qualquer utilizador autenticado.
 */
async function createCollection(collectionId: string, name: string, permissions: string[], documentSecurity = true) {
  const created = await runWithIdempotency(
    () =>
      databases.createCollection(databaseId, collectionId, name, permissions, documentSecurity),
    `Collection ${collectionId}`
  );
  if (created) return created;
  // Já existe — re-aplica as permissões pretendidas (updateCollection
  // substitui o array de permissões completo). documentSecurity mantém-se.
  console.log(`   ↳ Collection ${collectionId} exists — updating permissions (least-privilege)...`);
  return databases.updateCollection(
    databaseId,
    collectionId,
    name,
    permissions,
    documentSecurity
  );
}

async function createStringAttribute(
  collectionId: string,
  key: string,
  size: number,
  required: boolean,
  defaultValue?: string
) {
  // NOTA: o default é passado mesmo para atributos obrigatórios — o Appwrite
  // suporta defaults em atributos required (ex: themes.theme = "glass").
  // Antes, `required ? undefined : defaultValue` descartava o default, o que
  // fazia o createDocument sem o campo falhar com "Missing required attribute".
  // NOTA: o Appwrite NÃO permite default em atributos obrigatórios
  // ("Cannot set default value for required attribute"). Por isso o default
  // só é passado quando required=false — para required, os documentos têm de
  // enviar o valor explicitamente (ex: createPage envia theme: "glass").
  return runWithIdempotency(
    () =>
      databases.createStringAttribute(databaseId, collectionId, key, size, required, required ? undefined : defaultValue),
    `String attribute ${collectionId}.${key}`
  );
}

async function createStringArrayAttribute(
  collectionId: string,
  key: string,
  size: number,
  required: boolean
) {
  return runWithIdempotency(
    () => databases.createStringAttribute(databaseId, collectionId, key, size, required, undefined, true),
    `String[] attribute ${collectionId}.${key}`
  );
}

async function createBooleanAttribute(
  collectionId: string,
  key: string,
  required: boolean,
  defaultValue?: boolean
) {
  return runWithIdempotency(
    () =>
      databases.createBooleanAttribute(databaseId, collectionId, key, required, required ? undefined : defaultValue),
    `Boolean attribute ${collectionId}.${key}`
  );
}

async function createIntegerAttribute(
  collectionId: string,
  key: string,
  required: boolean,
  defaultValue?: number
) {
  return runWithIdempotency(
    () =>
      databases.createIntegerAttribute(databaseId, collectionId, key, required, required ? undefined : defaultValue),
    `Integer attribute ${collectionId}.${key}`
  );
}

async function createDatetimeAttribute(
  collectionId: string,
  key: string,
  required: boolean
) {
  return runWithIdempotency(
    () =>
      databases.createDatetimeAttribute(databaseId, collectionId, key, required),
    `Datetime attribute ${collectionId}.${key}`
  );
}

/**
 * Backfill: garante que um atributo string JÁ EXISTENTE tem o default
 * pretendido. Necessário porque versões antigas do createStringAttribute
 * descartavam o default em atributos obrigatórios (required ? undefined :
 * defaultValue) — ex: themes.theme ficou com default:null, o que fazia o
 * createDocument sem o campo falhar com "Missing required attribute".
 */
async function ensureStringAttributeDefault(
  collectionId: string,
  key: string,
  required: boolean,
  defaultValue: string
) {
  try {
    const { attributes } = await databases.listAttributes(databaseId, collectionId);
    const attr = (attributes as unknown as Array<{ key: string; required?: boolean; default?: unknown }>).find(
      (a) => a.key === key
    );
    if (!attr) {
      console.log(`   ↳ ${collectionId}.${key} not found, skipping backfill.`);
      return;
    }
    const currentDefault = attr.default as unknown;
    if (currentDefault === defaultValue) {
      console.log(`   ↳ ${collectionId}.${key} default already "${defaultValue}", skipping.`);
      return;
    }
    // O `required` pretendido é o que o chamador passa (o default só é
    // permitido em atributos não-obrigatórios no Appwrite).
    await databases.updateStringAttribute(
      databaseId,
      collectionId,
      key,
      required,
      defaultValue
    );
    console.log(`   ↳ ${collectionId}.${key} updated (required=${required}, default="${defaultValue}").`);
  } catch (error: unknown) {
    // Falha não bloqueante — o provision continua; apenas avisa.
    console.warn(`   ↳ Could not backfill default for ${collectionId}.${key}: ${(error as Error).message}`);
  }
}

/**
 * Backfill: garante que um atributo boolean JÁ EXISTENTE tem o default
 * pretendido. Necessário porque createBooleanAttribute descarta o default
 * em atributos obrigatórios (required ? undefined : defaultValue) — ex:
 * themes.mostrarSocial ficou com required:true/default:null, o que fazia o
 * createDocument sem o campo falhar com "Missing required attribute".
 * Igual ao ensureStringAttributeDefault (Sessão 31) mas para booleans.
 */
async function ensureBooleanAttributeDefault(
  collectionId: string,
  key: string,
  required: boolean,
  defaultValue: boolean
) {
  try {
    const { attributes } = await databases.listAttributes(databaseId, collectionId);
    const attr = (attributes as unknown as Array<{ key: string; required?: boolean; default?: unknown }>).find(
      (a) => a.key === key
    );
    if (!attr) {
      console.log(`   ↳ ${collectionId}.${key} not found, skipping backfill.`);
      return;
    }
    const currentDefault = attr.default as unknown;
    if (currentDefault === defaultValue) {
      console.log(`   ↳ ${collectionId}.${key} default already ${defaultValue}, skipping.`);
      return;
    }
    // O `required` pretendido é o que o chamador passa (o default só é
    // permitido em atributos não-obrigatórios no Appwrite).
    await databases.updateBooleanAttribute(
      databaseId,
      collectionId,
      key,
      required,
      defaultValue
    );
    console.log(`   ↳ ${collectionId}.${key} updated (required=${required}, default=${defaultValue}).`);
  } catch (error: unknown) {
    // Falha não bloqueante — o provision continua; apenas avisa.
    console.warn(`   ↳ Could not backfill default for ${collectionId}.${key}: ${(error as Error).message}`);
  }
}

type IndexType = "key" | "unique" | "fulltext" | "spatial";

async function createIndex(collectionId: string, key: string, type: IndexType, attributes: string[]) {
  return runWithIdempotency(
    () =>
      databases.createIndex(databaseId, collectionId, key, type as DatabasesIndexType, attributes),
    `Index ${collectionId}.${key}`
  );
}


async function provision() {
  console.log("🚀 Provisioning LinkFlow on Appwrite Cloud...\n");

  // 1. Database
  console.log("📦 Database");
  try {
    await databases.create(databaseId, "linkflow");
  } catch (error: unknown) {
    const err = error instanceof Error ? (error as Error & { code?: number }) : undefined;
    const message = err?.message ?? String(error);
    const isAlreadyExists = err?.code === 409 || message.includes("already exists");
    // Free plan: when the database limit is reached, the `linkflow` database is
    // typically already provisioned. Continue with collections/attributes/bucket;
    // if the database truly does not exist, the next step fails loudly.
    const isPlanLimit = message.includes("maximum number of databases allowed");
    if (isAlreadyExists || isPlanLimit) {
      console.log(`   ↳ Database step skipped (already exists or plan limit reached).`);
    } else {
      throw error;
    }
  }

  // 2. Users collection (custom profile data)
  // Server-only: nenhum create/update/delete/read ao nível da coleção.
  // O perfil é criado/atualizado via API routes com API key; o browser recebe
  // apenas Permission.read(Role.user(owner)) no próprio documento.
  console.log("\n👤 Collection: users");
  await createCollection("users", "Utilizadores", [], true);
  await createStringAttribute("users", "idUtilizador", 255, true);
  await createStringAttribute("users", "email", 255, true);
  await createStringAttribute("users", "nomeExibicao", 255, true);
  await createStringAttribute("users", "plano", 32, true, "free");
  await createStringAttribute("users", "pais", 128, false, "");
  await createStringAttribute("users", "codigoPais", 8, false, "");
  await createStringAttribute("users", "moeda", 8, false, "EUR");
  await createDatetimeAttribute("users", "criadoEm", true);
  await waitForAttributes("users", ["idUtilizador", "email", "nomeExibicao", "plano", "pais", "codigoPais", "moeda", "criadoEm"]);
  await createIndex("users", "idx_users_idUtilizador", "unique", ["idUtilizador"]);
  await createIndex("users", "idx_users_email", "unique", ["email"]);

  // 3. Pages collection
  // Sessão 36: só create ao nível da coleção; o acesso é por documento
  // (Role.user(owner)). Páginas públicas são servidas por rotas server-side
  // (server SDK/API key) que validam published antes de devolver dados.
  console.log("\n📄 Collection: pages");
  await createCollection(
    "pages",
    "Páginas",
    [
      Permission.create(Role.users()),
    ],
    true
  );
  await createStringAttribute("pages", "idUtilizador", 255, true);
  await createStringAttribute("pages", "nomeUtilizador", 255, true);
  await createStringAttribute("pages", "nomeExibicao", 255, true);
  await createStringAttribute("pages", "biografia", 4096, false);
  await createStringAttribute("pages", "idAvatar", 255, false);
  await createStringAttribute("pages", "idBanner", 255, false);
  await createBooleanAttribute("pages", "publicado", true, false);
  await createStringAttribute("pages", "tipoPagina", 32, false, "minimal");
  await createStringAttribute("pages", "modeloPagina", 32, false, "template1");
  await createStringArrayAttribute("pages", "emblemas", 32, false);
  await createDatetimeAttribute("pages", "publicacaoAgendadaEm", false);
  await createDatetimeAttribute("pages", "despublicacaoAgendadaEm", false);
  // Sessão 43: flag usada pela exclusão de conta — despública a página e
  // sinaliza "em eliminação" (aEliminar: true) para as rotas /api/view e
  // /api/click pararem de registar novas interações durante a limpeza.
  await createBooleanAttribute("pages", "aEliminar", false, false);
  await waitForAttributes("pages", ["idUtilizador", "nomeUtilizador", "nomeExibicao", "biografia", "idAvatar", "idBanner", "publicado", "tipoPagina", "modeloPagina", "emblemas", "publicacaoAgendadaEm", "despublicacaoAgendadaEm", "aEliminar"]);
  await createIndex("pages", "idx_pages_idUtilizador", "key", ["idUtilizador"]);
  await createIndex("pages", "idx_pages_nomeUtilizador", "unique", ["nomeUtilizador"]);
  await createIndex("pages", "idx_pages_idAvatar", "key", ["idAvatar"]);
  await createIndex("pages", "idx_pages_idBanner", "key", ["idBanner"]);

  // 4. Links collection
  // Sessão 36: só create ao nível da coleção. O dono lê/edita/apaga os SEUS
  // links via permissões por documento. Links públicos são servidos por rotas
  // server-side após verificar que a página está publicada.
  console.log("\n🔗 Collection: links");
  await createCollection(
    "links",
    "Links",
    [
      Permission.create(Role.users()),
    ],
    true
  );
  await createStringAttribute("links", "idPagina", 255, true);
  await createStringAttribute("links", "tipo", 64, true);
  await createStringAttribute("links", "titulo", 255, true);
  await createStringAttribute("links", "url", 4096, true);
  await createStringAttribute("links", "descricao", 4096, false);
  await createStringAttribute("links", "icone", 255, false);
  await createStringAttribute("links", "cor", 32, false);
  await createStringAttribute("links", "idImagem", 255, false);
  await createStringAttribute("links", "animacao", 32, false, "none");
  await createBooleanAttribute("links", "ativo", true, true);
  await createBooleanAttribute("links", "visivel", true, true);
  await createBooleanAttribute("links", "novaAba", true, true);
  await createIntegerAttribute("links", "ordem", true, 0);
  await createIntegerAttribute("links", "cliques", true, 0);
  await createDatetimeAttribute("links", "agendadoPara", false);
  await waitForAttributes("links", [
    "idPagina", "tipo", "titulo", "url", "descricao", "icone", "cor", "idImagem",
    "animacao", "ativo", "visivel", "novaAba", "ordem", "cliques", "agendadoPara",
  ]);
  await createIndex("links", "idx_links_idPagina", "key", ["idPagina"]);
  await createIndex("links", "idx_links_idPagina_ordem", "key", ["idPagina", "ordem"]);
  await createIndex("links", "idx_links_idImagem", "key", ["idImagem"]);

  // 5. Analytics collection
  // Sessão 36: só create. Analytics são privadas — só o dono lê as suas via
  // permissões por documento; as atualizações de contagem são server-side.
  console.log("\n📊 Collection: analytics");
  await createCollection(
    "analytics",
    "Análises",
    [
      Permission.create(Role.users()),
    ],
    true
  );
  await createStringAttribute("analytics", "idPagina", 255, true);
  await createIntegerAttribute("analytics", "visualizacoes", true, 0);
  await createIntegerAttribute("analytics", "cliques", true, 0);
  await createIntegerAttribute("analytics", "seguidores", true, 0);
  await createStringAttribute("analytics", "metricasJson", 1048576, false);
  await waitForAttributes("analytics", ["idPagina", "visualizacoes", "cliques", "seguidores", "metricasJson"]);
  await createIndex("analytics", "idx_analytics_idPagina", "unique", ["idPagina"]);

  // 5b. Visits collection (raw analytics events)
  // Server-only: raw visits stored by the view/click API routes. The IP is
  // never exposed to clients — it is only used to derive the country and to
  // deduplicate unique visitors. No permissions: only the server SDK (API
  // key) writes/reads this collection; clients have zero access.
  console.log("\n🕵️ Collection: visits");
  await createCollection(
    "visits",
    "Visitas",
    [],
    true
  );
  await createStringAttribute("visits", "idPagina", 255, true);
  await createStringAttribute("visits", "hashVisitante", 128, false);
  await createStringAttribute("visits", "ip", 64, false);
  await createStringAttribute("visits", "pais", 128, false);
  await createStringAttribute("visits", "codigoPais", 8, false);
  await createStringAttribute("visits", "cidade", 128, false);
  await createStringAttribute("visits", "dispositivo", 32, false);
  await createStringAttribute("visits", "navegador", 64, false);
  await createStringAttribute("visits", "sistemaOperativo", 64, false);
  await createStringAttribute("visits", "origem", 512, false);
  await createStringAttribute("visits", "agenteUtilizador", 512, false);
  await createStringAttribute("visits", "linkClicado", 255, false);
  await createDatetimeAttribute("visits", "criadoEm", false);
  await waitForAttributes("visits", [
    "idPagina", "hashVisitante", "ip", "pais", "codigoPais", "cidade", "dispositivo",
    "navegador", "sistemaOperativo", "origem", "agenteUtilizador", "linkClicado", "criadoEm",
  ]);
  await createIndex("visits", "idx_visits_idPagina", "key", ["idPagina"]);
  await createIndex("visits", "idx_visits_idPagina_criadoEm", "key", ["idPagina", "criadoEm"]);

  // 5c. Collected IPs collection (deduplicação de IPs — server-only)
  // Cada IP é recolhido NO MÁXIMO UMA VEZ: o índice único em `ip` garante
  // que o SaaS nunca grava o mesmo IP duas vezes. Se o registo for APAGADO
  // da base de dados, o próximo acesso volta a recolher o IP + país
  // (a chave única fica livre para ser reutilizada). Sem permissões:
  // só o SDK do servidor (API key) escreve/lê esta coleção.
  console.log("\n🛡️ Collection: collected_ips");
  await createCollection(
    "collected_ips",
    "IPs Recolhidos",
    [],
    true
  );
  await createStringAttribute("collected_ips", "ip", 64, true);
  await createStringAttribute("collected_ips", "hashVisitante", 128, false);
  await createStringAttribute("collected_ips", "pais", 128, false);
  await createStringAttribute("collected_ips", "codigoPais", 8, false);
  await createStringAttribute("collected_ips", "cidade", 128, false);
  await createStringAttribute("collected_ips", "dispositivo", 32, false);
  await createStringAttribute("collected_ips", "navegador", 64, false);
  await createStringAttribute("collected_ips", "sistemaOperativo", 64, false);
  await createDatetimeAttribute("collected_ips", "vistoPrimeiraVezEm", true);
  await createDatetimeAttribute("collected_ips", "vistoUltimaVezEm", false);
  await waitForAttributes("collected_ips", [
    "ip", "hashVisitante", "pais", "codigoPais", "cidade", "dispositivo",
    "navegador", "sistemaOperativo", "vistoPrimeiraVezEm", "vistoUltimaVezEm",
  ]);
  // M6 (privacidade): o IP cru NUNCA é persistido — apenas hashIp(ip) é
  // gravado no campo `ip` e em `hashVisitante`. O índice único em `ip` (hash)
  // garante "1 registo por IP" (mesmo IP → mesmo hash → 409); o índice único
  // em hashVisitante cobre a query de dedup por hash.
  await createIndex("collected_ips", "idx_collected_ips_ip", "unique", ["ip"]);
  await createIndex("collected_ips", "idx_collected_ips_hashVisitante", "unique", ["hashVisitante"]);

  // 5d. Dados para Estudos collection (estudos/análise — server-only)
  // DECISÃO EXPLÍCITA DO PRODUTO (Sessão 42): ao contrário das restantes
  // coleções (que só guardam hashes do IP), esta guarda o IP CRU, o nome do
  // dispositivo e as coordenadas aproximadas (city-level, compatíveis com
  // Google Maps) em texto bruto, para fins de estudo. Sem permissões ([]):
  // só o SDK do servidor (API key) escreve/lê — o cliente nunca acede.
  // Nota RGPD/LGPD: requer aviso de privacidade/consentimento adequado.
  console.log("\n📚 Collection: dados_para_estudos");
  await createCollection(
    "dados_para_estudos",
    "Dados para Estudos",
    [],
    true
  );
  await createStringAttribute("dados_para_estudos", "ip", 64, true);
  await createStringAttribute("dados_para_estudos", "nomeDispositivo", 255, false);
  await createStringAttribute("dados_para_estudos", "dispositivo", 32, false);
  await createStringAttribute("dados_para_estudos", "navegador", 64, false);
  await createStringAttribute("dados_para_estudos", "sistemaOperativo", 64, false);
  await createStringAttribute("dados_para_estudos", "agenteUtilizador", 512, false);
  await createStringAttribute("dados_para_estudos", "pais", 128, false);
  await createStringAttribute("dados_para_estudos", "codigoPais", 8, false);
  await createStringAttribute("dados_para_estudos", "cidade", 128, false);
  await createStringAttribute("dados_para_estudos", "latitude", 32, false);
  await createStringAttribute("dados_para_estudos", "longitude", 32, false);
  await createStringAttribute("dados_para_estudos", "coordenadas", 64, false);
  await createStringAttribute("dados_para_estudos", "idPagina", 255, false);
  await createStringAttribute("dados_para_estudos", "origem", 512, false);
  await createDatetimeAttribute("dados_para_estudos", "criadoEm", true);
  await waitForAttributes("dados_para_estudos", [
    "ip", "nomeDispositivo", "dispositivo", "navegador", "sistemaOperativo", "agenteUtilizador", "pais",
    "codigoPais", "cidade", "latitude", "longitude", "coordenadas", "idPagina",
    "origem", "criadoEm",
  ]);
  // Uma linha por visitante/IP. O índice único em `ip` garante "1 registo por IP".
  await createIndex("dados_para_estudos", "idx_study_ip_unique", "unique", ["ip"]);
  await createIndex("dados_para_estudos", "idx_study_idPagina", "key", ["idPagina"]);
  await createIndex("dados_para_estudos", "idx_study_criadoEm", "key", ["criadoEm"]);

  // 6. Themes collection
  // Sessão 36: só create ao nível da coleção; acesso por documento (dono).
  console.log("\n🎨 Collection: themes");
  await createCollection(
    "themes",
    "Temas",
    [
      Permission.create(Role.users()),
    ],
    true
  );
  await createStringAttribute("themes", "idPagina", 255, true);
  // tema: OBRIGATÓRIO + default é impossível no Appwrite ("Cannot set
  // default value for required attribute"). Como o campo é legado (Liquid
  // Glass only), tornamos OPcional com default "glass": documentos criados
  // sem tema obtêm automaticamente "glass" e o createPage envia-o sempre
  // explicitamente (Sessão 30) — defesa em profundidade.
  await createStringAttribute("themes", "tema", 64, false, "glass");
  await createIntegerAttribute("themes", "desfoco", true, 25);
  await createIntegerAttribute("themes", "arredondado", true, 16);
  await createIntegerAttribute("themes", "opacidadeLinks", true, 100);
  await createStringAttribute("themes", "corFundo", 32, false, "#0a0a0a");
  await createStringAttribute("themes", "corCartao", 32, false, "rgba(255,255,255,0.03)");
  await createStringAttribute("themes", "corTexto", 32, false, "#fafafa");
  await createStringAttribute("themes", "corDestaque", 32, false, "#fafafa");
  await createStringAttribute("themes", "familiaFonte", 64, false, "Inter");
  await createIntegerAttribute("themes", "tamanhoFonte", true, 16);
  await createIntegerAttribute("themes", "raioBotao", true, 12);
  await createStringAttribute("themes", "larguraBotao", 32, false, "full");
  await createStringAttribute("themes", "alturaBotao", 32, false, "normal");
  await createStringAttribute("themes", "estiloBotao", 32, false, "glass");
  await createStringAttribute("themes", "sombra", 32, false, "md");
  // mostrarAvatar/mostrarBiografia/mostrarSocial: OPCIONAIS com default true (Sessão 45).
  await createBooleanAttribute("themes", "mostrarAvatar", false, true);
  await createBooleanAttribute("themes", "mostrarBiografia", false, true);
  await createBooleanAttribute("themes", "mostrarSocial", false, true);
  await createIntegerAttribute("themes", "espacamento", true, 6);
  // Sessão 54: atributos Liquid Glass. OPCIONAIS com os defaults usados no runtime.
  await createIntegerAttribute("themes", "opacidadeVidro", false, 35);
  await createIntegerAttribute("themes", "desfocoVidro", false, 25);
  await createIntegerAttribute("themes", "intensidadeVidro", false, 50);
  await waitForAttributes("themes", [
    "idPagina", "tema", "desfoco", "arredondado", "opacidadeLinks", "corFundo", "corCartao",
    "corTexto", "corDestaque", "familiaFonte", "tamanhoFonte", "raioBotao", "larguraBotao",
    "alturaBotao", "estiloBotao", "sombra", "mostrarAvatar", "mostrarBiografia", "mostrarSocial", "espacamento",
    "opacidadeVidro", "desfocoVidro", "intensidadeVidro",
  ]);
  // Backfill: contas existentes têm themes.tema com default:null.
  await ensureStringAttributeDefault("themes", "tema", false, "glass");
  // Backfill (Sessão 45): mostrarAvatar/mostrarBiografia/mostrarSocial.
  await ensureBooleanAttributeDefault("themes", "mostrarAvatar", false, true);
  await ensureBooleanAttributeDefault("themes", "mostrarBiografia", false, true);
  await ensureBooleanAttributeDefault("themes", "mostrarSocial", false, true);
  await createIndex("themes", "idx_themes_idPagina", "unique", ["idPagina"]);

  // 7. QR Codes collection
  // Sessão 36: só create; acesso por documento (dono).
  console.log("\n🔳 Collection: qr_codes");
  await createCollection(
    "qr_codes",
    "Códigos QR",
    [
      Permission.create(Role.users()),
    ],
    true
  );
  await createStringAttribute("qr_codes", "idPagina", 255, true);
  await createStringAttribute("qr_codes", "corPrimeiroPlano", 32, true, "#000000");
  await createStringAttribute("qr_codes", "corFundo", 32, true, "#FFFFFF");
  await createStringAttribute("qr_codes", "idLogo", 255, false);
  await createIntegerAttribute("qr_codes", "tamanho", true, 512);
  await waitForAttributes("qr_codes", ["idPagina", "corPrimeiroPlano", "corFundo", "idLogo", "tamanho"]);
  await createIndex("qr_codes", "idx_qr_codes_idPagina", "unique", ["idPagina"]);

  // 9. Subscriptions collection
  // Sessão 36: só create; escrita/leitura feita server-side (Stripe webhooks).
  console.log("\n💳 Collection: subscriptions");
  await createCollection(
    "subscriptions",
    "Subscrições",
    [
      Permission.create(Role.users()),
    ],
    true
  );
  await createStringAttribute("subscriptions", "idUtilizador", 255, true);
  await createStringAttribute("subscriptions", "idClienteStripe", 255, false);
  await createStringAttribute("subscriptions", "estado", 64, true, "active");
  await createStringAttribute("subscriptions", "plano", 32, true, "free");
  await createDatetimeAttribute("subscriptions", "fimPeriodoAtual", false);
  await waitForAttributes("subscriptions", ["idUtilizador", "idClienteStripe", "estado", "plano", "fimPeriodoAtual"]);
  await createIndex("subscriptions", "idx_subscriptions_idUtilizador", "key", ["idUtilizador"]);

  // 10. Teams collection
  // Sessão 36: só create; acesso por documento (dono).
  console.log("\n👥 Collection: teams");
  await createCollection(
    "teams",
    "Equipas",
    [
      Permission.create(Role.users()),
    ],
    true
  );
  await createStringAttribute("teams", "nome", 255, true);
  await createStringAttribute("teams", "idProprietario", 255, true);
  await waitForAttributes("teams", ["nome", "idProprietario"]);
  await createIndex("teams", "idx_teams_idProprietario", "key", ["idProprietario"]);

  // 11. Notifications collection
  // Sessão 36: só create; acesso por documento (dono).
  console.log("\n🔔 Collection: notifications");
  await createCollection(
    "notifications",
    "Notificações",
    [
      Permission.create(Role.users()),
    ],
    true
  );
  await createStringAttribute("notifications", "idUtilizador", 255, true);
  await createStringAttribute("notifications", "tipo", 64, true);
  await createStringAttribute("notifications", "mensagem", 4096, true);
  await createBooleanAttribute("notifications", "lida", true, false);
  await createDatetimeAttribute("notifications", "criadoEm", true);
  await waitForAttributes("notifications", ["idUtilizador", "tipo", "mensagem", "lida", "criadoEm"]);
  await createIndex("notifications", "idx_notifications_idUtilizador", "key", ["idUtilizador"]);
  await createIndex("notifications", "idx_notifications_idUtilizador_lida", "key", ["idUtilizador", "lida"]);

  // 12. Security Logs collection
  // Sessão 36 (least-privilege): SEM permissões ao nível da coleção — server
  // only. A escrita e a leitura são feitas exclusivamente por rotas API
  // server-side (server SDK/API key) que derivam o idUtilizador da sessão e
  // validam a propriedade. Antes tinha read/update: users() — qualquer
  // utilizador autenticado lia/alterava os logs (emails + IPs) de todos.
  console.log("\n📋 Collection: security_logs");
  await createCollection(
    "security_logs",
    "Registos de Segurança",
    [],
    true
  );
  await createStringAttribute("security_logs", "idUtilizador", 255, true);
  await createStringAttribute("security_logs", "tipoEvento", 64, true);
  await createStringAttribute("security_logs", "email", 255, false);
  await createStringAttribute("security_logs", "enderecoIP", 64, false);
  await createStringAttribute("security_logs", "agenteUtilizador", 512, false);
  await createStringAttribute("security_logs", "metadados", 4096, false);
  await createDatetimeAttribute("security_logs", "criadoEm", true);
  await waitForAttributes("security_logs", ["idUtilizador", "tipoEvento", "email", "enderecoIP", "agenteUtilizador", "metadados", "criadoEm"]);
  await createIndex("security_logs", "idx_security_idUtilizador", "key", ["idUtilizador"]);
  await createIndex("security_logs", "idx_security_tipoEvento", "key", ["tipoEvento"]);
  await createIndex("security_logs", "idx_security_criadoEm", "key", ["criadoEm"]);

  // 12b. Activity Logs collection (atividades recentes da conta)
  // Sessão 36: só create; o client SDK grava com permissões por documento
  // (Role.user) e só o dono lê o seu registo.
  console.log("\n📝 Collection: activity_logs");
  await createCollection(
    "activity_logs",
    "Registos de Atividade",
    [
      Permission.create(Role.users()),
    ],
    true
  );
  await createStringAttribute("activity_logs", "idUtilizador", 255, true);
  await createStringAttribute("activity_logs", "acao", 64, true);
  await createStringAttribute("activity_logs", "detalhes", 2048, false);
  await createStringAttribute("activity_logs", "enderecoIP", 64, false);
  await createStringAttribute("activity_logs", "agenteUtilizador", 512, false);
  await createDatetimeAttribute("activity_logs", "criadoEm", true);
  await waitForAttributes("activity_logs", [
    "idUtilizador", "acao", "detalhes", "enderecoIP", "agenteUtilizador", "criadoEm",
  ]);
  await createIndex("activity_logs", "idx_activity_idUtilizador", "key", ["idUtilizador"]);
  await createIndex("activity_logs", "idx_activity_idUtilizador_criadoEm", "key", ["idUtilizador", "criadoEm"]);

  // 12c. Staff applications collection (candidaturas ao staff)
  // Segurança: nenhuma permissão client-side. A candidatura é criada e
  // aprovada exclusivamente por rotas/server SDK com dados derivados da
  // sessão e com status controlado pelo servidor. O utilizador só recebe
  // Permission.read por documento na rota POST /api/staff/apply.
  console.log("\n🛠️ Collection: staff_applications");
  await createCollection(
    "staff_applications",
    "Candidaturas ao Staff",
    [],
    true
  );
  await createStringAttribute("staff_applications", "idUtilizador", 255, true);
  await createStringAttribute("staff_applications", "mensagem", 4096, true);
  await createStringAttribute("staff_applications", "estado", 32, true, "pending");
  // Identifica a revisão confiável da equipa. Uma candidatura só pode
  // desbloquear a badge staff quando estado=approved E revistoPor preenchido.
  await createStringAttribute("staff_applications", "revistoPor", 255, false, "");
  await createDatetimeAttribute("staff_applications", "criadoEm", true);
  await waitForAttributes("staff_applications", ["idUtilizador", "mensagem", "estado", "revistoPor", "criadoEm"]);
  await createIndex("staff_applications", "idx_staff_idUtilizador", "key", ["idUtilizador"]);
  await createIndex("staff_applications", "idx_staff_idUtilizador_estado", "key", ["idUtilizador", "estado"]);

  // 13. Storage bucket (single bucket for all files to fit free plan)
  // Private bucket: avatars/banners/images are served publicly through the
  // same-origin `/api/media/[fileId]` Worker proxy, which authenticates to
  // Appwrite with the server API key and applies anti-abuse controls. The
  // bucket has no public read and no update/delete users(); file permissions
  // are scoped to the owner by uploadFile.
  console.log("\n🗂️  Buckets");
  await ensureBucketWithPublicRead(storage, filesBucketId, "Files", databases, databaseId);
  console.log(
    "   ↳ Ficheiros existentes foram verificados e re-scoped para permissões privadas por dono; órfãos ficaram sem acesso."
  );

  console.log("\n✅ LinkFlow backend provisioned successfully!");
}

provision().catch((error) => {
  console.error("\n Provisioning failed:", error.message);
  process.exit(1);
});
