import { describe, expect, it } from "vitest";
import { ALLOWED_FIELDS, filterDocumentBody } from "@/lib/appwrite-fields";
import { defaultAppearance } from "@/lib/defaults";

/**
 * Testes de regressão do allowlist anti-mass-assignment do proxy
 * `/api/appwrite`.
 *
 * Porque existem: um allowlist desatualizado falha EM SILÊNCIO — os campos são
 * removidos do body, o Appwrite responde 200 e a escrita não persiste. Foi o
 * que aconteceu à aparência (`themes`) e estava prestes a acontecer aos QR
 * codes (`qr_codes`), ambos com nomes de campos que já não existem no schema.
 *
 * Estratégia: em vez de repetir o allowlist, cada teste parte do **payload real
 * que a aplicação escreve** (ex: `defaultAppearance()`) e verifica que ele
 * sobrevive ao filtro. Se o allowlist ficar desatualizado, o teste falha.
 */

/** Aplica o filtro como o proxy faz e devolve os campos sobreviventes. */
function applyFilter(
  collectionId: string,
  data: Record<string, unknown>,
  method = "POST",
) {
  const body: Record<string, unknown> = { data: { ...data } };
  const modified = filterDocumentBody(body, collectionId, method);
  return { modified, data: body.data as Record<string, unknown> };
}

describe("allowlist do proxy — payloads reais sobrevivem ao filtro", () => {
  it("themes: o payload de aparência passa intacto (regressão da aparência)", () => {
    const payload = defaultAppearance() as unknown as Record<string, unknown>;
    // createPage envia também o campo legado `tema`
    const full = { ...payload, tema: "glass" };

    const { data } = applyFilter("themes", full);

    expect(data).toEqual(full);
  });

  it("themes: cobre todos os campos que a app escreve", () => {
    for (const field of [...Object.keys(defaultAppearance()), "idPagina", "tema"]) {
      expect(ALLOWED_FIELDS.themes.has(field), `themes.${field} em falta`).toBe(true);
    }
  });

  it("themes: os nomes obsoletos continuam rejeitados", () => {
    // Estes eram os campos do allowlist antigo — nenhum existe no schema.
    const stale = {
      fundo: "#000",
      botaoFundo: "#000",
      botaoHover: "#000",
      fundoSecundario: "#000",
      texto: "#fff",
      botaoTexto: "#fff",
      bordaAvatar: "#fff",
    };

    const { data, modified } = applyFilter("themes", stale);

    expect(data).toEqual({});
    expect(modified).toBe(true);
    for (const field of Object.keys(stale)) {
      expect(ALLOWED_FIELDS.themes.has(field), `${field} não deveria ser aceite`).toBe(false);
    }
  });

  it("qr_codes: o schema real passa intacto (regressão dos QR codes)", () => {
    const payload = {
      idPagina: "pagina-1",
      corPrimeiroPlano: "#000000",
      corFundo: "#FFFFFF",
      idLogo: "logo-1",
      tamanho: 512,
    };

    expect(applyFilter("qr_codes", payload).data).toEqual(payload);
  });

  it("qr_codes: o allowlist corresponde exactamente ao schema", () => {
    // Nada escreve em qr_codes hoje, por isso não há payload real para testar:
    // a garantia é a igualdade exacta com o schema de provision-appwrite.ts.
    const schema = ["idPagina", "corPrimeiroPlano", "corFundo", "idLogo", "tamanho"];
    expect([...ALLOWED_FIELDS.qr_codes].sort()).toEqual([...schema].sort());
    expect(ALLOWED_FIELDS.qr_codes.has("qr_data")).toBe(false);
    expect(ALLOWED_FIELDS.qr_codes.has("qr_imagem")).toBe(false);
  });

  it("links: o payload de createLink passa intacto", () => {
    const payload = {
      idPagina: "pagina-1",
      tipo: "link",
      titulo: "Portfólio",
      url: "https://exemplo.pt",
      descricao: "Os meus trabalhos",
      icone: "github",
      cor: "#ffffff",
      idImagem: "ficheiro-1",
      animacao: "fade",
      ativo: true,
      visivel: true,
      novaAba: true,
      ordem: 3,
      cliques: 0,
      agendadoPara: "2026-09-01T10:00:00.000Z",
    };

    expect(applyFilter("links", payload).data).toEqual(payload);
  });

  it("analytics: o payload do documento passa intacto", () => {
    const payload = {
      idPagina: "pagina-1",
      visualizacoes: 10,
      cliques: 4,
      seguidores: 7,
      metricasJson: "{}",
    };

    expect(applyFilter("analytics", payload).data).toEqual(payload);
  });

  it("pages: o payload de perfil, avatar, banner e agendamento passa intacto", () => {
    const payload = {
      nomeUtilizador: "joao",
      nomeExibicao: "João",
      biografia: "Olá",
      tipoPagina: "creator",
      modeloPagina: "template2",
      publicado: true,
      idAvatar: "avatar-1",
      idBanner: "banner-1",
      publicacaoAgendadaEm: "2026-09-01T10:00:00.000Z",
      despublicacaoAgendadaEm: "2026-10-01T10:00:00.000Z",
      aEliminar: false,
    };

    expect(applyFilter("pages", payload).data).toEqual(payload);
  });
});

