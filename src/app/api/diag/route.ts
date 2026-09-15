import { NextRequest, NextResponse } from "next/server";
import { createServerClient, databaseId, isAppwriteConfigured } from "@/lib/appwrite.server";
import { Query } from "node-appwrite";
import { requireAuth } from "@/lib/auth.server";

export async function GET(request: NextRequest) {
  try {
    // 1. Verificar autenticação
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const diagnostics: {
      userId: string;
      timestamp: string;
      checks: Record<string, { status: string; message: string; [key: string]: unknown }>;
      summary?: { ready: boolean; issues: string[] };
    } = {
      userId: user.$id,
      timestamp: new Date().toISOString(),
      checks: {},
    };

    // 2. Verificar se Appwrite está configurado
    diagnostics.checks.appwriteConfig = {
      status: isAppwriteConfigured() ? "ok" : "missing_env",
      message: isAppwriteConfigured()
        ? "APPWRITE_API_KEY e NEXT_PUBLIC_APPWRITE_PROJECT_ID configurados"
        : "Variáveis de ambiente em falta",
    };

    if (!isAppwriteConfigured()) {
      return NextResponse.json(diagnostics);
    }

    // 3. Tentar criar cliente server para verificar API key
    let databases;
    try {
      const client = createServerClient();
      databases = client.databases;
      diagnostics.checks.serverClient = {
        status: "ok",
        message: "Cliente server Appwrite criado com sucesso",
      };
    } catch (error) {
      diagnostics.checks.serverClient = {
        status: "error",
        message: `Erro ao criar cliente server: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
      return NextResponse.json(diagnostics);
    }

    // 4. Verificar se a página do utilizador existe
    let pageDoc;
    try {
      const pages = await databases.listDocuments(databaseId, "pages", [
        Query.equal("idUtilizador", user.$id),
        Query.limit(1),
      ]);

      if (pages.total === 0) {
        diagnostics.checks.page = {
          status: "not_found",
          message: "Nenhuma página encontrada para este utilizador",
        };
        return NextResponse.json(diagnostics);
      }

      pageDoc = pages.documents[0];
      diagnostics.checks.page = {
        status: "ok",
        id: pageDoc.$id,
        publicado: pageDoc.publicado,
        message: `Página encontrada: ${pageDoc.$id}, publicado: ${pageDoc.publicado}`,
      };
    } catch (error) {
      diagnostics.checks.page = {
        status: "error",
        message: `Erro ao buscar página: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
      return NextResponse.json(diagnostics);
    }

    // 5. Verificar se o documento de analytics existe
    try {
      const analyticsDocs = await databases.listDocuments(databaseId, "analytics", [
        Query.equal("idPagina", pageDoc.$id),
        Query.limit(1),
      ]);

      if (analyticsDocs.total === 0) {
        diagnostics.checks.analytics = {
          status: "not_found",
          message:
            "Nenhum documento de analytics encontrado. O analytics pode não estar a ser recolhido.",
        };
      } else {
        const analyticsDoc = analyticsDocs.documents[0];
        diagnostics.checks.analytics = {
          status: "ok",
          id: analyticsDoc.$id,
          visualizacoes: analyticsDoc.visualizacoes,
          cliques: analyticsDoc.cliques,
          seguidores: analyticsDoc.seguidores,
          message: `Analytics encontrado: ${analyticsDoc.$id}, views: ${analyticsDoc.visualizacoes}, clicks: ${analyticsDoc.cliques}`,
        };
      }
    } catch (error) {
      diagnostics.checks.analytics = {
        status: "error",
        message: `Erro ao buscar analytics: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }

    // 6. Verificar se existem links
    try {
      const linksDocs = await databases.listDocuments(databaseId, "links", [
        Query.equal("idPagina", pageDoc.$id),
        Query.limit(5),
      ]);

      diagnostics.checks.links = {
        status: linksDocs.total > 0 ? "ok" : "empty",
        count: linksDocs.total,
        message:
          linksDocs.total > 0
            ? `${linksDocs.total} links encontrados`
            : "Nenhum link encontrado",
      };
    } catch (error) {
      diagnostics.checks.links = {
        status: "error",
        message: `Erro ao buscar links: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }

    // 7. Resumo
    const hasPage = diagnostics.checks.page.status === "ok";
    const isPublished = hasPage && pageDoc?.publicado === true;
    const hasAnalytics = diagnostics.checks.analytics.status === "ok";
    const hasApiConfig = diagnostics.checks.appwriteConfig.status === "ok";

    diagnostics.summary = {
      ready: hasPage && isPublished && hasAnalytics && hasApiConfig,
      issues: [
        !hasPage && "Página não encontrada",
        hasPage && !isPublished && "Página não publicada",
        !hasAnalytics && "Documento de analytics não encontrado",
        !hasApiConfig && "Appwrite não configurado",
      ].filter((issue): issue is string => Boolean(issue)),
    };

    return NextResponse.json(diagnostics);
  } catch (error) {
    console.error("[api/diag] error:", error);
    return NextResponse.json(
      {
        error: "Erro interno no diagnóstico",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
