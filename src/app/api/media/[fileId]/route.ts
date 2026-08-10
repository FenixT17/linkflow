import { NextRequest, NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { checkRateLimit, getClientIp, mergeRateLimitHeaders } from "@/lib/rate-limit";
import { createServerClient, databaseId, filesBucketId } from "@/lib/appwrite.server";
import { requireAuth } from "@/lib/auth.server";
import {
  isAllowedImageContentType,
  isSameOriginMediaReferrer,
  isValidMediaFileId,
  MEDIA_RATE_LIMIT,
} from "@/lib/media-security";

async function isAuthorizedMediaFile(fileId: string, request: NextRequest): Promise<boolean> {
  const { databases } = createServerClient();
  const [avatarMatches, bannerMatches, linkMatches] = await Promise.all([
    databases.listDocuments(databaseId, "pages", [Query.equal("avatarId", fileId), Query.limit(100)]),
    databases.listDocuments(databaseId, "pages", [Query.equal("bannerId", fileId), Query.limit(100)]),
    databases.listDocuments(databaseId, "links", [Query.equal("imageId", fileId), Query.limit(100)]),
  ]);

  const pageIds = new Set<string>();
  const owners = new Set<string>();
  let isPublished = false;
  for (const result of [avatarMatches, bannerMatches]) {
    for (const document of result.documents) {
      pageIds.add(String(document.$id));
      owners.add(String(document.userId ?? ""));
      if (Boolean(document.published)) isPublished = true;
    }
  }

  // Link images point to the page through pageId. Resolve each referenced
  // page before allowing the API-key-backed proxy to read the file.
  for (const link of linkMatches.documents) {
    const pageId = String(link.pageId ?? "");
    if (pageId) pageIds.add(pageId);
  }
  for (const pageId of pageIds) {
    const page = await databases.getDocument(databaseId, "pages", pageId).catch(() => null);
    if (page) {
      owners.add(String(page.userId ?? ""));
      if (Boolean(page.published)) isPublished = true;
    }
  }

  if (isPublished) return true;
  if (owners.size === 0) return false;

  // Unpublished dashboard media is available only to its authenticated owner.
  const auth = await requireAuth(request);
  return !(auth instanceof NextResponse) && owners.has(auth.user.$id);
}

function errorResponse(status: number, message: string, headers?: HeadersInit) {
  return new NextResponse(message, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;

  if (!isValidMediaFileId(fileId)) {
    return errorResponse(400, "Invalid media request.");
  }

  if (!isSameOriginMediaReferrer(request.url, request.headers.get("referer"))) {
    return errorResponse(403, "Media hotlinking is not allowed.");
  }

  const clientIp = getClientIp(request);
  let rateLimit;
  try {
    rateLimit = await checkRateLimit(
      "media",
      `${clientIp}:${fileId}`,
      MEDIA_RATE_LIMIT,
    );
  } catch {
    // Fail closed: without the distributed limiter this endpoint must not
    // become an unprotected Appwrite bandwidth relay.
    return errorResponse(503, "Media protection unavailable.");
  }

  const rateHeaders = mergeRateLimitHeaders(undefined, rateLimit);
  if (!rateLimit.allowed) {
    return errorResponse(429, "Too many media requests.", rateHeaders);
  }

  try {
    if (!(await isAuthorizedMediaFile(fileId, request))) {
      return errorResponse(404, "Media unavailable.", rateHeaders);
    }
  } catch {
    return errorResponse(404, "Media unavailable.", rateHeaders);
  }

  const MAX_MEDIA_BYTES = 5 * 1024 * 1024;
  let file: { mimeType?: string; sizeOriginal?: number };
  let bytes: ArrayBuffer;
  try {
    // Use the Appwrite server SDK for both metadata and binary retrieval. A
    // manual REST request to /view can be interpreted as a client request by
    // Appwrite when the project is supplied in the query string, which caused
    // valid private files to return 403/404 from the Worker.
    const { storage } = createServerClient();
    file = await storage.getFile(filesBucketId, fileId);
    if (Number(file.sizeOriginal ?? 0) > MAX_MEDIA_BYTES) {
      return errorResponse(413, "Media too large.", rateHeaders);
    }
    bytes = await storage.getFileView(filesBucketId, fileId);
  } catch (error) {
    const status = typeof error === "object" && error !== null && "code" in error && typeof (error as { code?: number }).code === "number"
      ? (error as { code: number }).code
      : typeof error === "object" && error !== null && "status" in error && typeof (error as { status?: number }).status === "number"
        ? (error as { status: number }).status
        : undefined;
    if (status === 404) return errorResponse(404, "Media unavailable.", rateHeaders);
    if (status === 503) return errorResponse(503, "Media service unavailable.", rateHeaders);
    return errorResponse(502, "Media service unavailable.", rateHeaders);
  }

  if (bytes.byteLength > MAX_MEDIA_BYTES) {
    return errorResponse(413, "Media too large.", rateHeaders);
  }

  const contentType = file.mimeType?.split(";", 1)[0].trim().toLowerCase() ?? "";
  if (!isAllowedImageContentType(contentType)) {
    return errorResponse(415, "Unsupported media type.", rateHeaders);
  }

  const responseHeaders = new Headers(rateHeaders);
  responseHeaders.set("Content-Type", contentType);
  responseHeaders.set("Content-Length", String(bytes.byteLength));
  responseHeaders.set("Content-Disposition", "inline");
  responseHeaders.set("X-Content-Type-Options", "nosniff");
  responseHeaders.set("Referrer-Policy", "no-referrer");
  responseHeaders.set("Cross-Origin-Resource-Policy", "same-origin");
  // Cache no browser apenas (private = nunca em caches partilhados/CDN, por
  // isso a proteção anti-download em massa mantém-se: cada browser só guarda
  // o que o próprio utilizador viu). Os fileIds do Appwrite são imutáveis
  // (ID.unique() por upload), logo o conteúdo de um URL nunca muda —
  // `immutable` permite que mudar de aba (ex: Perfil) seja instantâneo
  // depois da primeira visita, sem voltar a percorrer o proxy.
  responseHeaders.set("Cache-Control", "private, max-age=604800, immutable");

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: responseHeaders,
  });
}
