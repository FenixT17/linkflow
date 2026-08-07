import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";

/**
 * TEMPORARY diagnostic route — remove after deployment validation.
 * Reports ONLY presence (not values) of runtime secrets + connectivity.
 */
export async function GET() {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL?.trim() ?? "";
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ?? "";
  const appwriteKey = process.env.APPWRITE_API_KEY?.trim() ?? "";

  let upstashPing: unknown = "not-tested";
  if (upstashUrl && upstashToken) {
    try {
      const redis = new Redis({ url: upstashUrl, token: upstashToken });
      upstashPing = await redis.ping();
    } catch (error) {
      upstashPing = `ERROR: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  return NextResponse.json({
    env: {
      UPSTASH_REDIS_REST_URL: upstashUrl ? "set" : "UNSET",
      UPSTASH_REDIS_REST_TOKEN: upstashToken ? "set" : "UNSET",
      APPWRITE_API_KEY: appwriteKey ? "set" : "UNSET",
      NODE_ENV: process.env.NODE_ENV ?? "unset",
    },
    upstashPing,
  });
}
