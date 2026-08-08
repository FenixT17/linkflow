// ============================================================================
// LinkFlow — Cloudflare Worker entry (wrapper)
// ============================================================================
// O OpenNext define `Cache-Control: s-maxage=31536000` (1 ano) em TODAS as
// páginas HTML pré-renderizadas (fixCacheHeaderForHtmlPages em
// node_modules/@opennextjs/aws/dist/core/routing/util.js). Como o header não
// tem `max-age` explícito, o Chrome (e outros browsers) trata o `s-maxage`
// como `max-age` — comportamento de interop conhecido — e o browser guarda o
// HTML durante 1 ANO. Consequência real observada: após um deploy que corrige
// um bug na UI, os utilizadores continuam a ver a versão antiga (ex.: o antigo
// `window.confirm` na eliminação de conta) porque o browser continua a servir
// o HTML antigo, que referencia os chunks antigos.
//
// O next.config.ts NÃO resolve isto: o OpenNext sobrepõe o Cache-Control após
// aplicar os headers do Next.js (a resposta final só tem `s-maxage`). Este
// wrapper corre DEPOIS do worker OpenNext (é o `main` do wrangler.jsonc) e
// força `Cache-Control: no-store` em todas as respostas HTML (documento) e
// RSC (text/x-component), garantindo que o browser e a CDN nunca servem HTML
// antigo.
//
// Os assets estáticos com hash (/_next/static/*, imagens, fontes) NÃO são
// afetados — mantêm o seu Cache-Control próprio (immutable), que é seguro
// porque o URL tem o hash do conteúdo.
// ============================================================================

import worker from "./.open-next/worker.js";

/** Header aplicado a documentos HTML e payloads RSC. */
const CACHE_CONTROL_NO_STORE = "no-store";

/**
 * Força `no-store` em respostas HTML (documento) e RSC (text/x-component).
 * Todas as outras respostas passam intactas.
 */
function applyNoStoreToHtml(response) {
  const contentType = response.headers.get("content-type") ?? "";
  const isHtmlLike =
    contentType.includes("text/html") || contentType.includes("text/x-component");

  if (!isHtmlLike) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set("Cache-Control", CACHE_CONTROL_NO_STORE);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env, ctx) {
    const response = await worker.fetch(request, env, ctx);
    return applyNoStoreToHtml(response);
  },
  // Preserva quaisquer outros handlers que o worker OpenNext possa exportar
  // no futuro (scheduled, queue, email, ...).
  ...(worker.scheduled ? { scheduled: worker.scheduled } : {}),
  ...(worker.queue ? { queue: worker.queue } : {}),
  ...(worker.email ? { email: worker.email } : {}),
};
