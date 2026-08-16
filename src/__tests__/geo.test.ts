import { describe, it, expect, vi, afterEach } from "vitest";
import { createHash, createHmac } from "node:crypto";
import { hashIp, hashIpWithSecret, isPrivateIp, resolveGeoWithCoordinates } from "@/lib/geo";

/** SHA-256 puro (sem salt) — para provar que o hashIp aplica o salt. */
function bareSha256(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

describe("hashIp (SHA-256 salgado)", () => {
  it("é determinístico — mesmo IP devolve sempre o mesmo hash", () => {
    expect(hashIp("203.0.113.42")).toBe(hashIp("203.0.113.42"));
  });

  it("IPs diferentes produzem hashes diferentes", () => {
    expect(hashIp("203.0.113.42")).not.toBe(hashIp("203.0.113.43"));
  });

  it("não é reversível — o hash não contém o IP em texto plano", () => {
    const hash = hashIp("203.0.113.42");
    expect(hash).not.toContain("203");
    expect(hash).not.toContain("113");
    expect(hash).not.toContain("42");
  });

  it("devolve 16 hex chars (64 bits) — espaço de colisão adequado", () => {
    const hash = hashIp("198.51.100.7");
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("aplica salt fixo — o resultado não é o SHA-256 do IP puro (anti rainbow tables)", () => {
    const ip = "198.51.100.7";
    // Prova direta: o hashIp difere do SHA-256 do IP sem salt → o salt está
    // embutido no input (impede rainbow tables pré-computadas sobre IPs).
    expect(hashIp(ip)).not.toBe(bareSha256(ip));
    // ...mas é determinístico e tem o formato esperado.
    expect(hashIp(ip)).toBe(hashIp(ip));
    expect(hashIp(ip)).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("hashIpWithSecret (HMAC server-side — M1)", () => {
  it("é HMAC-SHA256 do IP com o segredo (16 hex chars)", () => {
    const ip = "203.0.113.9";
    const secret = "super-secret-key";
    const expected = createHmac("sha256", secret).update(ip, "utf8").digest("hex").slice(0, 16);
    expect(hashIpWithSecret(ip, secret)).toBe(expected);
    expect(hashIpWithSecret(ip, secret)).toMatch(/^[0-9a-f]{16}$/);
  });

  it("segredos diferentes produzem hashes diferentes (reversão requer o segredo)", () => {
    const ip = "203.0.113.9";
    expect(hashIpWithSecret(ip, "secret-a")).not.toBe(hashIpWithSecret(ip, "secret-b"));
  });
});

describe("resolveGeoWithCoordinates (tabela Dados para Estudos)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("devolve coordenadas aproximadas (lat/lng) a partir do lookup ipwho.is", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("ipwho.is")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            country: "United States",
            country_code: "US",
            city: "San Jose",
            latitude: 37.3361663,
            longitude: -121.8905913,
          }),
        });
      }
      // country.is — o campo `country` é o código ISO
      return Promise.resolve({
        ok: true,
        json: async () => ({ country: "US", city: "San Jose" }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const geo = await resolveGeoWithCoordinates("8.8.8.8");
    expect(geo.latitude).toBe(37.3361663);
    expect(geo.longitude).toBe(-121.8905913);
    expect(geo.countryCode).toBe("US");
    expect(geo.city).toBe("San Jose");
  });

  it("não faz lookup externo para IPs privados (dev nunca polui a tabela)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const geo = await resolveGeoWithCoordinates("192.168.1.10");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(geo.latitude).toBeUndefined();
  });

  it("tolera falhas do lookup sem quebrar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const geo = await resolveGeoWithCoordinates("203.0.113.5");
    expect(geo).toBeDefined();
  });
});

describe("isPrivateIp", () => {
  it("deteta IPs locais/privados", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("::1")).toBe(true);
    expect(isPrivateIp("10.0.0.5")).toBe(true);
    expect(isPrivateIp("192.168.1.1")).toBe(true);
    expect(isPrivateIp("172.16.0.1")).toBe(true);
  });

  it("aceita IPs públicos", () => {
    expect(isPrivateIp("203.0.113.42")).toBe(false);
    expect(isPrivateIp("8.8.8.8")).toBe(false);
  });

  it("trata valores vazios/desconhecidos como privados (nunca recolher)", () => {
    expect(isPrivateIp(null)).toBe(true);
    expect(isPrivateIp(undefined)).toBe(true);
    expect(isPrivateIp("")).toBe(true);
    expect(isPrivateIp("unknown")).toBe(true);
  });
});
