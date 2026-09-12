"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { PageTemplate } from "@/components/templates";
import { PreviewModeProvider } from "@/components/templates/preview-context";
import { GlassButton } from "@/components/ui/glass-button";
import { useAuth } from "@/context/AuthContext";
import { DEFAULT_PAGE_TEMPLATE, PAGE_TEMPLATES, isPageTemplate } from "@/lib/page-templates";
import { siteUrl } from "@/lib/seo";
import type { LinkItem, PageProfile, PageTemplateId } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Página de exemplo, mostrada a quem ainda não tem conta (ou ainda não criou
 * a página). Sem isto o `/demo` aparecia vazio — não demonstra o produto.
 */
const DEMO_PROFILE: PageProfile & { $id: string } = {
  $id: "demo",
  nomeUtilizador: "exemplo",
  nomeExibicao: "Ana Exemplo",
  biografia: "Criadora de conteúdo, designer e fotógrafa. Todos os meus links num só lugar.",
  publicado: true,
  emblemas: ["verified", "pro"],
};

const DEMO_LINKS: LinkItem[] = [
  {
    id: "demo-1",
    tipo: "social",
    titulo: "Instagram",
    url: "https://instagram.com/",
    icone: "instagram",
    ativo: true,
    visivel: true,
    novaAba: true,
    ordem: 0,
    cliques: 0,
  },
  {
    id: "demo-2",
    tipo: "youtube",
    titulo: "Último vídeo no YouTube",
    url: "https://youtube.com/",
    icone: "youtube",
    ativo: true,
    visivel: true,
    novaAba: true,
    ordem: 1,
    cliques: 0,
  },
  {
    id: "demo-3",
    tipo: "link",
    titulo: "Portfólio",
    url: "https://example.com/",
    icone: "link",
    ativo: true,
    visivel: true,
    novaAba: true,
    ordem: 2,
    cliques: 0,
  },
];

/**
 * Demonstração pública — renderiza o `PageTemplate` REAL.
 *
 * MOTIVO: antes usava um `PreviewPhone`, um mock que ignorava o template
 * escolhido (mostrava sempre o estilo Liquid Glass) e desenhava o avatar como
 * um círculo vazio sem imagem. O resultado era uma página que não correspondia
 * nem ao layout nem à foto do utilizador.
 *
 * Agora o demo é exatamente o mesmo código que serve `/u/[nomeUtilizador]`:
 * - o dono vê a sua página real (avatar, nome, bio, links e aparência);
 * - quem não tem página vê uma página de exemplo preenchida;
 * - o layout pode ser trocado localmente, sem gravar nada.
 *
 * O `PreviewModeProvider` impede que os cliques desta página entrem nas
 * estatísticas do dono. O `ViewTracker` (que existe na página pública) não é
 * incluído de propósito, pela mesma razão.
 */
export default function DemoPage() {
  const { page, idPagina, links, appearance, isLoading } = useAuth();
  const [templateOverride, setTemplateOverride] = useState<PageTemplateId | null>(null);

  const hasOwnPage = Boolean(page && idPagina);
  const ownPageTemplate: PageTemplateId =
    page && isPageTemplate(page.modeloPagina) ? page.modeloPagina : DEFAULT_PAGE_TEMPLATE;
  // `templateOverride` é estado local: trocar de layout no demo nunca escreve
  // em `pages.modeloPagina` (não há chamada ao servidor a partir daqui).
  const modeloPagina = templateOverride ?? ownPageTemplate;

  const profile: PageProfile & { $id: string } = hasOwnPage
    ? { ...(page as PageProfile), $id: idPagina as string, modeloPagina }
    : { ...DEMO_PROFILE, modeloPagina };

  const visibleLinks = hasOwnPage
    ? links.filter((link) => link.visivel && link.ativo)
    : DEMO_LINKS;

  const publicUrl = `${siteUrl}/u/${profile.nomeUtilizador}`;

  return (
    <PreviewModeProvider>
      <main className="relative min-h-dvh overflow-hidden bg-[var(--background)]">
        {/* Mesmos orbes de fundo da página pública — o que aparece nas
            margens laterais em ecrãs largos tem de ser idêntico. */}
        <div className="gradient-orb" aria-hidden="true">
          <div className="gradient-orb-1" />
          <div className="gradient-orb-2" />
          <div className="gradient-orb-3" />
          <div className="gradient-orb-radial" />
        </div>

        {/* Aviso + controlos. Em fluxo normal (não `fixed`) para nunca
            sobrepor o conteúdo do template, que é a página real. */}
        <div className="relative z-10 border-b border-white/[0.08] bg-white/[0.03] backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="flex items-start gap-2.5">
              <Eye
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted-foreground)]"
                aria-hidden="true"
              />
              <p className="text-xs leading-relaxed text-[var(--muted-foreground)] sm:text-sm">
                <span className="font-medium text-[var(--foreground)]">Pré-visualização.</span>{" "}
                {isLoading
                  ? "A carregar a sua página…"
                  : hasOwnPage
                    ? "Esta é a sua página, com os seus dados reais."
                    : "Exemplo do resultado final — os seus dados aparecem aqui depois de criar a página."}{" "}
                Troque de layout à vontade: nada é gravado e os cliques não contam para as
                estatísticas.
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div role="group" aria-label="Layout da página" className="flex items-center gap-1.5">
                {PAGE_TEMPLATES.map((meta) => {
                  const active = meta.id === modeloPagina;
                  return (
                    <button
                      key={meta.id}
                      type="button"
                      onClick={() => setTemplateOverride(meta.id)}
                      aria-pressed={active}
                      title={meta.description}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-[11px] font-medium ring-1 transition-colors",
                        active
                          ? "bg-white/[0.12] text-[var(--foreground)] ring-white/[0.18]"
                          : "text-[var(--muted-foreground)] ring-white/[0.08] hover:bg-white/[0.06] hover:text-[var(--foreground)]",
                      )}
                    >
                      {meta.name}
                    </button>
                  );
                })}
              </div>
              <GlassButton
                href={hasOwnPage ? "/dashboard" : "/register"}
                variant="primary"
                size="sm"
              >
                {hasOwnPage ? "Dashboard" : "Criar a sua"}
              </GlassButton>
            </div>
          </div>
        </div>

        <PageTemplate
          modeloPagina={modeloPagina}
          profile={profile}
          links={visibleLinks}
          appearance={appearance}
          publicUrl={publicUrl}
        />

        <div className="px-4 pb-8 text-center">
          <GlassButton href="/" variant="ghost" size="sm">
            Voltar ao início
          </GlassButton>
        </div>
      </main>
    </PreviewModeProvider>
  );
}
