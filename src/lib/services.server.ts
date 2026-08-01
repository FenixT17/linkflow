import { cache } from "react";
import { Query } from "node-appwrite";
import { createServerClient, databaseId, filesBucketId } from "./appwrite.server";
import {
  Appearance,
  LinkItem,
  PageProfile,
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

function getFileUrl(fileId: string) {
  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://cloud.appwrite.io/v1";
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "";
  return `${endpoint}/storage/buckets/${filesBucketId}/files/${fileId}/view?project=${projectId}`;
}
