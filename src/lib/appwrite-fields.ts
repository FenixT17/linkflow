/**
 * Allowlist de campos por coleção — filtro anti-mass-assignment do proxy
 * `/api/appwrite`.
 *
 * Mesmo com a validação de propriedade, o body encaminhado para o Appwrite
 * pode conter campos que o utilizador não deve controlar (`cliques`,
 * `emblemas`, `plano`, `idPagina` em updates de `pages`, ...). Este módulo
 * garante que só campos legítimos são escritos, independentemente do que o
 * browser envia.
 *
 * Vive fora do route handler por dois motivos:
 *  1. Route handlers só podem exportar métodos HTTP (o typegen do Next.js 15.5
 *     rejeita exports extra), logo o allowlist não seria testável lá dentro.
 *  2. Um allowlist desatualizado falha **em silêncio**: os campos são removidos
 *     do body, o Appwrite responde 200 e a escrita simplesmente não persiste.
 *     Sem testes, o bug passa despercebido — foi o que aconteceu com `themes`
 *     (aparência) e `qr_codes`.
 *     Ver `src/__tests__/appwrite-fields.test.ts`.
 *
 * ⚠️ Ao adicionar um atributo a uma coleção em
 * `scripts/provision-appwrite.ts`, adiciona-o também aqui.
 */

export const ALLOWED_FIELDS: Record<string, Set<string>> = {
  pages: new Set([
    "nomeUtilizador", "nomeExibicao", "biografia",
    "tipoPagina", "modeloPagina",
    "publicado", "idAvatar", "idBanner",
    "publicacaoAgendadaEm", "despublicacaoAgendadaEm", "aEliminar",
    // `emblemas` é DELIBERADAMENTE omitido: o campo é editável pelo utilizador
    // e uma badge não pode ser auto-atribuída. A escrita passa pela rota
    // server-side POST /api/badges, que usa a API key e valida o plano e a
    // candidatura ao staff. Não re-adicionar.
  ]),
  links: new Set([
    "idPagina", "tipo", "titulo", "url", "descricao",
    "icone", "cor", "idImagem", "animacao",
    "ativo", "visivel", "novaAba", "ordem", "agendadoPara",
    "cliques", // obrigatório no schema; inicializado a 0 pelo servidor
  ]),
  // Tem de espelhar o schema de `themes` em scripts/provision-appwrite.ts
  // (e THEME_SAFE_FIELDS em services.ts). O payload real da aplicação é
  // `defaultAppearance()` — é isso que o teste de regressão verifica.
  themes: new Set([
    "idPagina", "tema",
    "desfoco", "arredondado", "opacidadeLinks",
    "corFundo", "corCartao", "corTexto", "corDestaque",
    "familiaFonte", "tamanhoFonte", "raioBotao",
    "larguraBotao", "alturaBotao", "estiloBotao", "sombra",
    "mostrarAvatar", "mostrarBiografia", "mostrarSocial", "espacamento",
    "opacidadeVidro", "desfocoVidro", "intensidadeVidro",
  ]),
  analytics: new Set(["idPagina", "visualizacoes", "cliques", "seguidores", "metricasJson"]),
  // Tem de espelhar o schema de `qr_codes` em scripts/provision-appwrite.ts.
  qr_codes: new Set(["idPagina", "corPrimeiroPlano", "corFundo", "idLogo", "tamanho"]),
};

/**
 * Filtra os campos do body para incluir apenas os permitidos.
 * Devolve true se o body foi modificado (precisa re-serializar).
 *
 * Coleções sem entrada no allowlist ficam intactas: são as que o servidor
 * escreve (ex: `activity_logs`, `visits`), já protegidas pela validação de
 * propriedade do proxy.
 */
export function filterDocumentBody(
  jsonBody: Record<string, unknown> | null,
  collectionId: string,
  method: string
): boolean {
  if (!jsonBody) return false;
  const allowed = ALLOWED_FIELDS[collectionId];
  if (!allowed) return false;

  const data = jsonBody.data as Record<string, unknown> | undefined;
  if (!data || typeof data !== "object") return false;

  let modified = false;
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (allowed.has(key)) {
      filtered[key] = value;
    } else {
      modified = true; // campo removido → body precisa re-serializar
    }
  }
  // Campos obrigatórios não devem ser removidos pelo filtro
  if (collectionId === "pages" && method === "POST") {
    for (const required of ["nomeUtilizador", "nomeExibicao"]) {
      if (!(required in filtered)) {
        filtered[required] = data[required] ?? "";
      }
    }
  }
  jsonBody.data = filtered;
  return modified;
}
