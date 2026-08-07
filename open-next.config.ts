import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * Configuração do adaptador OpenNext para Cloudflare.
 *
 * O LinkFlow não usa ISR/revalidação, por isso não são necessários os
 * overrides de cache incremental (R2) nem o service binding de
 * auto-referência (WORKER_SELF_REFERENCE) do template oficial — a ausência
 * desses bindings é precisamente o que evita o erro "WORKER_SELF_REFERENCE
 * faz referência ao Worker ... que não foi encontrado".
 */
export default defineCloudflareConfig({});
