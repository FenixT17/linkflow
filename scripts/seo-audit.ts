/**
 * SEO/GSC Audit Script
 *
 * Verifies the most common Google Search Console readiness checks locally:
 * - robots.txt, sitemap.xml, manifest.webmanifest
 * - favicon and apple-touch-icon
 * - metadata on public pages
 * - image alt attributes in key components
 * - HSTS / HTTPS headers in next.config
 *
 * Run with: npx tsx scripts/seo-audit.ts
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const REPORT: string[] = [];
let failures = 0;

function ok(msg: string) {
  REPORT.push(`✅ ${msg}`);
}
function fail(msg: string) {
  REPORT.push(`❌ ${msg}`);
  failures++;
}

function fileExists(...segments: string[]) {
  return fs.existsSync(path.join(ROOT, ...segments));
}

function read(...segments: string[]) {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

console.log(" LinkFlow SEO / GSC Audit\n");

// Public files
const publicFiles = [
  "public/robots.txt",
  "public/manifest.webmanifest",
  "public/favicon-32x32.png",
  "public/apple-touch-icon.png",
];
for (const file of publicFiles) {
  if (fileExists(file)) {
    ok(`${file} exists`);
  } else {
    fail(`${file} missing`);
  }
}

// robots.txt checks
if (fileExists("public/robots.txt")) {
  const robots = read("public/robots.txt");
  if (robots.includes("Sitemap:")) {
    ok("robots.txt references Sitemap");
  } else {
    fail("robots.txt missing Sitemap");
  }
  if (robots.includes("Disallow: /dashboard")) {
    ok("robots.txt blocks /dashboard");
  } else {
    fail("robots.txt does not block /dashboard");
  }
  if (robots.includes("Disallow: /api")) {
    ok("robots.txt blocks /api");
  } else {
    fail("robots.txt does not block /api");
  }
} else {
  fail("robots.txt not found");
}

// sitemap route
if (fileExists("src/app/sitemap.ts")) {
  ok("Dynamic sitemap.ts route exists");
} else {
  fail("sitemap.ts missing");
}

// manifest checks
if (fileExists("public/manifest.webmanifest")) {
  const manifest = JSON.parse(read("public/manifest.webmanifest"));
  if (manifest.name) {
    ok("manifest.webmanifest has name");
  } else {
    fail("manifest.webmanifest missing name");
  }
  if (manifest.start_url) {
    ok("manifest.webmanifest has start_url");
  } else {
    fail("manifest.webmanifest missing start_url");
  }
  if (Array.isArray(manifest.icons) && manifest.icons.length > 0) {
    ok("manifest.webmanifest has icons");
  } else {
    fail("manifest.webmanifest missing icons");
  }
}

// next.config.ts checks
if (fileExists("next.config.ts")) {
  const nextConfig = read("next.config.ts");
  if (nextConfig.includes("compress: true")) {
    ok("Next.js compression enabled");
  } else {
    fail("Next.js compression missing");
  }
  if (nextConfig.includes("Strict-Transport-Security")) {
    ok("HSTS header configured");
  } else {
    fail("HSTS header missing");
  }
  if (nextConfig.includes("unoptimized:")) {
    fail("Image optimization still disabled (unoptimized: true)");
  } else {
    ok("Image optimization enabled");
  }
} else {
  fail("next.config.ts missing");
}

// Metadata on public pages
const publicPages = [
  "src/app/layout.tsx",
  "src/app/login/layout.tsx",
  "src/app/register/layout.tsx",
  "src/app/demo/layout.tsx",
  "src/app/u/[nomeUtilizador]/page.tsx",
];
for (const page of publicPages) {
  if (fileExists(page)) {
    const content = read(page);
    const hasMetadata = content.includes("export const metadata") || content.includes("export async function generateMetadata");
    if (hasMetadata) {
      ok(`${page} exports metadata`);
    } else {
      fail(`${page} missing metadata export`);
    }
  } else {
    fail(`${page} not found`);
  }
}

// noindex on auth pages
for (const page of ["src/app/login/layout.tsx", "src/app/register/layout.tsx"]) {
  if (fileExists(page)) {
    const content = read(page);
    if (content.includes("noIndex: true")) {
      ok(`${page} has noIndex: true`);
    } else {
      fail(`${page} missing noIndex: true`);
    }
  }
}

// JSON-LD helpers
if (fileExists("src/lib/seo.ts")) {
  const content = read("src/lib/seo.ts");
  if (content.includes("organizationJsonLd")) {
    ok("Organization JSON-LD helper exists");
  } else {
    fail("Organization JSON-LD missing");
  }
  if (content.includes("websiteJsonLd")) {
    ok("WebSite JSON-LD helper exists");
  } else {
    fail("WebSite JSON-LD missing");
  }
  if (content.includes("profilePageJsonLd")) {
    ok("ProfilePage JSON-LD helper exists");
  } else {
    fail("ProfilePage JSON-LD missing");
  }
  if (content.includes("breadcrumbListJsonLd")) {
    ok("BreadcrumbList JSON-LD helper exists");
  } else {
    fail("BreadcrumbList JSON-LD missing");
  }
  if (content.includes("webPageJsonLd")) {
    ok("WebPage JSON-LD helper exists");
  } else {
    fail("WebPage JSON-LD missing");
  }
}

// Check key components for alt text (naive regex)
for (const file of ["src/components/ui/logo.tsx", "src/components/ui/avatar.tsx"]) {
  if (fileExists(file)) {
    const content = read(file);
    if (content.includes("alt=")) {
      ok(`${file} has alt attribute`);
    } else {
      fail(`${file} missing alt attribute`);
    }
  }
}

console.log(REPORT.join("\n"));
console.log("\n" + "-".repeat(50));
if (failures === 0) {
  console.log("✅ Audit passed — site looks ready for Google Search Console.");
} else {
  console.log(` Audit failed with ${failures} issue(s).`);
  process.exit(1);
}
