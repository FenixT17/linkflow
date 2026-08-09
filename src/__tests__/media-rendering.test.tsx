import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { getFilePreviewUrl } from "@/lib/services";
import { TemplateAvatar } from "@/components/templates/shared";
import { TemplateThree } from "@/components/templates/template-three";
import { defaultAppearance } from "@/lib/defaults";
import type { LinkItem, PageProfile } from "@/lib/types";

vi.mock("next/image", () => ({
  default: ({ fill: _fill, priority: _priority, unoptimized, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean; unoptimized?: boolean }) => (
    <img data-unoptimized={unoptimized ? "true" : "false"} {...props} />
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

describe("media rendering", () => {
  it("maps an Appwrite file ID to the same-origin media proxy", () => {
    expect(getFilePreviewUrl("files", "avatar_abc-123.webp")).toBe("/api/media/avatar_abc-123.webp");
  });

  it("renders avatar and banner as direct unoptimized proxy images", () => {
    const profile: PageProfile & { $id: string } = {
      $id: "page-1",
      username: "maria",
      displayName: "Maria Silva",
      bio: "Criadora",
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

    const { container } = render(
      <>
        <TemplateAvatar src={profile.avatar} name={profile.displayName} />
        <TemplateThree
          profile={profile}
          links={[link]}
          appearance={defaultAppearance()}
          publicUrl="https://linkflow.example/u/maria"
        />
      </>,
    );

    const mediaImages = Array.from(container.querySelectorAll("img")).filter((image) =>
      image.getAttribute("src")?.startsWith("/api/media/")
    );
    expect(mediaImages.length).toBeGreaterThanOrEqual(3);
    expect(mediaImages.every((image) => image.getAttribute("data-unoptimized") === "true")).toBe(true);
  });
});
