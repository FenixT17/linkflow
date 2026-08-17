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
} from "./types";

import { defaultAppearance } from "./defaults";
import { safeThemeColor, safeThemeFont } from "./theme-validation";
import { isLinkPublicAt, isPublicAt } from "./page-publication";

const Collections = {
  pages: "pages",
  links: "links",
  themes: "themes",
  analytics: "analytics",
} as const;

export const getPublicPageByUsername = cache(
  async function getPublicPageByUsername(nomeUtilizador: string): Promise<PageProfile & { $id: string }> {
    const { databases } = createServerClient();
    const docs = await databases.listDocuments(databaseId, Collections.pages, [
      Query.equal("nomeUtilizador", nomeUtilizador.toLowerCase()),
      Query.limit(5),
    ]);
    const doc = docs.documents
      .map((candidate) => candidate as unknown as Record<string, unknown> & { $id: string })
      .find((candidate) => isPublicAt(candidate));
    if (!doc) {
      throw new Error("Page not found");
    }
    return {
      $id: doc.$id,
      nomeUtilizador: String(doc.nomeUtilizador),
      nomeExibicao: String(doc.nomeExibicao),
      biografia: String(doc.biografia ?? ""),
      avatar: doc.idAvatar ? getFileUrl(String(doc.idAvatar)) : undefined,
      banner: doc.idBanner ? getFileUrl(String(doc.idBanner)) : undefined,
      publicado: Boolean(doc.publicado),
      tipoPagina: (doc.tipoPagina as PageType) ?? "minimal",
      modeloPagina: (doc.modeloPagina as PageTemplateId) ?? "template1",
      // `pages.emblemas` is user-editable, so staff is never trusted from it.
      // The staff badge is derived only from a server-side approved application.
      emblemas: await getPublicBadges(String(doc.idUtilizador), doc.emblemas),
    } as PageProfile & { $id: string };
  }
);

export async function getPublicPublishedUsernames(limit = 1000): Promise<string[]> {
  const { databases } = createServerClient();
  const docs = await databases.listDocuments(databaseId, Collections.pages, [
    Query.limit(limit),
    Query.orderAsc("nomeUtilizador"),
    Query.select(["nomeUtilizador", "publicado", "aEliminar", "publicacaoAgendadaEm", "despublicacaoAgendadaEm"]),
  ]);
  return docs.documents
    .filter((doc) => isPublicAt(doc as unknown as Record<string, unknown>))
    .map((doc) => String((doc as unknown as { nomeUtilizador: string }).nomeUtilizador));
}

export async function getPublicLinksByPageId(idPagina: string): Promise<LinkItem[]> {
  const { databases } = createServerClient();
  const docs = await databases.listDocuments(databaseId, Collections.links, [
    Query.equal("idPagina", idPagina),
    Query.equal("visivel", true),
    Query.equal("ativo", true),
    Query.orderAsc("ordem"),
  ]);
  const now = Date.now();
  return docs.documents.filter((doc) => {
    const d = doc as unknown as Record<string, unknown>;
    return isLinkPublicAt(d.agendadoPara, now);
  }).map((doc) => {
    const d = doc as unknown as Record<string, unknown> & { $id: string };
    return {
      id: d.$id,
      tipo: String(d.tipo) as LinkItem["tipo"],
      titulo: String(d.titulo),
      descricao: d.descricao ? String(d.descricao) : undefined,
      url: String(d.url),
      icone: d.icone ? String(d.icone) : undefined,
      cor: d.cor ? String(d.cor) : undefined,
      image: d.idImagem ? getFileUrl(String(d.idImagem)) : undefined,
      animacao: (d.animacao as LinkItem["animacao"]) ?? "none",
      ativo: true,
      visivel: true,
      novaAba: Boolean(d.novaAba),
      ordem: Number(d.ordem),
      cliques: 0,
      agendadoPara: d.agendadoPara ? String(d.agendadoPara) : undefined,
    };
  });
}

export async function getPublicThemeByPageId(idPagina: string): Promise<Appearance> {
  const { databases } = createServerClient();
  const docs = await databases.listDocuments(databaseId, Collections.themes, [
    Query.equal("idPagina", idPagina),
  ]);
  if (docs.documents.length === 0) {
    return defaultAppearance();
  }
  const doc = docs.documents[0] as unknown as Record<string, unknown>;
  return {
    desfoco: Number(doc.desfoco),
    arredondado: Number(doc.arredondado),
    opacidadeLinks: Number(doc.opacidadeLinks),
    corFundo: safeThemeColor(doc.corFundo, "#0a0a0a"),
    corCartao: safeThemeColor(doc.corCartao, "rgba(255,255,255,0.03)"),
    corTexto: safeThemeColor(doc.corTexto, "#fafafa"),
    corDestaque: safeThemeColor(doc.corDestaque, "#fafafa"),
    familiaFonte: safeThemeFont(doc.familiaFonte),
    tamanhoFonte: Number(doc.tamanhoFonte),
    raioBotao: Number(doc.raioBotao),
    larguraBotao: String(doc.larguraBotao) as Appearance["larguraBotao"],
    alturaBotao: String(doc.alturaBotao) as Appearance["alturaBotao"],
    estiloBotao: String(doc.estiloBotao) as Appearance["estiloBotao"],
    sombra: String(doc.sombra) as Appearance["sombra"],
    mostrarAvatar: Boolean(doc.mostrarAvatar),
    mostrarBiografia: Boolean(doc.mostrarBiografia),
    mostrarSocial: doc.mostrarSocial !== undefined ? Boolean(doc.mostrarSocial) : true,
    espacamento: Number(doc.espacamento),
    opacidadeVidro: doc.opacidadeVidro !== undefined ? Number(doc.opacidadeVidro) : 35,
    desfocoVidro: doc.desfocoVidro !== undefined ? Number(doc.desfocoVidro) : 25,
    intensidadeVidro: doc.intensidadeVidro !== undefined ? Number(doc.intensidadeVidro) : 50,
  };
}

async function getPublicBadges(idUtilizador: string, rawBadges: unknown): Promise<string[]> {
  const badges = Array.isArray(rawBadges)
    ? rawBadges.filter((badge): badge is string => typeof badge === "string" && badge !== "staff")
    : [];
  const { databases } = createServerClient();
  const approved = await databases.listDocuments(databaseId, "staff_applications", [
    Query.equal("idUtilizador", idUtilizador),
    Query.equal("estado", "approved"),
    Query.limit(1),
  ]);
  const hasTrustedApproval = approved.documents.some((doc) => Boolean(String(doc.revistoPor ?? "").trim()));
  return hasTrustedApproval ? [...badges, "staff"] : badges;
}

function getFileUrl(fileId: string) {
  // Keep public profile media same-origin so the Worker can validate and
  // rate-limit every image request before it reaches Appwrite Storage.
  return `${siteUrl}/api/media/${encodeURIComponent(fileId)}`;
}
