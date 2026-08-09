import { describe, expect, it } from "vitest";
import {
  isAllowedImageContentType,
  isSameOriginMediaReferrer,
  isValidMediaFileId,
} from "@/lib/media-security";

describe("public media protection", () => {
  it("accepts normal Appwrite file IDs and rejects traversal or oversized IDs", () => {
    expect(isValidMediaFileId("avatar_123-abc.webp")).toBe(true);
    expect(isValidMediaFileId("../secrets")).toBe(false);
    expect(isValidMediaFileId("a".repeat(37))).toBe(false);
    expect(isValidMediaFileId("file id")).toBe(false);
  });

  it("allows same-origin and missing referrers but rejects external hotlinks", () => {
    expect(isSameOriginMediaReferrer("https://linkflow.example/api/media/a", null)).toBe(true);
    expect(isSameOriginMediaReferrer(
      "https://linkflow.example/api/media/a",
      "https://linkflow.example/u/demo",
    )).toBe(true);
    expect(isSameOriginMediaReferrer(
      "https://linkflow.example/api/media/a",
      "https://evil.example/download",
    )).toBe(false);
    expect(isSameOriginMediaReferrer("not-a-url", "also-not-a-url")).toBe(false);
  });

  it("allows only raster image content types", () => {
    expect(isAllowedImageContentType("image/jpeg")).toBe(true);
    expect(isAllowedImageContentType("image/png; charset=binary")).toBe(true);
    expect(isAllowedImageContentType("image/svg+xml")).toBe(false);
    expect(isAllowedImageContentType("application/zip")).toBe(false);
    expect(isAllowedImageContentType(null)).toBe(false);
  });
});
