import { cache } from "react";
import { Query } from "node-appwrite";
import { createServerClient, databaseId } from "./appwrite.server";
import { siteUrl } from "./seo";
import {
  Appearance,
  LinkItem,
  PageProfile,
  PageType,
  PageTemplateId,
  AnalyticsData,
} from "./types";

import { defaultAppearance, emptyAnalytics } from "./defaults";

const Collections = {
  pages: "pages",
  links: "links",
  themes: "themes",
  analytics: "analytics",
} as const;

export const getPublicPageByUsername = cache(
  async function getPublicPageByUsername(username: string): Promise<PageProfile & { $id: string }> {
    const { databases } = createServerClient();
    const docs = await databases.listDocuments(databaseId, Collections.pages, [
      Query.equal("username", username.toLowerCase()),
      Query.equal("published", true),
    ]);
    if (docs.documents.length === 0) {
      throw new Error("Page not found");
    }
    const doc = docs.documents[0] as unknown as Record<string, unknown> & { $id: string };
    return {
      $id: doc.$id,
      username: String(doc.username),
      displayName: String(doc.displayName),
      bio: String(doc.bio ?? ""),
      avatar: doc.avatarId ? getFileUrl(String(doc.avatarId)) : undefined,
      banner: doc.bannerId ? getFileUrl(String(doc.bannerId)) : undefined,
      published: Boolean(doc.published),
      pageType: (doc.pageType as PageType) ?? "minimal",
      pageTemplate: (doc.pageTemplate as PageTemplateId) ?? "template1",
      // `pages.badges` is user-editable, so staff is never trusted from it.
      // The staff badge is derived only from a server-side approved application.
      badges: await getPublicBadges(String(doc.userId), doc.badges),
    } as PageProfile & { $id: string };
  }
);

export async function getPublicPublishedUsernames(limit = 1000): Promise<string[]> {
  const { databases } = createServerClient();
  const docs = await databases.listDocuments(databaseId, Collections.pages, [
    Query.equal("published", true),
    Query.limit(limit),
    Query.orderAsc("username"),
    Query.select(["username"]),
  ]);
  return docs.documents.map((doc) => String((doc as unknown as { username: string }).username));
}

export async function getPublicLinksByPageId(pageId: string): Promise<LinkItem[]> {
  const { databases } = createServerClient();
  const docs = await databases.listDocuments(databaseId, Collections.links, [
    Query.equal("pageId", pageId),
    Query.equal("visible", true),
    Query.equal("active", true),
    Query.orderAsc("order"),
  ]);
  return docs.documents.map((doc) => {
    const d = doc as unknown as Record<string, unknown> & { $id: string };
    return {
      id: d.$id,
      type: String(d.type) as LinkItem["type"],
      title: String(d.title),
      description: d.description ? String(d.description) : undefined,
      url: String(d.url),
      icon: d.icon ? String(d.icon) : undefined,
      color: d.color ? String(d.color) : undefined,
      image: d.imageId ? getFileUrl(String(d.imageId)) : undefined,
      animation: (d.animation as LinkItem["animation"]) ?? "none",
      active: true,
      visible: true,
      newTab: Boolean(d.newTab),
      order: Number(d.order),
      clicks: 0,
      scheduledFor: d.scheduledFor ? String(d.scheduledFor) : undefined,
    };
  });
}

export async function getPublicThemeByPageId(pageId: string): Promise<Appearance> {
  const { databases } = createServerClient();
  const docs = await databases.listDocuments(databaseId, Collections.themes, [
    Query.equal("pageId", pageId),
  ]);
  if (docs.documents.length === 0) {
    return defaultAppearance();
  }
  const doc = docs.documents[0] as unknown as Record<string, unknown>;
  return {
    blur: Number(doc.blur),
    rounded: Number(doc.rounded),
    linkOpacity: Number(doc.linkOpacity),
    backgroundColor: doc.backgroundColor ? String(doc.backgroundColor) : undefined,
    cardColor: doc.cardColor ? String(doc.cardColor) : undefined,
    textColor: doc.textColor ? String(doc.textColor) : undefined,
    accentColor: doc.accentColor ? String(doc.accentColor) : undefined,
    fontFamily: doc.fontFamily ? String(doc.fontFamily) : undefined,
    fontSize: Number(doc.fontSize),
    buttonRadius: Number(doc.buttonRadius),
    buttonWidth: String(doc.buttonWidth) as Appearance["buttonWidth"],
    buttonHeight: String(doc.buttonHeight) as Appearance["buttonHeight"],
    buttonStyle: String(doc.buttonStyle) as Appearance["buttonStyle"],
    shadow: String(doc.shadow) as Appearance["shadow"],
    showAvatar: Boolean(doc.showAvatar),
    showBio: Boolean(doc.showBio),
    showSocial: doc.showSocial !== undefined ? Boolean(doc.showSocial) : true,
    spacing: Number(doc.spacing),
  };
}

/**
 * @deprecated Analytics data is private and should not be exposed publicly.
 * This function now returns empty analytics regardless of the page.
 */
export async function getPublicAnalyticsByPageId(_pageId: string): Promise<AnalyticsData> {
  return emptyAnalytics();
}

async function getPublicBadges(userId: string, rawBadges: unknown): Promise<string[]> {
  const badges = Array.isArray(rawBadges)
    ? rawBadges.filter((badge): badge is string => typeof badge === "string" && badge !== "staff")
    : [];
  const { databases } = createServerClient();
  const approved = await databases.listDocuments(databaseId, "staff_applications", [
    Query.equal("userId", userId),
    Query.equal("status", "approved"),
    Query.limit(1),
  ]);
  const hasTrustedApproval = approved.documents.some((doc) => Boolean(String(doc.reviewedBy ?? "").trim()));
  return hasTrustedApproval ? [...badges, "staff"] : badges;
}

function getFileUrl(fileId: string) {
  // Keep public profile media same-origin so the Worker can validate and
  // rate-limit every image request before it reaches Appwrite Storage.
  return `${siteUrl}/api/media/${encodeURIComponent(fileId)}`;
}
