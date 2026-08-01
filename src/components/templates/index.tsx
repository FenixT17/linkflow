import type { ReactNode } from "react";
import type { PageType } from "@/lib/types";
import type { TemplateProps } from "./types";
import { MinimalTemplate } from "./minimal";
import { CreatorTemplate } from "./creator";
import { BusinessTemplate } from "./business";
import { StoreTemplate } from "./store";
import { PortfolioTemplate } from "./portfolio";
import { PhotographerTemplate } from "./photographer";
import { MusicTemplate } from "./music";
import { RestaurantTemplate } from "./restaurant";
import { EventTemplate } from "./event";
import { ResumeTemplate } from "./resume";
import { GamerTemplate } from "./gamer";
import { DeveloperTemplate } from "./developer";

const TEMPLATES: Record<PageType, (props: TemplateProps) => ReactNode> = {
  minimal: MinimalTemplate,
  creator: CreatorTemplate,
  business: BusinessTemplate,
  store: StoreTemplate,
  portfolio: PortfolioTemplate,
  photographer: PhotographerTemplate,
  music: MusicTemplate,
  restaurant: RestaurantTemplate,
  event: EventTemplate,
  resume: ResumeTemplate,
  gamer: GamerTemplate,
  developer: DeveloperTemplate,
};

/**
 * Renderizador de página pública — escolhe o template pelo pageType.
 * Para adicionar um novo tipo de página no futuro: criar o componente
 * em components/templates/, registá-lo em lib/page-templates.ts e
 * mapeá-lo aqui. Nada mais precisa de mudar.
 */
export function PageTemplate({
  pageType = "minimal",
  ...props
}: TemplateProps & { pageType?: PageType }) {
  const Template = TEMPLATES[pageType] ?? MinimalTemplate;
  return <Template {...props} />;
}
