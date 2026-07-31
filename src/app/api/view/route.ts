import { NextRequest, NextResponse } from "next/server";
import { createServerClient, databaseId } from "@/lib/appwrite.server";
import { Query } from "node-appwrite";
import { updateDailyStats } from "@/lib/analytics";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { recordDeviceVisit } from "@/lib/device-detect";

// NOTA: Este endpoint é público e anónimo — regista visualizações de
// visitantes não autenticados na página pública /u/[username]. Aplica
// rate limiting por IP para evitar manipulação de métricas.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    if (typeof body.pageId !== "string" || !body.pageId.trim()) {
      return NextResponse.json({ error: "pageId is required" }, { status: 400 });
    }
    const pageId = body.pageId.trim();

    // Rate limit: max 10 views per IP per minute to prevent metric spam
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit("view", ip, { maxRequests: 10, windowMs: 60 * 1000 });
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { databases } = createServerClient();

    try {
      const pageDoc = await databases.getDocument(databaseId, "pages", pageId);
      if (!pageDoc.published) {
        return NextResponse.json({ error: "Page not found or not published" }, { status: 404 });
      }
    } catch {
      return NextResponse.json({ error: "Page not found or not published" }, { status: 404 });
    }

    const docs = await databases.listDocuments(databaseId, "analytics", [
      Query.equal("pageId", pageId),
    ]);

    if (docs.documents.length === 0) {
      return NextResponse.json({ error: "Analytics not found" }, { status: 404 });
    }

    const doc = docs.documents[0];
    const metricsJson = JSON.parse(String(doc.metricsJson ?? "{}"));
    const dailyStats = Array.isArray(metricsJson.dailyStats) ? metricsJson.dailyStats : [];
    const updatedDailyStats = updateDailyStats(dailyStats, "views");
    const userAgent = request.headers.get("user-agent") ?? "";
    const updatedMetrics = recordDeviceVisit({ ...metricsJson, dailyStats: updatedDailyStats }, userAgent);

    await databases.updateDocument(databaseId, "analytics", doc.$id, {
      views: (Number(doc.views) || 0) + 1,
      metricsJson: JSON.stringify(updatedMetrics),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/view] error:", error);
    const status = typeof error === "object" && error !== null && "status" in error && typeof (error as { status?: number }).status === "number"
      ? (error as { status: number }).status
      : 500;
    const message = status === 503 ? "Appwrite not configured" : "Failed to record view";
    return NextResponse.json({ error: message }, { status });
  }
}
