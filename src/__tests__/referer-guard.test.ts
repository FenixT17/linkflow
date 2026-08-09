import { describe, expect, it } from "vitest";
import { isSameOriginMediaReferrer } from "@/lib/media-security";

describe("metrics origin policy", () => {
  it("accepts same-origin referrers and rejects foreign referrers", () => {
    expect(isSameOriginMediaReferrer("https://linkflow.example/api/view", "https://linkflow.example/u/demo")).toBe(true);
    expect(isSameOriginMediaReferrer("https://linkflow.example/api/view", "https://evil.example/u/demo")).toBe(false);
  });
});
