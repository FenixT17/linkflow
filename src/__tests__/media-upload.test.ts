import { describe, expect, it, vi, afterEach } from "vitest";
import { fetchWithCsrf } from "@/hooks/use-csrf";

vi.mock("@/hooks/use-csrf", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/use-csrf")>("@/hooks/use-csrf");
  return actual;
});

describe("media upload request handling", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("does not force application/json on FormData bodies", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("document", { cookie: "csrf-token=csrf123" } as Document);

    const form = new FormData();
    form.set("bucketId", "files");
    form.set("file", new Blob(["image"]), "photo.jpg");

    await fetchWithCsrf("/api/media/upload", { method: "POST", body: form });

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = requestInit.headers as Headers;
    expect(headers.get("x-csrf-token")).toBe("csrf123");
    expect(headers.get("content-type")).toBeNull();
  });

  it("keeps application/json for ordinary JSON bodies", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("document", { cookie: "csrf-token=csrf123" } as Document);

    await fetchWithCsrf("/api/media/upload", {
      method: "POST",
      body: JSON.stringify({ ok: true }),
    });

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = requestInit.headers as Headers;
    expect(headers.get("content-type")).toBe("application/json");
  });
});
