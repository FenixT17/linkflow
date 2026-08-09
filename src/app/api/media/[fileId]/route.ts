import { NextRequest, NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { checkRateLimit, getClientIp, mergeRateLimitHeaders } from "@/lib/rate-limit";
import { createServerClient, databaseId, filesBucketId } from "@/lib/appwrite.server";
import { requireAuth } from "@/lib/auth.server";
import { normalizeEnvUrl } from "@/lib/utils";
import {
  isAllowedImageContentType,
  isSameOriginMediaReferrer,
  isValidMediaFileId,
  MEDIA_RATE_LIMIT,
} from "@/lib/media-security";

const APPWRITE_ENDPOINT = normalizeEnvUrl(
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT,
  "https://cloud.appwrite.io/v1"
);
const APPWRITE_PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID?.trim() ?? "";
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY?.trim() ?? "";

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

  if (!isValidMediaFileId(fileId) || !APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
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

  const target = new URL(
    `${APPWRITE_ENDPOINT}/storage/buckets/${encodeURIComponent(filesBucketId)}/files/${encodeURIComponent(fileId)}/view`,
  );
  target.searchParams.set("project", APPWRITE_PROJECT_ID);

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      cache: "no-store",
      redirect: "error",
      headers: {
        // The bucket is private; only this server-side proxy can read files.
        "X-Appwrite-Project": APPWRITE_PROJECT_ID,
        "X-Appwrite-Key": APPWRITE_API_KEY,
      },
    });
  } catch {
    return errorResponse(502, "Media service unavailable.", rateHeaders);
  }

  if (!upstream.ok) {
    return errorResponse(upstream.status === 404 ? 404 : 502, "Media unavailable.", rateHeaders);
  }

  const contentType = upstream.headers.get("content-type");
  if (!isAllowedImageContentType(contentType)) {
    return errorResponse(415, "Unsupported media type.", rateHeaders);
  }

  const contentLength = Number(upstream.headers.get("content-length") ?? "0");
  if (contentLength > 5 * 1024 * 1024) {
    return errorResponse(413, "Media too large.", rateHeaders);
  }

  const MAX_MEDIA_BYTES = 5 * 1024 * 1024;
  const reader = upstream.body?.getReader();
  if (!reader) return errorResponse(502, "Media service unavailable.", rateHeaders);

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_MEDIA_BYTES) {
        await reader.cancel();
        return errorResponse(413, "Media too large.", rateHeaders);
      }
      chunks.push(value);
    }
  } catch {
    await reader.cancel().catch(() => {});
    return errorResponse(502, "Media service unavailable.", rateHeaders);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const responseHeaders = new Headers(rateHeaders);
  responseHeaders.set("Content-Type", contentType!.split(";", 1)[0].trim().toLowerCase());
  responseHeaders.set("Content-Disposition", "inline");
  responseHeaders.set("X-Content-Type-Options", "nosniff");
  responseHeaders.set("Referrer-Policy", "no-referrer");
  responseHeaders.set("Cross-Origin-Resource-Policy", "same-origin");
  responseHeaders.set("Cache-Control", "private, no-store, max-age=0");

  return new NextResponse(bytes, {
    status: 200,
    headers: responseHeaders,
  });
}
