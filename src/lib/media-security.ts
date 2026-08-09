import "server-only";

/** Appwrite file IDs may contain letters, digits, dots, hyphens and underscores. */
const APPWRITE_FILE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/;

const IMAGE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function isValidMediaFileId(fileId: string): boolean {
  return APPWRITE_FILE_ID.test(fileId);
}

/**
 * Public images should only be embedded by LinkFlow itself. Requests without
 * Referer are allowed because privacy extensions and strict browser policies
 * commonly omit it; a foreign Referer is rejected as hotlinking.
 */
export function isSameOriginMediaReferrer(requestUrl: string, referer: string | null): boolean {
  if (!referer) return true;
  try {
    return new URL(referer).origin === new URL(requestUrl).origin;
  } catch {
    return false;
  }
}

export function isAllowedImageContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  return IMAGE_CONTENT_TYPES.has(contentType.split(";", 1)[0].trim().toLowerCase());
}

export const MEDIA_RATE_LIMIT = {
  maxRequests: 120,
  windowMs: 10 * 60_000,
} as const;
