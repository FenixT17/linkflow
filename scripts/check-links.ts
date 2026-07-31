/**
 * Broken Links / 404 / SEO Checker
 *
 * Usage:
 *   npx tsx scripts/check-links.ts [baseUrl]
 *
 * Example:
 *   npx tsx scripts/check-links.ts http://localhost:3000
 *   npx tsx scripts/check-links.ts https://linkflow-web.netlify.app
 */

interface CheckResult {
  url: string;
  status: number;
  statusText: string;
  finalUrl?: string;
  redirectCount: number;
  redirectLoop: boolean;
  canonical?: string;
  noindex: boolean;
  error?: string;
}

const args = process.argv.slice(2);
const baseUrl = (args[0] ?? "http://localhost:3000").replace(/\/$/, "");

const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 10_000;
const CONCURRENCY = 5;
const RETRIES = 2;

const DEFAULT_HEADERS = {
  "User-Agent": "LinkFlow-BrokenLinksChecker/1.0 (+https://linkflow-web.netlify.app)",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    clearTimeout(timer);
    return response;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function fetchWithRedirects(
  url: string,
  redirectCount = 0,
  attempt = 0
): Promise<{ response: Response; finalUrl: string; redirectCount: number; loop: boolean }> {
  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: "GET",
        redirect: "manual",
        headers: DEFAULT_HEADERS,
      },
      TIMEOUT_MS
    );

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (location) {
        if (redirectCount >= MAX_REDIRECTS) {
          return { response, finalUrl: url, redirectCount, loop: true };
        }
        const nextUrl = new URL(location, url).href;
        return fetchWithRedirects(nextUrl, redirectCount + 1, attempt);
      }
    }

    return { response, finalUrl: url, redirectCount, loop: false };
  } catch (err) {
    if (attempt < RETRIES) {
      await sleep(500 * (attempt + 1));
      return fetchWithRedirects(url, redirectCount, attempt + 1);
    }
    throw err;
  }
}

function extractMeta(content: string, name: string) {
  const regex = new RegExp(
    `<meta\\s+[^>]*(?:name=["']?${name}["']?[^>]*content=["']([^"']+)["']|content=["']([^"']+)["'][^>]*name=["']?${name}["']?)`,
    "i"
  );
  const match = content.match(regex);
  return match?.[1] ?? match?.[2];
}

function extractLinkRel(content: string, rel: string) {
  const regex = new RegExp(
    `<link\\s+[^>]*rel=["']?${rel}["']?[^>]*href=["']([^"']+)["']`,
    "i"
  );
  const match = content.match(regex);
  if (match?.[1]) return match[1];

  const altRegex = new RegExp(
    `<link\\s+[^>]*href=["']([^"']+)["'][^>]*rel=["']?${rel}["']?`,
    "i"
  );
  const altMatch = content.match(altRegex);
  return altMatch?.[1];
}

