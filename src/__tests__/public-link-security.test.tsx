/// <reference types="vitest/globals" />
/* eslint-disable @next/next/no-img-element */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageTemplate } from "@/components/templates";
import { TrackedLink } from "@/components/templates/tracked-link";
import { defaultAppearance } from "@/lib/defaults";
import type { LinkItem, PageProfile, PageTemplateId } from "@/lib/types";

/**
 * Testes do caminho de render público REAL.
 *
 * Antes estavam dirigidos ao `PublicProfileRenderer`, um componente que só
 * existia para os testes (a aplicação usa `components/templates/`), pelo que
 * davam uma falsa sensação de cobertura sobre código que nunca era servido.
 *
 * Os três templates desaguam todos no mesmo `TrackedLink` (template1/2 via
 * `TemplateLinkPill`, template3 directamente), por isso testar esse sink cobre
 * o comportamento de todos eles. Cada template é ainda renderizado de facto,
 * para apanhar um template que volte a usar um `<a href>` próprio sem sanitizar.
 */

vi.mock("next/image", () => ({
  default: ({ fill: _fill, priority: _priority, unoptimized: _unoptimized, alt = "", ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean; unoptimized?: boolean }) => (
    <img alt={alt} {...props} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));

vi.mock("@/components/public/share-actions", () => ({
  ShareActions: () => <button type="button" aria-label="Partilhar" />,
}));

vi.mock("@/components/ui/logo", () => ({
  Logo: () => <span data-testid="logo" />,
}));

vi.mock("@/components/ui/platform-icon", () => ({
  PlatformIcon: () => <span data-testid="platform-icon" />,
}));

const TEMPLATES: PageTemplateId[] = ["template1", "template2", "template3"];

const profile: PageProfile & { $id: string } = {
  $id: "page-1",
  nomeUtilizador: "joao",
  nomeExibicao: "João Silva",
  biografia: "Olá, bem-vindo!",
  avatar: "/api/media/avatar-1",
  publicado: true,
  modeloPagina: "template1",
};

function makeLink(url: string, overrides: Partial<LinkItem> = {}): LinkItem {
  return {
    id: "link-1",
    tipo: "link",
    titulo: "Meu link",
    url,
    ativo: true,
    visivel: true,
    novaAba: true,
    ordem: 0,
    cliques: 0,
    ...overrides,
  };
}

function renderTemplate(modeloPagina: PageTemplateId, links: LinkItem[]) {
  return render(
    <PageTemplate
      modeloPagina={modeloPagina}
      profile={profile}
      links={links}
      appearance={defaultAppearance()}
      publicUrl="https://linkflow.example/u/joao"
    />,
  );
}

/** Esquemas que um link público nunca pode emitir no HTML. */
const DANGEROUS_URLS = [
  "javascript:alert(1)",
  "JavaScript:alert(1)",
  "  javascript:alert(1)",
  "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
  "vbscript:msgbox(1)",
  "file:///etc/passwd",
  "blob:https://evil.example/abc",
];

describe("render público real — sanitização de link.url (H1)", () => {
  it("TrackedLink nunca emite um href perigoso", () => {
    for (const url of DANGEROUS_URLS) {
      const { container, unmount } = render(
        <TrackedLink link={makeLink(url)} idPagina="page-1">
          {makeLink(url).titulo}
        </TrackedLink>,
      );

      const href = container.querySelector("a")?.getAttribute("href") ?? "";
      expect(href, `url=${url}`).toBe("");
      expect(container.innerHTML.toLowerCase()).not.toContain("javascript:");
      expect(container.innerHTML.toLowerCase()).not.toContain("vbscript:");
      unmount();
    }
  });

  it("nenhum dos três templates emite um href ou um URL perigoso", () => {
    const links = DANGEROUS_URLS.map((url, index) =>
      makeLink(url, { id: `link-${index}`, titulo: `Link ${index}` }),
    );

    for (const modeloPagina of TEMPLATES) {
      const { container, unmount } = renderTemplate(modeloPagina, links);

      for (const anchor of Array.from(container.querySelectorAll("a[href]"))) {
        const href = anchor.getAttribute("href") ?? "";
        expect(href, `${modeloPagina}: href=${href}`).not.toMatch(/^(javascript|vbscript|data|file|blob):/i);
      }
      const html = container.innerHTML.toLowerCase();
      expect(html, modeloPagina).not.toContain("javascript:");
      expect(html, modeloPagina).not.toContain("vbscript:");
      expect(html, modeloPagina).not.toContain("base64,phnjcmlwdd5");
      unmount();
    }
  });
});

describe("render público real — links legítimos", () => {
  it("preserva URLs https e mailto intactos", () => {
    const links = [
      makeLink("https://example.com", { id: "l1", titulo: "Site" }),
      makeLink("mailto:joao@example.com", { id: "l2", titulo: "Email" }),
    ];

    for (const modeloPagina of TEMPLATES) {
      const { container, unmount } = renderTemplate(modeloPagina, links);
      expect(container.querySelector('a[href="https://example.com"]'), modeloPagina).not.toBeNull();
      expect(container.querySelector('a[href="mailto:joao@example.com"]'), modeloPagina).not.toBeNull();
      unmount();
    }
  });

  it("abre em nova aba com rel=noopener noreferrer (anti-tabnabbing)", () => {
    const { container } = renderTemplate("template1", [makeLink("https://example.com")]);
    const anchor = container.querySelector('a[href="https://example.com"]');

    expect(anchor).not.toBeNull();
    expect(anchor?.getAttribute("target")).toBe("_blank");
    expect(anchor?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("não abre em nova aba quando novaAba é false", () => {
    const { container } = renderTemplate("template1", [
      makeLink("https://example.com", { novaAba: false }),
    ]);
    const anchor = container.querySelector('a[href="https://example.com"]');

    expect(anchor?.getAttribute("target")).toBeNull();
  });
});

describe("render público real — conteúdo do perfil", () => {
  it("mostra o nome, o username e a biografia em todos os templates", () => {
    for (const modeloPagina of TEMPLATES) {
      const { unmount } = renderTemplate(modeloPagina, [makeLink("https://example.com")]);
      expect(screen.getByText("João Silva"), modeloPagina).toBeInTheDocument();
      expect(screen.getByText("@joao"), modeloPagina).toBeInTheDocument();
      expect(screen.getByText("Olá, bem-vindo!"), modeloPagina).toBeInTheDocument();
      // sem isto, os templates acumulavam no DOM e getByText falhava por
      // encontrar múltiplos elementos iguais nas iterações seguintes.
      unmount();
    }
  });
});
