import type { ReactNode } from "react";
import type { PageTemplateId } from "@/lib/types";
import type { TemplateProps } from "./types";
import { TemplateOne } from "./template-one";
import { TemplateTwo } from "./template-two";
import { TemplateThree } from "./template-three";

const TEMPLATES: Record<PageTemplateId, (props: TemplateProps) => ReactNode> = {
  template1: TemplateOne,
  template2: TemplateTwo,
  template3: TemplateThree,
};

/**
 * Renderizador de página pública — escolhe o template pelo modeloPagina.
 *
 * Para adicionar um novo template no futuro: criar o componente em
 * components/templates/ (ex: template-three.tsx), adicionar o id a
 * PageTemplateId em lib/types.ts, registá-lo em lib/page-templates.ts e
 * mapeá-lo aqui. Nada mais precisa de mudar.
 */
export function PageTemplate({
  modeloPagina = "template1",
  ...props
}: TemplateProps & { modeloPagina?: PageTemplateId }) {
  const Template = TEMPLATES[modeloPagina] ?? TemplateOne;
  return <Template {...props} />;
}
