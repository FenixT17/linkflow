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
  let upstashEval: unknown = "not-tested";
  if (upstashUrl && upstashToken) {
    try {
      const redis = new Redis({ url: upstashUrl, token: upstashToken });
      upstashPing = await redis.ping();
    } catch (error) {
      upstashPing = `ERROR: ${error instanceof Error ? error.message : String(error)}`;
    }
    try {
      const redis2 = new Redis({ url: upstashUrl, token: upstashToken });
      const script = `local c = redis.call("INCR", KEYS[1]) if c == 1 then redis.call("PEXPIRE", KEYS[1], ARGV[1]) end local t = redis.call("PTTL", KEYS[1]) return { c, t }`;
      upstashEval = await redis2.eval(script, ["diag:test"], ["60000"]);
    } catch (error) {
      upstashEval = `ERROR: ${error instanceof Error ? error.message : String(error)}`;
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
    upstashEval,
  });
}
