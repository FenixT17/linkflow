/// <reference types="vitest/globals" />
/* eslint-disable @next/next/no-img-element */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import DemoPage from "@/app/demo/page";
import { TrackedLink } from "@/components/templates/tracked-link";
import { defaultAppearance } from "@/lib/defaults";
import type { Appearance, LinkItem, PageProfile } from "@/lib/types";

/**
 * Testes do `/demo`.
 *
 * O que estava errado: o demo usava o `PreviewPhone`, um mock que ignorava o
 * template escolhido (mostrava sempre o mesmo estilo) e desenhava o avatar
 * como um círculo vazio sem imagem. Estes testes fixam o comportamento novo —
 * o `PageTemplate` REAL e os dados reais do dono — e, sobretudo, que os
 * cliques dados dentro da pré-visualização NÃO entram nas estatísticas.
 */

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => mockUseAuth() }));

vi.mock("next/image", () => ({
  default: ({
    fill: _fill,
    priority: _priority,
    unoptimized: _unoptimized,
    alt = "",
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    priority?: boolean;
    unoptimized?: boolean;
  }) => <img alt={alt} {...props} />,
}));

vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
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

const OWNER_PAGE: PageProfile = {
  nomeUtilizador: "maria",
  nomeExibicao: "Maria Silva",
  biografia: "Criadora e fotógrafa.",
  avatar: "/api/media/avatar-1",
  publicado: true,
  modeloPagina: "template2",
};

const OWNER_LINK: LinkItem = {
  id: "link-1",
  tipo: "social",
  titulo: "Instagram da Maria",
  url: "https://instagram.com/maria",
  icone: "instagram",
  ativo: true,
  visivel: true,
  novaAba: true,
  ordem: 0,
  cliques: 0,
};

function authState(
  overrides: Partial<{
    page: PageProfile | null;
    idPagina: string | null;
    links: LinkItem[];
    appearance: Appearance;
    isLoading: boolean;
  }> = {},
) {
  return {
    page: null,
    idPagina: null,
    links: [] as LinkItem[],
    appearance: defaultAppearance(),
    isLoading: false,
    ...overrides,
  };
}

/**
 * Identifica o template efetivamente renderizado pelo fundo do seu elemento
 * raiz — lê o estilo aplicado, não uma classe de layout, para o teste falhar
 * se o template errado for montado.
 */
function activeTemplate(container: HTMLElement): "template1" | "template2" | "template3" | null {
  if (container.querySelector('[class*="100dvh-7rem"]')) return "template3";
  const backgrounds = Array.from(container.querySelectorAll<HTMLElement>("[style]")).map(
    (element) => element.style.backgroundColor,
  );
  if (backgrounds.includes("rgb(12, 13, 18)")) return "template2";
  if (backgrounds.includes("rgb(18, 18, 20)")) return "template1";
  return null;
}

/** Impede a navegação do jsdom sem interferir com o onClick do React. */
function clickWithoutNavigating(anchor: Element) {
  anchor.addEventListener("click", (event) => event.preventDefault());
  fireEvent.click(anchor);
}

beforeEach(() => {
  vi.unstubAllGlobals();
  mockUseAuth.mockReset();
});

describe("/demo — página real em vez do telefone mock", () => {
  it("o dono vê os seus dados, o seu avatar e o template que escolheu", () => {
    mockUseAuth.mockReturnValue(
      authState({ page: OWNER_PAGE, idPagina: "page-1", links: [OWNER_LINK] }),
    );

    const { container } = render(<DemoPage />);

    expect(screen.getByText("Maria Silva")).toBeInTheDocument();
    expect(screen.getByText("@maria")).toBeInTheDocument();
    expect(screen.getByText("Criadora e fotógrafa.")).toBeInTheDocument();
    expect(screen.getByText("Instagram da Maria")).toBeInTheDocument();

    // O avatar do PreviewPhone era um <div> vazio: não havia <img> nenhuma.
    expect(container.querySelector('img[src="/api/media/avatar-1"]')).not.toBeNull();

    // modeloPagina="template2" → renderiza o template2, não o default.
    expect(activeTemplate(container)).toBe("template2");

    // Nada da página de exemplo.
    expect(screen.queryByText("Ana Exemplo")).toBeNull();
  });

  it("um visitante sem conta vê a página de exemplo preenchida", () => {
    mockUseAuth.mockReturnValue(authState());

    const { container } = render(<DemoPage />);

    expect(screen.getByText("Ana Exemplo")).toBeInTheDocument();
    expect(screen.getByText("@exemplo")).toBeInTheDocument();
    expect(container.querySelector('a[href="https://instagram.com/"]')).not.toBeNull();
    expect(activeTemplate(container)).toBe("template1");
  });

  it("só mostra os links ativos e visíveis do dono (os mesmos da página pública)", () => {
    mockUseAuth.mockReturnValue(
      authState({
        page: OWNER_PAGE,
        idPagina: "page-1",
        links: [
          OWNER_LINK,
          { ...OWNER_LINK, id: "link-2", titulo: "Link invisível", visivel: false },
          { ...OWNER_LINK, id: "link-3", titulo: "Link inativo", ativo: false },
        ],
      }),
    );

    render(<DemoPage />);

    expect(screen.getByText("Instagram da Maria")).toBeInTheDocument();
    expect(screen.queryByText("Link invisível")).toBeNull();
    expect(screen.queryByText("Link inativo")).toBeNull();
  });

  it("o seletor troca o layout renderizado sem gravar nada", () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    mockUseAuth.mockReturnValue(authState());

    const { container } = render(<DemoPage />);
    expect(activeTemplate(container)).toBe("template1");

    fireEvent.click(screen.getByRole("button", { name: "Página 3" }));
    expect(activeTemplate(container)).toBe("template3");

    fireEvent.click(screen.getByRole("button", { name: "Página 2" }));
    expect(activeTemplate(container)).toBe("template2");

    fireEvent.click(screen.getByRole("button", { name: "Página 1" }));
    expect(activeTemplate(container)).toBe("template1");

    // Trocar de layout no demo é estado local — não persiste nem grava.
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("/demo — a pré-visualização não conta cliques", () => {
  it("clicar num link dentro do /demo NÃO chama /api/click", () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    mockUseAuth.mockReturnValue(
      authState({ page: OWNER_PAGE, idPagina: "page-1", links: [OWNER_LINK] }),
    );

    const { container } = render(<DemoPage />);
    const anchor = container.querySelector('a[href="https://instagram.com/maria"]');
    expect(anchor).not.toBeNull();

    clickWithoutNavigating(anchor!);

    // Sem isto o dono somava auto-cliques às próprias métricas, e o
    // incremento em `links.cliques` é irreversível.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("o MESMO link no caminho público continua a registar o clique", () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(
      <TrackedLink link={OWNER_LINK} idPagina="page-1">
        {OWNER_LINK.titulo}
      </TrackedLink>,
    );

    clickWithoutNavigating(container.querySelector("a")!);

    // Garante que o teste anterior falha por causa do Provider e não porque
    // o tracking nunca funcionou.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/click");
  });
});
