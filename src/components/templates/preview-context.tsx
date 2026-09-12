"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Marca uma subárvore como PREVISUALIZAÇÃO.
 *
 * PORQUE EXISTE: o `/demo` passou a renderizar os templates REAIS (o mesmo
 * código que serve a página pública), para o utilizador ver o resultado
 * verdadeiro em vez de um mock. Mas esses templates incluem o `TrackedLink`,
 * que faz `POST /api/click` — e o `/api/click` só verifica que a página está
 * publicada. Sem esta marca, um dono a pré-visualizar a sua própria página
 * somaria cliques falsos às próprias métricas, e o incremento em
 * `links.cliques` é irreversível.
 *
 * O valor por omissão é `false`: a página pública `/u/[nomeUtilizador]` não
 * tem Provider e continua a registar cliques normalmente — o comportamento
 * público não depende de ninguém se lembrar de o ativar.
 */
const PreviewModeContext = createContext(false);

export function PreviewModeProvider({ children }: { children: ReactNode }) {
  return <PreviewModeContext.Provider value={true}>{children}</PreviewModeContext.Provider>;
}

/** True quando o componente está dentro de uma pré-visualização (ex: `/demo`). */
export function useIsPreview(): boolean {
  return useContext(PreviewModeContext);
}
