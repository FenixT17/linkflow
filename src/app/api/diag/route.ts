import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim() ?? "";
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ?? "";

  const result: Record<string, unknown> = {
    env: {
      UPSTASH_REDIS_REST_URL: url ? "set" : "UNSET",
      UPSTASH_REDIS_REST_TOKEN: token ? "set" : "UNSET",
      APPWRITE_API_KEY: process.env.APPWRITE_API_KEY?.trim() ? "set" : "UNSET",
    },
  };

  if (url && token) {
    try {
      const redis = new Redis({ url, token });
      result.incr = await redis.incr("diag:counter");
      result.pttlBefore = await redis.pttl("diag:counter");
      result.pexpire = await redis.pexpire("diag:counter", 60000);
      result.pttlAfter = await redis.pttl("diag:counter");
    } catch (error) {
      result.upstashError = error instanceof Error ? error.message : String(error);
    }
  }

  return NextResponse.json(result);
}
