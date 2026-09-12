/**
 * Parâmetros que o PRÓPRIO Appwrite anexa aos URLs de retorno.
 *
 * `userId` e `secret` são nomes do protocolo do Appwrite — vêm documentados no
 * JSDoc de `createVerification`, `createRecovery` e `createOAuth2Session` no
 * SDK instalado (`node_modules/appwrite/types/services/account.d.ts`):
 *
 *   "Both the **userId** and **secret** arguments will be passed as query
 *    parameters to the URL you have provided"
 *
 * NÃO são campos do nosso schema e não podem ser traduzidos. Este módulo é o
 * único sítio onde estes nomes vivem, para um rename de schema não voltar a
 * partir os links de email.
 */
export const APPWRITE_USER_ID_PARAM = "userId";
export const APPWRITE_SECRET_PARAM = "secret";

/**
 * Nome usado por engano entre o commit `ac52ea9` (rename do schema para
 * português) e esta correcção: o rename traduziu o parâmetro do Appwrite, e os
 * emails enviados nesse período apontam para `?idUtilizador=`. Continua a ser
 * aceite como alternativa, para não deixar perdidos os links de verificação
 * ainda válidos (7 dias) que estão nas caixas de entrada.
 */
export const LEGACY_USER_ID_PARAM = "idUtilizador";

export interface AppwriteTokenParams {
  /** Id do utilizador Appwrite; string vazia se o link não o trouxer. */
  idUtilizador: string;
  /** Secret do token; string vazia se o link não o trouxer. */
  secret: string;
}

/**
 * Lê `userId`+`secret` de uma query string (com o fallback `idUtilizador`).
 *
 * Aceita qualquer objecto com `get` — tanto o `ReadonlyURLSearchParams` do
 * `useSearchParams()` como o `URLSearchParams` de um `NextRequest`.
 */
export function readAppwriteTokenParams(params: {
  get(name: string): string | null;
}): AppwriteTokenParams {
  return {
    idUtilizador:
      params.get(APPWRITE_USER_ID_PARAM) ?? params.get(LEGACY_USER_ID_PARAM) ?? "",
    secret: params.get(APPWRITE_SECRET_PARAM) ?? "",
  };
}
