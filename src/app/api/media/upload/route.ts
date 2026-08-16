import { NextRequest, NextResponse } from "next/server";
import { ID } from "node-appwrite";
import { csrfGuard } from "@/lib/csrf";
import { requireAuth } from "@/lib/auth.server";
import { filesBucketId } from "@/lib/appwrite.server";
import { checkRateLimit, getClientIp, mergeRateLimitHeaders } from "@/lib/rate-limit";
import { normalizeEnvUrl } from "@/lib/utils";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const APPWRITE_ENDPOINT = normalizeEnvUrl(
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT,
  "https://fra.cloud.appwrite.io/v1",
);
const APPWRITE_PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID?.trim() ?? "";
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY?.trim() ?? "";
const IMAGE_TYPES = new Map([
  ["image/jpeg", { extension: "jpg" }],
  ["image/png", { extension: "png" }],
  ["image/webp", { extension: "webp" }],
]);

function hasImageSignature(bytes: Uint8Array, contentType: string): boolean {
  if (contentType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === "image/png") {
    return bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  }
  if (contentType === "image/webp") {
    return bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  }
  return false;
}

function errorResponse(message: string, status: number, headers?: HeadersInit) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store", ...headers } },
  );
}

/**
 * POST /api/media/upload
 *
 * Uploads profile media server-side. The browser SDK proxy is deliberately
 * not used here: Appwrite's chunked multipart request is not reliable through
 * a generic Next/Cloudflare body proxy. The Worker receives the FormData,
 * validates the real image signature, and uploads with its Appwrite API key.
 */
export async function POST(request: NextRequest) {
  const csrfCheck = csrfGuard(request);
  if (csrfCheck) return csrfCheck;

  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  let rate;
  try {
    rate = await checkRateLimit("media_upload", `${auth.user.$id}:${getClientIp(request)}`, {
      maxRequests: 12,
      windowMs: 10 * 60 * 1000,
    });
  } catch {
    return errorResponse("Serviço de upload temporariamente indisponível.", 503);
  }
  const rateHeaders = mergeRateLimitHeaders(undefined, rate);
  if (!rate.allowed) {
    return errorResponse("Muitos uploads. Aguarde antes de tentar novamente.", 429, rateHeaders);
  }

  const contentLength = request.headers.get("content-length");
  const maxRequestBytes = MAX_FILE_SIZE + 128 * 1024;
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > maxRequestBytes)) {
    return errorResponse("Ficheiro demasiado grande. Máximo 5MB.", 413);
  }

  try {
    const form = await request.formData();
    const requestedBucket = form.get("bucketId");
    const file = form.get("file");

    if (typeof requestedBucket !== "string" || requestedBucket !== filesBucketId) {
      return errorResponse("Bucket de ficheiros inválido.", 400, rateHeaders);
    }
    if (!file || typeof file !== "object" || !("arrayBuffer" in file)) {
      return errorResponse("Nenhuma imagem foi enviada.", 400, rateHeaders);
    }

    const uploadedFile = file as File;
    const contentType = uploadedFile.type.toLowerCase();
    const imageType = IMAGE_TYPES.get(contentType);
    if (!imageType) {
      return errorResponse("Formato não suportado. Use JPG, PNG ou WEBP.", 415, rateHeaders);
    }
    if (uploadedFile.size > MAX_FILE_SIZE) {
      return errorResponse("Ficheiro demasiado grande. Máximo 5MB.", 413, rateHeaders);
    }

    const bytes = new Uint8Array(await uploadedFile.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_FILE_SIZE || !hasImageSignature(bytes, contentType)) {
      return errorResponse("O conteúdo do ficheiro não corresponde a uma imagem válida.", 415, rateHeaders);
    }

    if (!APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
      return errorResponse("Serviço de imagens não configurado.", 503, rateHeaders);
    }

    const safeName = `linkflow-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${imageType.extension}`;
    const payload = new FormData();
    payload.set("fileId", ID.unique());
    payload.set("file", new Blob([bytes], { type: contentType }), safeName);
    payload.append("permissions[]", `read(\"user:${auth.user.$id}\")`);
    payload.append("permissions[]", `update(\"user:${auth.user.$id}\")`);
    payload.append("permissions[]", `delete(\"user:${auth.user.$id}\")`);

    const upstream = await fetch(
      `${APPWRITE_ENDPOINT}/storage/buckets/${encodeURIComponent(filesBucketId)}/files`,
      {
        method: "POST",
        headers: {
          "X-Appwrite-Project": APPWRITE_PROJECT_ID,
          "X-Appwrite-Key": APPWRITE_API_KEY,
        },
        body: payload,
      },
    );
    const created = await upstream.json().catch(() => ({})) as {
      $id?: unknown;
      name?: unknown;
      mimeType?: unknown;
      sizeOriginal?: unknown;
    };
    if (!upstream.ok || typeof created.$id !== "string") {
      return errorResponse("Não foi possível carregar a imagem.", upstream.status >= 500 ? 502 : 400, rateHeaders);
    }

    return NextResponse.json(
      { file: { $id: created.$id, name: String(created.name ?? safeName), mimeType: String(created.mimeType ?? contentType), sizeOriginal: Number(created.sizeOriginal ?? bytes.byteLength) } },
      { status: 201, headers: rateHeaders },
    );
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof (error as { status?: number }).status === "number"
      ? (error as { status: number }).status
      : 502;
    return errorResponse(
      status === 503 ? "Serviço de imagens não configurado." : "Não foi possível carregar a imagem.",
      status === 503 ? 503 : 502,
      rateHeaders,
    );
  }
}
