import "server-only";

import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";

/**
 * Idempotência distribuída para criações de documentos.
 *
 * Problema: um duplo clique (ou um retry, ou duas abas) enviar a MESMA
 * intenção de criação duas vezes fazia o Appwrite criar dois documentos —
 * porque cada POST é um `create` independente e não havia memória da
 * operação anterior. Bloquear o botão no frontend não resolve: o backend
 * continua a aceitar N pedidos idênticos.
 *
 * Solução: o cliente envia uma `Idempotency-Key` única por INTENÇÃO de
 * criação. O primeiro pedido com essa chave executa; os seguintes
 * (concorrentes ou repetidos) recebem o resultado guardado da primeira
 * execução, sem criar nada novo.
 *
 * Concorrência: a reserva da chave é feita com `SET ... NX` (atómico no
 * Redis, partilhado por todas as instâncias serverless). Não há
 * "verificar → se não existe → criar" não-atómico: exatamente um pedido
 * adquire a chave; os outros ficam à espera do resultado.
 *
 * Fail-open: se o Redis estiver indisponível, a operação segue sem
 * idempotência (nunca se bloqueia a criação de links por causa disto).
 * O guard do frontend continua a cobrir o caso comum do duplo clique.
 */

/** TTL da chave: cobre retries/replays sem ocupar memória indefinidamente. */
const IDEMPOTENCY_PREFIX = "linkflow:idempotency";
const KEY_TTL_SECONDS = 5 * 60;
/** Tempo máximo que um pedido duplicado espera pelo resultado do primeiro. */
const WAIT_TIMEOUT_MS = 3_000;
const POLL_INTERVAL_MS = 100;

export interface StoredIdempotentResponse {
  status: number;
  body: string;
  contentType: string | null;
}

type IdempotencyRecord =
  | { state: "pending" }
  | { state: "done"; response: StoredIdempotentResponse };

/**
 * Subconjunto do cliente Upstash que usamos. Definido como interface para
 * permitir injetar um mock stateful nos testes (sem tocar no Redis real).
 */
export interface IdempotencyRedisClient {
  // O cliente Upstash devolve `"OK" | null` (SET NX) tipado como `string | null`.
  set(key: string, value: string, options?: { nx?: boolean; ex?: number }): Promise<string | null>;
  get(key: string): Promise<unknown>;
  del(key: string): Promise<number>;
}

let redisClient: IdempotencyRedisClient | null = null;

function getRedis(): IdempotencyRedisClient {
  if (!redisClient) {
    const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
    const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
    if (!url || !token) {
      throw new Error(
        "Upstash Redis is not configured. Define UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
      );
    }
    redisClient = new Redis({ url, token });
  }
  return redisClient;
}

/** A chave é gerada pelo cliente (UUID/opaco) — restringimos o formato aceite. */
const KEY_RE = /^[A-Za-z0-9_-]{8,128}$/;

export function isValidIdempotencyKey(value: string | null | undefined): value is string {
  return typeof value === "string" && KEY_RE.test(value);
}

/**
 * A chave final é derivada (hash) e inclui o `scope` (coleção + sessão), para
 * que a mesma chave enviada por utilizadores diferentes nunca colida.
 */
function buildStorageKey(scope: string, key: string): string {
  const digest = createHash("sha256")
    .update(`${scope}:${key}`, "utf8")
    .digest("hex")
    .slice(0, 40);
  return `${IDEMPOTENCY_PREFIX}:${scope}:${digest}`;
}

function parseRecord(value: unknown): IdempotencyRecord | null {
  let raw: unknown = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== "object") return null;
  const record = raw as { state?: unknown; response?: unknown };
  if (record.state === "pending") return { state: "pending" };
  if (record.state === "done") {
    const response = record.response as StoredIdempotentResponse | undefined;
    if (response && typeof response.body === "string" && typeof response.status === "number") {
      return { state: "done", response };
    }
  }
  return null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type IdempotencyClaim =
  /** Esta requisição deve executar a operação (e guardar o resultado). */
  | { status: "acquired"; storageKey: string }
  /** A operação já foi executada antes → devolver o mesmo resultado. */
  | { status: "replay"; response: StoredIdempotentResponse }
  /** Outra requisição está a executar neste momento e não terminou a tempo. */
  | { status: "in-flight" }
  /** Redis indisponível → seguir sem idempotência (fail-open). */
  | { status: "unavailable" };

/**
 * Reserva atómica da chave de idempotência.
 *
 * `SET key value NX EX ttl` garante que exatamente UMA requisição adquire a
 * chave. Quem não adquire fica à espera do resultado; se o dono falhar (chave
 * libertada) ou nunca terminar (timeout), devolvemos in-flight.
 */
export async function claimIdempotencyKey(scope: string, key: string): Promise<IdempotencyClaim> {
  let redis: IdempotencyRedisClient;
  try {
    redis = getRedis();
  } catch {
    return { status: "unavailable" };
  }

  const storageKey = buildStorageKey(scope, key);

  try {
    const acquired = await redis.set(
      storageKey,
      JSON.stringify({ state: "pending" } satisfies IdempotencyRecord),
      { nx: true, ex: KEY_TTL_SECONDS },
    );
    if (acquired === "OK") return { status: "acquired", storageKey };

    // Outra requisição ganhou a chave — espera pelo resultado dela.
    const deadline = Date.now() + WAIT_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const record = parseRecord(await redis.get(storageKey));
      if (record?.state === "done") {
        return { status: "replay", response: record.response };
      }
      if (record === null) {
        // A chave desapareceu (o dono falhou/libertou) → tentamos nós.
        const retry = await redis.set(
          storageKey,
          JSON.stringify({ state: "pending" } satisfies IdempotencyRecord),
          { nx: true, ex: KEY_TTL_SECONDS },
        );
        if (retry === "OK") return { status: "acquired", storageKey };
      }
      await sleep(POLL_INTERVAL_MS);
    }
    return { status: "in-flight" };
  } catch {
    return { status: "unavailable" };
  }
}

/** Guarda o resultado da primeira execução para replays futuros. */
export async function completeIdempotencyKey(
  storageKey: string,
  response: StoredIdempotentResponse,
): Promise<void> {
  try {
    await getRedis().set(
      storageKey,
      JSON.stringify({ state: "done", response } satisfies IdempotencyRecord),
      { ex: KEY_TTL_SECONDS },
    );
  } catch {
    // Best-effort: sem resultado guardado, um replay não encontra a chave e
    // volta a executar. Nunca quebra a operação principal.
  }
}

/**
 * Liberta a chave quando a operação NÃO criou nada (erro do upstream), para
 * que uma nova tentativa com a mesma chave possa ser executada.
 */
export async function releaseIdempotencyKey(storageKey: string): Promise<void> {
  try {
    await getRedis().del(storageKey);
  } catch {
    // Best-effort: se falhar, a chave expira sozinha dentro do TTL.
  }
}

/** Injeta um cliente fake nos testes sem tocar no Redis real. */
export function setIdempotencyRedisForTests(client: IdempotencyRedisClient | null): void {
  redisClient = client;
}
