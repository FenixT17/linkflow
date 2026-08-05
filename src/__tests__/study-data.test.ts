import { describe, it, expect } from "vitest";
import { buildStudyDeviceName, formatCoordinates } from "@/lib/analytics";

describe("buildStudyDeviceName", () => {
  it("usa o nome explícito do dispositivo (UA-CH sec-ch-ua-model) quando disponível", () => {
    expect(buildStudyDeviceName("Pixel 7", "mobile", "Android", "qualquer UA")).toBe("Pixel 7");
    expect(buildStudyDeviceName("iPhone 15 Pro", "mobile", "iOS", "qualquer UA")).toBe("iPhone 15 Pro");
  });

  it("deriva dispositivo + OS quando não há nome explícito", () => {
    expect(buildStudyDeviceName("", "mobile", "iOS", "qualquer UA")).toBe("mobile (iOS)");
    expect(buildStudyDeviceName(undefined, "desktop", "Windows", "qualquer UA")).toBe("desktop (Windows)");
  });

  it("deteta o tipo a partir do user-agent como último recurso", () => {
    const mobileUA =
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";
    expect(buildStudyDeviceName("", undefined, "Android", mobileUA)).toBe("mobile (Android)");
  });

  it("nunca devolve string vazia", () => {
    expect(buildStudyDeviceName("", undefined, undefined, "")).toContain("desktop");
  });
});

describe("formatCoordinates", () => {
  it("formata lat/lng em texto bruto compatível com Google Maps (lat, lng)", () => {
    expect(formatCoordinates(38.7294435, -9.1537627)).toBe("38.7294435, -9.1537627");
    // Aceite diretamente em https://www.google.com/maps?q=38.7294435,-9.1537627
    expect(formatCoordinates(37.3361663, -121.8905913)).toBe("37.3361663, -121.8905913");
  });

  it("devolve string vazia quando faltam coordenadas", () => {
    expect(formatCoordinates(undefined, -9.1)).toBe("");
    expect(formatCoordinates(38.7, undefined)).toBe("");
    expect(formatCoordinates()).toBe("");
  });
});
