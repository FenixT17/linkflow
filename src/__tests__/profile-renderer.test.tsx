/// <reference types="vitest/globals" />
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PublicProfileRenderer } from "@/components/public/profile-renderer";
import { defaultAppearance } from "@/lib/defaults";
import type { PageProfile, LinkItem } from "@/lib/types";

vi.mock("@/context/ToastContext", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children?: React.ReactNode; href?: string }) => (
    <a href={props.href}>{children}</a>
  ),
}));

vi.mock("@/components/ui/logo", () => ({
  Logo: () => <span data-testid="logo" />,
}));

vi.mock("@/components/ui/platform-icon", () => ({
  PlatformIcon: () => <span data-testid="platform-icon" />,
}));

const profile: PageProfile = {
  nomeUtilizador: "joao",
  nomeExibicao: "João Silva",
  biografia: "Olá, bem-vindo!",
  publicado: true,
  tipoPagina: "minimal",
};

const appearance = defaultAppearance();

function makeLink(url: string): LinkItem {
  return {
    id: "l1",
    tipo: "link",
    titulo: "Meu link",
    url,
    ativo: true,
    visivel: true,
    novaAba: true,
    ordem: 0,
    cliques: 0,
  };
}

describe("PublicProfileRenderer — defesa contra XSS via link.url (H1)", () => {
  it("não renderiza href=javascript: quando link.url é malicioso", () => {
    const { container } = render(
      <PublicProfileRenderer
        profile={profile}
        links={[makeLink("javascript:alert(1)")]}
        appearance={appearance}
        onRecordClick={() => {}}
      />
    );
    const anchor = container.querySelector("a[href]");
    const href = anchor?.getAttribute("href") ?? "";
    expect(href).not.toContain("javascript:");
    expect(container.innerHTML).not.toContain("javascript:alert(1)");
  });

  it("renderiza um link https normal com o URL intacto", () => {
    const { container } = render(
      <PublicProfileRenderer
        profile={profile}
        links={[makeLink("https://example.com")]}
        appearance={appearance}
        onRecordClick={() => {}}
      />
    );
    expect(container.querySelector('a[href="https://example.com"]')).not.toBeNull();
  });

  it("renderiza o nome e a bio do perfil", () => {
    render(
      <PublicProfileRenderer
        profile={profile}
        links={[makeLink("https://example.com")]}
        appearance={appearance}
        onRecordClick={() => {}}
      />
    );
    expect(screen.getByText("João Silva")).toBeInTheDocument();
    expect(screen.getByText("Olá, bem-vindo!")).toBeInTheDocument();
  });
});