describe("allowlist do proxy — o que continua bloqueado", () => {
  it("pages: `emblemas` e `plano` são removidos (badges são server-side)", () => {
    // PUT para isolar o mass-assignment do comportamento do POST (que injeta
    // os campos obrigatórios — coberto no teste seguinte).
    const { data, modified } = applyFilter("pages", {
      nomeUtilizador: "joao",
      emblemas: ["staff"],
      plano: "business",
      idUtilizador: "outro-utilizador",
    }, "PUT");

    // As badges só podem ser concedidas por POST /api/badges (API key +
    // validação de plano/candidatura), nunca pelo client SDK.
    // `idUtilizador` é permitido no allowlist (obrigatório no schema) mas a
    // validação de ownership no proxy impede que o utilizador defina o campo
    // para o ID de outro utilizador.
    expect(data).toEqual({ nomeUtilizador: "joao", idUtilizador: "outro-utilizador" });
    expect(modified).toBe(true);
  });

  it("themes: campos que não existem no schema são removidos", () => {
    const payload = { ...(defaultAppearance() as unknown as Record<string, unknown>), plano: "business", isAdmin: true };
    const { data } = applyFilter("themes", payload);

    expect(data).not.toHaveProperty("plano");
    expect(data).not.toHaveProperty("isAdmin");
    expect(Object.keys(data)).toHaveLength(Object.keys(defaultAppearance()).length);
  });

  it("pages: no POST, nomeUtilizador/nomeExibicao nunca desaparecem", () => {
    const { data } = applyFilter("pages", { biografia: "só bio" }, "POST");

    expect(data).toEqual({ biografia: "só bio", nomeUtilizador: "", nomeExibicao: "" });
  });

  it("pages: no PUT, os campos obrigatórios não são injetados", () => {
    const { data, modified } = applyFilter("pages", { biografia: "só bio" }, "PUT");

    expect(data).toEqual({ biografia: "só bio" });
    expect(modified).toBe(false);
  });
});

describe("allowlist do proxy — comportamento geral", () => {
  it("coleções sem allowlist ficam intactas (escritas do servidor)", () => {
    const payload = { idUtilizador: "u1", acao: "login", enderecoIP: "1.2.3.4" };
    const { data, modified } = applyFilter("activity_logs", payload);

    expect(data).toEqual(payload);
    expect(modified).toBe(false);
  });

  it("tolera body ausente, sem `data`, ou com `data` não-objeto", () => {
    expect(filterDocumentBody(null, "pages", "POST")).toBe(false);
    expect(filterDocumentBody({}, "pages", "POST")).toBe(false);
    expect(filterDocumentBody({ data: null }, "pages", "POST")).toBe(false);
    expect(filterDocumentBody({ data: "nope" }, "pages", "POST")).toBe(false);
    expect(filterDocumentBody({ data: 42 }, "pages", "POST")).toBe(false);
  });

  it("todos os allowlists são conjuntos não vazios", () => {
    for (const [collectionId, fields] of Object.entries(ALLOWED_FIELDS)) {
      expect(fields.size, `${collectionId} tem allowlist vazia`).toBeGreaterThan(0);
    }
  });
});
