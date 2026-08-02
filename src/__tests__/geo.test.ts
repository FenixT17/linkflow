import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { hashIp, isPrivateIp } from "@/lib/geo";

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