async function checkUrl(url: string): Promise<CheckResult> {
  const result: CheckResult = {
    url,
    status: 0,
    statusText: "",
    redirectCount: 0,
    redirectLoop: false,
    noindex: false,
  };

  try {
    const { response, finalUrl, redirectCount, loop } = await fetchWithRedirects(url);
    result.finalUrl = finalUrl;
    result.redirectCount = redirectCount;
    result.redirectLoop = loop;
    result.status = response.status;
    result.statusText = response.statusText;

    if (response.headers.get("content-type")?.includes("text/html")) {
      const text = await response.text();
      const robotsMeta = extractMeta(text, "robots");
      if (robotsMeta?.includes("noindex")) {
        result.noindex = true;
      }
      result.canonical = extractLinkRel(text, "canonical");
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  }

  return result;
}

async function fetchSitemapUrls(sitemapUrl: string): Promise<string[]> {
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(
        sitemapUrl,
        { headers: DEFAULT_HEADERS },
        TIMEOUT_MS
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch sitemap: ${response.status} ${response.statusText}`);
      }
      const xml = await response.text();
      const urls: string[] = [];
      const regex = /<loc>([^<]+)<\/loc>/g;
      let match;
      while ((match = regex.exec(xml)) !== null) {
        urls.push(match[1].trim());
      }
      return urls;
    } catch (err) {
      if (attempt === RETRIES) throw err;
      await sleep(500 * (attempt + 1));
    }
  }
  throw new Error("Failed to fetch sitemap after retries");
}

async function runWithConcurrency<T, R>(items: T[], fn: (item: T) => Promise<R>, limit: number): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from({ length: limit }, () => worker());
  await Promise.all(workers);
  return results;
}

async function main() {
  console.log(`🔍 Checking links for ${baseUrl}\n`);

  const sitemapUrl = `${baseUrl}/sitemap.xml`;
  let urls: string[];
  try {
    urls = await fetchSitemapUrls(sitemapUrl);
    console.log(`Found ${urls.length} URLs in sitemap\n`);
  } catch (err) {
    console.warn(
      `⚠️ Could not fetch sitemap at ${sitemapUrl}: ${err instanceof Error ? err.message : String(err)}`
    );
    console.warn("   Falling back to homepage check only.\n");
    urls = [baseUrl];
  }

  let checked = 0;
  const results = await runWithConcurrency(urls, async (url) => {
    const result = await checkUrl(url);
    checked++;
    process.stdout.write(`\r  Checked ${checked}/${urls.length}`);
    return result;
  }, CONCURRENCY);
  process.stdout.write("\n\n");

  // Real-time per-result logging
  for (const result of results) {
    if (result.error) {
      console.log(`  ❌ ${result.url} — ERROR: ${result.error}`);
    } else if (result.redirectLoop) {
      console.log(`  🔄 ${result.url} — Redirect loop (${result.redirectCount} redirects)`);
    } else if (result.status >= 400) {
      console.log(`  ❌ ${result.url} — ${result.status} ${result.statusText}`);
    } else {
      console.log(`  ✅ ${result.url} — ${result.status} ${result.statusText}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("📊 Summary\n");

  const broken = results.filter((r) => r.status >= 400 || r.error);
  const redirects = results.filter((r) => r.redirectCount > 0);
  const loops = results.filter((r) => r.redirectLoop);
  const noindexed = results.filter((r) => r.noindex);
  function normalizeUrl(url: string) {
    try {
      const u = new URL(url);
      u.pathname = u.pathname.replace(/\/$/, "");
      return u.toString().replace(/^https?:\/\//, "").toLowerCase();
    } catch {
      return url;
    }
  }

  const canonicalIssues = results.filter(
    (r) => r.canonical && normalizeUrl(r.canonical) !== normalizeUrl(r.url) && r.status < 400
  );

  console.log(`Total URLs checked: ${results.length}`);
  console.log(`Broken (4xx/5xx/errors): ${broken.length}`);
  console.log(`Redirects: ${redirects.length}`);
  console.log(`Redirect loops: ${loops.length}`);
  console.log(`Noindex in sitemap: ${noindexed.length}`);
  console.log(`Canonical mismatch: ${canonicalIssues.length}`);

  if (broken.length > 0) {
    console.log("\n❌ Broken URLs:");
    for (const r of broken) {
      console.log(`   ${r.status || "ERR"} - ${r.url}${r.error ? ` (${r.error})` : ""}`);
    }
  }

  if (loops.length > 0) {
    console.log("\n🔄 Redirect loops:");
    for (const r of loops) {
      console.log(`   ${r.url}`);
    }
  }

  if (noindexed.length > 0) {
    console.log("\n URLs in sitemap with noindex:");
    for (const r of noindexed) {
      console.log(`   ${r.url}`);
    }
  }

  if (canonicalIssues.length > 0) {
    console.log("\n🔗 Canonical mismatch:");
    for (const r of canonicalIssues) {
      console.log(`   ${r.url} -> canonical: ${r.canonical}`);
    }
  }

  if (broken.length === 0 && loops.length === 0 && noindexed.length === 0 && canonicalIssues.length === 0) {
    console.log("\n✅ No broken links or SEO issues found.");
    process.exit(0);
  } else {
    console.log("\n⚠️ Some issues were found.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
