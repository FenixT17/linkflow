/// <reference types="vitest/globals" />
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TemplateThree } from "@/components/templates/template-three";
import { defaultAppearance } from "@/lib/defaults";
import type { LinkItem, PageProfile } from "@/lib/types";

vi.mock("next/image", () => ({
  default: ({ fill: _fill, priority: _priority, alt = "", ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => (
    <img alt={alt} {...props} />
  ),
}));

vi.mock("@/components/public/share-actions", () => ({
  ShareActions: () => <button aria-label="Partilhar" type="button" />,
}));

vi.mock("@/components/ui/logo", () => ({
  Logo: () => <span data-testid="logo" />,
}));

vi.mock("@/components/ui/platform-icon", () => ({
  PlatformIcon: () => <span data-testid="platform-icon" />,
}));

const profile: PageProfile & { $id: string } = {
  $id: "page-1",
  username: "maria",
  displayName: "Maria Silva",
  bio: "Criadora e fotógrafa.",
  avatar: "/api/media/avatar-1",
  banner: "/api/media/banner-1",
  published: true,
};

const link: LinkItem = {
  id: "link-1",
  type: "social",
  title: "Instagram",
  url: "https://instagram.com/maria",
  icon: "instagram",
  active: true,
  visible: true,
  newTab: true,
  order: 0,
  clicks: 0,
};

describe("TemplateThree — Página 3 Liquid Glass", () => {
  it("renderiza banner, dados reais e link rastreável com ícone", () => {
    const { container } = render(
      <TemplateThree
        profile={profile}
        links={[link]}
        appearance={defaultAppearance()}
        publicUrl="https://linkflow.example/u/maria"
      />
    );

    expect(screen.getByText("Maria Silva")).toBeInTheDocument();
    expect(screen.getByText("@maria")).toBeInTheDocument();
    expect(screen.getByText("Criadora e fotógrafa.")).toBeInTheDocument();
    expect(screen.getByText("Instagram")).toBeInTheDocument();
    expect(screen.getByTestId("platform-icon")).toBeInTheDocument();
    expect(container.querySelector('img[src="/api/media/banner-1"]')).not.toBeNull();
    expect(container.querySelector('a[href="https://instagram.com/maria"]')).not.toBeNull();

    const layout = container.querySelector(".max-w-md");
    expect(layout).not.toBeNull();
    expect(container.querySelector(".min-h-\\[calc\\(100dvh-7rem\\)\\]")).not.toBeNull();
  });
});
